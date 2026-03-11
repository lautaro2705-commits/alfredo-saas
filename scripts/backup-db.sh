#!/bin/bash
# ============================================================
# PostgreSQL Backup Script — Alfredo
# ============================================================
# Runs daily via cron or docker container.
# Keeps 7 days of local backups + optional S3/R2 upload.
#
# Usage:
#   ./scripts/backup-db.sh
#
# Env vars:
#   PGHOST, PGUSER, PGPASSWORD, PGDATABASE (or defaults from compose)
#   BACKUP_DIR          — local backup dir (default: /backups)
#   BACKUP_RETAIN_DAYS  — days to keep locally (default: 7)
#   S3_BUCKET           — optional S3/R2 bucket for offsite backup
#   AWS_ACCESS_KEY_ID   — for S3 upload (or use instance role)
#   AWS_SECRET_ACCESS_KEY
# ============================================================

set -euo pipefail

# ── Config ──
PGHOST="${PGHOST:-db}"
PGUSER="${PGUSER:-postgres}"
PGPASSWORD="${PGPASSWORD:-}"
PGDATABASE="${PGDATABASE:-saas_platform}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_RETAIN_DAYS="${BACKUP_RETAIN_DAYS:-7}"
S3_BUCKET="${S3_BUCKET:-}"

# ── Timestamp ──
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="alfredo_${PGDATABASE}_${TIMESTAMP}.sql.gz"
FILEPATH="${BACKUP_DIR}/${FILENAME}"

# ── Ensure backup dir exists ──
mkdir -p "${BACKUP_DIR}"

echo "[$(date -Iseconds)] Starting backup: ${FILENAME}"

# ── Dump ──
export PGPASSWORD
pg_dump -h "${PGHOST}" -U "${PGUSER}" -d "${PGDATABASE}" \
  --no-owner --no-acl --clean --if-exists \
  | gzip -9 > "${FILEPATH}"

# ── Verify ──
FILESIZE=$(stat -f%z "${FILEPATH}" 2>/dev/null || stat -c%s "${FILEPATH}" 2>/dev/null || echo "0")
if [ "${FILESIZE}" -lt 1024 ]; then
  echo "[ERROR] Backup file too small (${FILESIZE} bytes). Possible failure."
  exit 1
fi

echo "[$(date -Iseconds)] Backup complete: ${FILENAME} ($(numfmt --to=iec-i ${FILESIZE} 2>/dev/null || echo "${FILESIZE} bytes"))"

# ── Upload to S3/R2 (if configured) ──
if [ -n "${S3_BUCKET}" ]; then
  echo "[$(date -Iseconds)] Uploading to ${S3_BUCKET}..."
  aws s3 cp "${FILEPATH}" "s3://${S3_BUCKET}/backups/${FILENAME}" --quiet
  echo "[$(date -Iseconds)] Upload complete."
fi

# ── Cleanup old backups ──
echo "[$(date -Iseconds)] Cleaning backups older than ${BACKUP_RETAIN_DAYS} days..."
find "${BACKUP_DIR}" -name "alfredo_*.sql.gz" -mtime +${BACKUP_RETAIN_DAYS} -delete
REMAINING=$(find "${BACKUP_DIR}" -name "alfredo_*.sql.gz" | wc -l)
echo "[$(date -Iseconds)] Done. ${REMAINING} backup(s) retained."
