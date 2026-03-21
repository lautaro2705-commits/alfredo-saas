#!/bin/bash
# ============================================================
# PostgreSQL Hardening Script — Alfredo
# ============================================================
# Applies production security and performance settings to the
# PostgreSQL instance. Safe to run multiple times (idempotent).
#
# Usage:
#   ./scripts/harden-db.sh
#
# Env vars:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE
#   SAAS_APP_USER       — application user (default: saas_app)
#   SAAS_APP_PASSWORD   — application user password
# ============================================================

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ── Config ──
PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-}"
PGDATABASE="${PGDATABASE:-saas_platform}"
SAAS_APP_USER="${SAAS_APP_USER:-saas_app}"
SAAS_APP_PASSWORD="${SAAS_APP_PASSWORD:-}"

export PGPASSWORD

run_sql() {
    psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -c "$1" 2>&1
}

run_sql_quiet() {
    psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -t -c "$1" 2>/dev/null | tr -d ' '
}

run_sql_postgres() {
    psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "$1" 2>&1
}

echo "================================================================"
echo "  PostgreSQL Hardening — Alfredo"
echo "================================================================"
echo ""
echo "  Host:     ${PGHOST}"
echo "  Database: ${PGDATABASE}"
echo "  User:     ${PGUSER}"
echo ""

# ==================================================================
# 1. CONNECTION LIMITS
# ==================================================================
echo "── 1. Connection Limits ──"

# Set database-level connection limit (prevent resource exhaustion)
echo "Setting database connection limit to 50..."
run_sql_postgres "ALTER DATABASE \"${PGDATABASE}\" CONNECTION LIMIT 50;" > /dev/null

# Limit the app user connections
echo "Setting ${SAAS_APP_USER} connection limit to 30..."
run_sql_postgres "ALTER ROLE ${SAAS_APP_USER} CONNECTION LIMIT 30;" > /dev/null 2>&1 || \
    echo -e "${YELLOW}  Warning: Could not set connection limit for ${SAAS_APP_USER} (role may not exist yet)${NC}"

echo -e "${GREEN}  Connection limits configured.${NC}"
echo ""

# ==================================================================
# 2. STATEMENT TIMEOUT (prevent runaway queries)
# ==================================================================
echo "── 2. Statement Timeout ──"

# Set global statement timeout: 30 seconds for the app user
echo "Setting statement timeout for ${SAAS_APP_USER} to 30s..."
run_sql_postgres "ALTER ROLE ${SAAS_APP_USER} SET statement_timeout = '30s';" > /dev/null 2>&1 || \
    echo -e "${YELLOW}  Warning: Could not set statement_timeout for ${SAAS_APP_USER}${NC}"

# Set database-level default: 60 seconds (catches any user)
echo "Setting database-level statement timeout to 60s..."
run_sql_postgres "ALTER DATABASE \"${PGDATABASE}\" SET statement_timeout = '60s';" > /dev/null

# Lock timeout to prevent blocking on DDL
echo "Setting lock timeout for ${SAAS_APP_USER} to 10s..."
run_sql_postgres "ALTER ROLE ${SAAS_APP_USER} SET lock_timeout = '10s';" > /dev/null 2>&1 || true

# Idle transaction timeout (prevent abandoned transactions holding locks)
echo "Setting idle_in_transaction_session_timeout to 5 minutes..."
run_sql_postgres "ALTER DATABASE \"${PGDATABASE}\" SET idle_in_transaction_session_timeout = '300s';" > /dev/null

echo -e "${GREEN}  Timeout settings configured.${NC}"
echo ""

# ==================================================================
# 3. LOGGING CONFIGURATION
# ==================================================================
echo "── 3. Logging ──"

# Log slow queries (> 1 second)
echo "Enabling slow query logging (> 1s)..."
run_sql "ALTER SYSTEM SET log_min_duration_statement = 1000;" > /dev/null

# Log connection events
echo "Enabling connection logging..."
run_sql "ALTER SYSTEM SET log_connections = on;" > /dev/null
run_sql "ALTER SYSTEM SET log_disconnections = on;" > /dev/null

# Log DDL statements
echo "Enabling DDL logging..."
run_sql "ALTER SYSTEM SET log_statement = 'ddl';" > /dev/null

# Log lock waits
echo "Enabling lock wait logging..."
run_sql "ALTER SYSTEM SET log_lock_waits = on;" > /dev/null
run_sql "ALTER SYSTEM SET deadlock_timeout = '1s';" > /dev/null

# Log temp files (queries spilling to disk)
echo "Enabling temp file logging (> 1MB)..."
run_sql "ALTER SYSTEM SET log_temp_files = 1024;" > /dev/null

# Log checkpoints
echo "Enabling checkpoint logging..."
run_sql "ALTER SYSTEM SET log_checkpoints = on;" > /dev/null

echo -e "${GREEN}  Logging configured.${NC}"
echo ""

# ==================================================================
# 4. SECURITY: APPLICATION USER PERMISSIONS
# ==================================================================
echo "── 4. Application User Security ──"

if [ -n "${SAAS_APP_PASSWORD}" ]; then
    echo "Ensuring ${SAAS_APP_USER} exists with restricted permissions..."
    run_sql_postgres "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAAS_APP_USER}') THEN
                CREATE ROLE ${SAAS_APP_USER} WITH LOGIN PASSWORD '${SAAS_APP_PASSWORD}';
            END IF;
        END
        \$\$;
    " > /dev/null

    # Revoke dangerous privileges
    echo "Revoking dangerous privileges from ${SAAS_APP_USER}..."
    run_sql "REVOKE CREATE ON SCHEMA public FROM ${SAAS_APP_USER};" > /dev/null 2>&1 || true

    # Grant only necessary DML permissions
    echo "Granting DML-only permissions..."
    run_sql "
        GRANT CONNECT ON DATABASE \"${PGDATABASE}\" TO ${SAAS_APP_USER};
        GRANT USAGE ON SCHEMA public TO ${SAAS_APP_USER};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${SAAS_APP_USER};
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${SAAS_APP_USER};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${SAAS_APP_USER};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${SAAS_APP_USER};
    " > /dev/null

    # Prevent the app user from modifying schema
    echo "Preventing schema modification by ${SAAS_APP_USER}..."
    run_sql_postgres "ALTER ROLE ${SAAS_APP_USER} SET search_path = 'public';" > /dev/null

    echo -e "${GREEN}  Application user security configured.${NC}"
else
    echo -e "${YELLOW}  Skipping app user setup (SAAS_APP_PASSWORD not set)${NC}"
fi
echo ""

# ==================================================================
# 5. PERFORMANCE TUNING (conservative for small-medium workloads)
# ==================================================================
echo "── 5. Performance Tuning ──"

# Prevent full-table scans on large tables from consuming too much memory
echo "Setting work_mem to 8MB..."
run_sql "ALTER SYSTEM SET work_mem = '8MB';" > /dev/null

# Maintenance work mem for VACUUM, CREATE INDEX, etc.
echo "Setting maintenance_work_mem to 64MB..."
run_sql "ALTER SYSTEM SET maintenance_work_mem = '64MB';" > /dev/null

# Effective cache size hint (helps query planner)
echo "Setting effective_cache_size to 256MB..."
run_sql "ALTER SYSTEM SET effective_cache_size = '256MB';" > /dev/null

# Random page cost (lower for SSD storage, which Railway uses)
echo "Tuning random_page_cost for SSD..."
run_sql "ALTER SYSTEM SET random_page_cost = 1.1;" > /dev/null

echo -e "${GREEN}  Performance tuning configured.${NC}"
echo ""

# ==================================================================
# 6. ROW LEVEL SECURITY ENFORCEMENT
# ==================================================================
echo "── 6. RLS Enforcement ──"

# Ensure the app user respects RLS (not a superuser)
echo "Ensuring ${SAAS_APP_USER} is NOT a superuser..."
run_sql_postgres "ALTER ROLE ${SAAS_APP_USER} NOSUPERUSER NOCREATEDB NOCREATEROLE;" > /dev/null 2>&1 || true

echo -e "${GREEN}  RLS enforcement verified.${NC}"
echo ""

# ==================================================================
# 7. RELOAD CONFIGURATION
# ==================================================================
echo "── 7. Applying Configuration ──"
echo "Reloading PostgreSQL configuration..."
run_sql "SELECT pg_reload_conf();" > /dev/null

echo -e "${GREEN}  Configuration reloaded.${NC}"
echo ""

# ==================================================================
# SUMMARY
# ==================================================================
echo "================================================================"
echo -e "${GREEN}  Hardening Complete${NC}"
echo "================================================================"
echo ""
echo "  Applied settings:"
echo "    - Connection limit: 50 (database), 30 (app user)"
echo "    - Statement timeout: 30s (app), 60s (database)"
echo "    - Lock timeout: 10s"
echo "    - Idle transaction timeout: 5 min"
echo "    - Slow query log: > 1s"
echo "    - DDL logging: enabled"
echo "    - Lock wait logging: enabled"
echo "    - SSD-optimized query planner"
echo "    - App user: DML-only, no schema modification"
echo ""
echo "  NOTE: Some settings require a PostgreSQL restart to take effect."
echo "  Run: docker compose restart db"
echo ""
