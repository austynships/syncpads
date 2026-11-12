#!/usr/bin/env bash
# Nightly MariaDB backup to Cloudflare R2.
# Run by cron (see README). Keep backups for 30 days with an R2 lifecycle rule
# on the bucket ("delete objects after 30 days").
set -euo pipefail
cd "$(dirname "$0")/.."

set -a; source .env; set +a
: "${R2_ACCOUNT_ID:?}" "${R2_ACCESS_KEY_ID:?}" "${R2_SECRET_ACCESS_KEY:?}" "${R2_BUCKET:?}"

STAMP="$(date -u +%Y-%m-%dT%H%M%SZ)"
FILE="/tmp/syncpads-${STAMP}.sql.gz"

echo "==> Dumping database"
docker compose -f docker-compose.prod.yml exec -T mariadb \
  mariadb-dump --single-transaction --routines --triggers \
  -uroot -p"${DB_ROOT_PASSWORD}" syncpads | gzip > "$FILE"

echo "==> Uploading to R2"
docker run --rm \
  -e AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
  -e AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
  -e AWS_DEFAULT_REGION=auto \
  -v /tmp:/tmp \
  amazon/aws-cli s3 cp "$FILE" "s3://${R2_BUCKET}/mariadb/$(basename "$FILE")" \
  --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"

rm -f "$FILE"
echo "==> Backup done: mariadb/$(basename "$FILE")"

