#!/usr/bin/env bash
# Build and restart SyncPads on the cPanel server.
# Run as root:  /home/<user>/syncpads/deploy/cpanel/deploy.sh
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
APP_USER="$(stat -c %U "$APP_DIR")"
NODE_BIN=/opt/cpanel/ea-nodejs22/bin

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root." >&2
  exit 1
fi
if [ ! -f "$APP_DIR/.env" ]; then
  echo "Missing $APP_DIR/.env (copy deploy/cpanel/env.example and fill it in)." >&2
  exit 1
fi

echo "==> Building as $APP_USER in $APP_DIR"
sudo -u "$APP_USER" env PATH="$NODE_BIN:/usr/bin:/bin" HOME="/home/$APP_USER" bash -euo pipefail -c "
  cd '$APP_DIR'
  git pull --ff-only
  npm ci --no-audit --no-fund
  NEXT_TELEMETRY_DISABLED=1 npm run build
  # The standalone server needs static files, public files and migrations next to it.
  mkdir -p public .next/standalone/.next
  rm -rf .next/standalone/.next/static .next/standalone/public .next/standalone/drizzle
  cp -r .next/static .next/standalone/.next/static
  cp -r public .next/standalone/public
  cp -r drizzle .next/standalone/drizzle
"

echo "==> Restarting service"
systemctl restart syncpads
sleep 5
systemctl --no-pager --lines=15 status syncpads || true
curl -fsS http://127.0.0.1:3000/api/health && echo " <- health check OK"
