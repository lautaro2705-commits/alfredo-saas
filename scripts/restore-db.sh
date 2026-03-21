#!/bin/bash
# ============================================================
# PostgreSQL Restore Script — Alfredo
# ============================================================
# Restores a database from a pg_dump backup file (.sql.gz or .sql).
#
# Usage:
#   ./scripts/restore-db.sh <backup-file> [--force]
#
# Options:
#   --force    Skip confirmation prompt
#
# Env vars:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE (or defaults)
#   SAAS_APP_USER     — application user to re-grant after restore
#   SAAS_APP_PASSWORD — application user password
# ============================================================

set -euo pipefail

# ── Colors ──
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Config ──
PGHOST="${PGHOST:-localhost}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-}"
PGDATABASE="${PGDATABASE:-saas_platform}"
SAAS_APP_USER="${SAAS_APP_USER:-saas_app}"
SAAS_APP_PASSWORD="${SAAS_APP_PASSWORD:-}"

# ── Args ──
BACKUP_FILE="${1:-}"
FORCE="${2:-}"

if [ -z "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: No backup file specified.${NC}"
    echo ""
    echo "Usage: $0 <backup-file> [--force]"
    echo ""
    echo "Examples:"
    echo "  $0 /backups/alfredo_saas_platform_20260320_030000.sql.gz"
    echo "  $0 ./backup.sql.gz --force"
    exit 1
fi

# ── Validate file exists ──
if [ ! -f "${BACKUP_FILE}" ]; then
    echo -e "${RED}Error: Backup file not found: ${BACKUP_FILE}${NC}"
    exit 1
fi

# ── Validate file size ──
FILESIZE=$(stat -f%z "${BACKUP_FILE}" 2>/dev/null || stat -c%s "${BACKUP_FILE}" 2>/dev/null || echo "0")
if [ "${FILESIZE}" -lt 1024 ]; then
    echo -e "${RED}Error: Backup file is suspiciously small (${FILESIZE} bytes). Aborting.${NC}"
    exit 1
fi

FILESIZE_HUMAN=$(numfmt --to=iec-i "${FILESIZE}" 2>/dev/null || echo "${FILESIZE} bytes")

# ── Confirmation ──
echo -e "${YELLOW}================================================================${NC}"
echo -e "${YELLOW}  DATABASE RESTORE — DESTRUCTIVE OPERATION${NC}"
echo -e "${YELLOW}================================================================${NC}"
echo ""
echo "  Host:     ${PGHOST}"
echo "  Database: ${PGDATABASE}"
echo "  User:     ${PGUSER}"
echo "  Backup:   ${BACKUP_FILE}"
echo "  Size:     ${FILESIZE_HUMAN}"
echo ""
echo -e "${RED}  WARNING: This will DROP and RECREATE the database.${NC}"
echo -e "${RED}  ALL existing data will be permanently destroyed.${NC}"
echo ""

if [ "${FORCE}" != "--force" ]; then
    read -rp "Type the database name to confirm (${PGDATABASE}): " CONFIRM
    if [ "${CONFIRM}" != "${PGDATABASE}" ]; then
        echo -e "${RED}Confirmation failed. Aborting.${NC}"
        exit 1
    fi
fi

export PGPASSWORD

echo ""
echo "[$(date -Iseconds)] Starting restore..."

# ── Step 1: Terminate active connections ──
echo "[$(date -Iseconds)] Terminating active connections to ${PGDATABASE}..."
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${PGDATABASE}' AND pid <> pg_backend_pid();
" > /dev/null 2>&1 || true

# ── Step 2: Drop and recreate database ──
echo "[$(date -Iseconds)] Dropping database ${PGDATABASE}..."
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "DROP DATABASE IF EXISTS \"${PGDATABASE}\";"

echo "[$(date -Iseconds)] Creating database ${PGDATABASE}..."
psql -h "${PGHOST}" -U "${PGUSER}" -d postgres -c "CREATE DATABASE \"${PGDATABASE}\" OWNER \"${PGUSER}\";"

# ── Step 3: Restore from backup ──
echo "[$(date -Iseconds)] Restoring from backup..."
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    gunzip -c "${BACKUP_FILE}" | psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" --quiet --single-transaction 2>&1 | tail -5
else
    psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" --quiet --single-transaction < "${BACKUP_FILE}" 2>&1 | tail -5
fi

# ── Step 4: Re-grant application user permissions ──
if [ -n "${SAAS_APP_USER}" ]; then
    echo "[$(date -Iseconds)] Re-granting permissions to ${SAAS_APP_USER}..."
    psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -c "
        -- Recreate app user if it doesn't exist
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${SAAS_APP_USER}') THEN
                CREATE ROLE ${SAAS_APP_USER} WITH LOGIN PASSWORD '${SAAS_APP_PASSWORD}';
            END IF;
        END
        \$\$;

        -- Grant permissions
        GRANT CONNECT ON DATABASE \"${PGDATABASE}\" TO ${SAAS_APP_USER};
        GRANT USAGE ON SCHEMA public TO ${SAAS_APP_USER};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${SAAS_APP_USER};
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${SAAS_APP_USER};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${SAAS_APP_USER};
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO ${SAAS_APP_USER};
    " > /dev/null 2>&1 || echo -e "${YELLOW}Warning: Could not re-grant permissions to ${SAAS_APP_USER}${NC}"
fi

# ── Step 5: Verify restore ──
echo "[$(date -Iseconds)] Verifying restore..."
TABLE_COUNT=$(psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -t -c "
    SELECT count(*) FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
" | tr -d ' ')

TENANT_COUNT=$(psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -t -c "
    SELECT count(*) FROM tenants;
" 2>/dev/null | tr -d ' ' || echo "N/A")

USER_COUNT=$(psql -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" -t -c "
    SELECT count(*) FROM platform_users;
" 2>/dev/null | tr -d ' ' || echo "N/A")

echo ""
echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  RESTORE COMPLETE${NC}"
echo -e "${GREEN}================================================================${NC}"
echo ""
echo "  Tables restored: ${TABLE_COUNT}"
echo "  Tenants:         ${TENANT_COUNT}"
echo "  Users:           ${USER_COUNT}"
echo ""

if [ "${TABLE_COUNT}" -lt 10 ]; then
    echo -e "${RED}WARNING: Only ${TABLE_COUNT} tables found. Expected 25+. Restore may be incomplete.${NC}"
    exit 1
fi

echo -e "${GREEN}Restore verified successfully.${NC}"
echo "[$(date -Iseconds)] Done."
