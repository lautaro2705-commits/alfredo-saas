#!/bin/bash
# ============================================================
# Backup Health Check — Alfredo
# ============================================================
# Validates that recent backups exist and are healthy.
# Returns exit code 0 if healthy, 1 if not.
#
# Usage:
#   ./scripts/check-backup-health.sh [backup-dir]
#
# Can be used with:
#   - Monitoring systems (Datadog, Prometheus)
#   - Cron alerting
#   - CI/CD health gates
#
# Env vars:
#   BACKUP_DIR          — backup directory (default: /backups)
#   BACKUP_MAX_AGE_H    — max age in hours (default: 48)
#   BACKUP_MIN_SIZE     — min file size in bytes (default: 1024)
#   ALERT_WEBHOOK_URL   — optional webhook for alerts (Slack/Discord)
# ============================================================

set -euo pipefail

# ── Config ──
BACKUP_DIR="${1:-${BACKUP_DIR:-/backups}}"
BACKUP_MAX_AGE_H="${BACKUP_MAX_AGE_H:-48}"
BACKUP_MIN_SIZE="${BACKUP_MIN_SIZE:-1024}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
BACKUP_PATTERN="alfredo_*.sql.gz"

ERRORS=()
WARNINGS=()

# ── Helper ──
log_error() { ERRORS+=("$1"); echo "[FAIL] $1"; }
log_warn()  { WARNINGS+=("$1"); echo "[WARN] $1"; }
log_ok()    { echo "[ OK ] $1"; }

send_alert() {
    local message="$1"
    if [ -n "${ALERT_WEBHOOK_URL}" ]; then
        curl -s -X POST "${ALERT_WEBHOOK_URL}" \
            -H 'Content-Type: application/json' \
            -d "{\"text\": \"${message}\"}" > /dev/null 2>&1 || true
    fi
}

# ── Check 1: Backup directory exists ──
echo "=== Alfredo Backup Health Check ==="
echo "Directory: ${BACKUP_DIR}"
echo "Max age:   ${BACKUP_MAX_AGE_H}h"
echo "Min size:  ${BACKUP_MIN_SIZE} bytes"
echo "---"

if [ ! -d "${BACKUP_DIR}" ]; then
    log_error "Backup directory does not exist: ${BACKUP_DIR}"
    send_alert "[ALERT] Alfredo backup directory missing: ${BACKUP_DIR}"
    exit 1
fi

# ── Check 2: At least one backup file exists ──
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "${BACKUP_PATTERN}" -type f 2>/dev/null | wc -l | tr -d ' ')
if [ "${BACKUP_COUNT}" -eq 0 ]; then
    log_error "No backup files found matching ${BACKUP_PATTERN}"
    send_alert "[ALERT] No Alfredo backups found in ${BACKUP_DIR}"
    exit 1
fi
log_ok "Found ${BACKUP_COUNT} backup file(s)"

# ── Check 3: Latest backup is recent enough ──
LATEST_BACKUP=$(find "${BACKUP_DIR}" -name "${BACKUP_PATTERN}" -type f -printf '%T@ %p\n' 2>/dev/null \
    | sort -rn | head -1 | cut -d' ' -f2- 2>/dev/null)

# Fallback for macOS (no -printf)
if [ -z "${LATEST_BACKUP}" ]; then
    LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/${BACKUP_PATTERN} 2>/dev/null | head -1)
fi

if [ -z "${LATEST_BACKUP}" ]; then
    log_error "Could not determine latest backup file"
    exit 1
fi

LATEST_FILENAME=$(basename "${LATEST_BACKUP}")
log_ok "Latest backup: ${LATEST_FILENAME}"

# Get file modification time
if stat -c %Y "${LATEST_BACKUP}" > /dev/null 2>&1; then
    # Linux
    FILE_MTIME=$(stat -c %Y "${LATEST_BACKUP}")
else
    # macOS
    FILE_MTIME=$(stat -f %m "${LATEST_BACKUP}")
fi

NOW=$(date +%s)
AGE_SECONDS=$((NOW - FILE_MTIME))
AGE_HOURS=$((AGE_SECONDS / 3600))

if [ "${AGE_HOURS}" -gt "${BACKUP_MAX_AGE_H}" ]; then
    log_error "Latest backup is ${AGE_HOURS}h old (max: ${BACKUP_MAX_AGE_H}h)"
    send_alert "[ALERT] Alfredo backup is stale: ${AGE_HOURS}h old (max ${BACKUP_MAX_AGE_H}h). File: ${LATEST_FILENAME}"
else
    log_ok "Backup age: ${AGE_HOURS}h (within ${BACKUP_MAX_AGE_H}h limit)"
fi

# ── Check 4: File size is reasonable ──
if stat -c %s "${LATEST_BACKUP}" > /dev/null 2>&1; then
    FILESIZE=$(stat -c %s "${LATEST_BACKUP}")
else
    FILESIZE=$(stat -f %z "${LATEST_BACKUP}")
fi

FILESIZE_HUMAN=$(numfmt --to=iec-i "${FILESIZE}" 2>/dev/null || echo "${FILESIZE} bytes")

if [ "${FILESIZE}" -lt "${BACKUP_MIN_SIZE}" ]; then
    log_error "Backup file too small: ${FILESIZE_HUMAN} (min: ${BACKUP_MIN_SIZE} bytes)"
    send_alert "[ALERT] Alfredo backup too small: ${FILESIZE_HUMAN}. Possible corruption."
else
    log_ok "Backup size: ${FILESIZE_HUMAN}"
fi

# ── Check 5: File is a valid gzip ──
if [[ "${LATEST_BACKUP}" == *.gz ]]; then
    if gzip -t "${LATEST_BACKUP}" 2>/dev/null; then
        log_ok "Gzip integrity: valid"
    else
        log_error "Gzip integrity check failed — file may be corrupted"
        send_alert "[ALERT] Alfredo backup corrupted: gzip integrity check failed on ${LATEST_FILENAME}"
    fi
fi

# ── Check 6: Warn if only 1 backup ──
if [ "${BACKUP_COUNT}" -lt 2 ]; then
    log_warn "Only ${BACKUP_COUNT} backup(s) found. Recommend keeping at least 3."
fi

# ── Summary ──
echo "---"
if [ ${#ERRORS[@]} -gt 0 ]; then
    echo "RESULT: UNHEALTHY (${#ERRORS[@]} error(s), ${#WARNINGS[@]} warning(s))"
    exit 1
elif [ ${#WARNINGS[@]} -gt 0 ]; then
    echo "RESULT: HEALTHY with warnings (${#WARNINGS[@]})"
    exit 0
else
    echo "RESULT: HEALTHY"
    exit 0
fi
