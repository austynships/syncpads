#!/usr/bin/env bash
# Nightly MariaDB backup, kept on this server.
# Run by deploy/systemd/syncpads-backup.timer (see README). Keeps the last
# BACKUP_KEEP_DAYS days (default 14) of dumps in BACKUP_DIR.
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a
BACKUP_DIR="${BACKUP_DIR:-/var/backups/syncpads}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="${BACKUP_DIR}/syncpads-${STAMP}.sql.gz"

echo "==> Dumping database"
docker compose -f docker-compose.prod.yml exec -T mariadb \
  mariadb-dump --single-transaction --routines --triggers \
  -uroot -p"${DB_ROOT_PASSWORD}" syncpads | gzip > "${FILE}.part"
mv "${FILE}.part" "$FILE"
chmod 600 "$FILE"

echo "==> Removing backups older than ${BACKUP_KEEP_DAYS} days"
find "$BACKUP_DIR" -name 'syncpads-*.sql.gz' -mtime +"$BACKUP_KEEP_DAYS" -delete

echo "==> Backup done: $FILE ($(du -h "$FILE" | cut -f1))"
