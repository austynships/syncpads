#!/usr/bin/env bash
# Pull the latest code and (re)start the production stack.
# Run on the server from the repo folder:  ./scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "Missing .env. Run: cp .env.production.example .env and fill it in." >&2
  exit 1
fi

echo "==> Pulling latest code"
git pull --ff-only

echo "==> Building and starting containers"
docker compose -f docker-compose.prod.yml up -d --build

echo "==> Removing old images"
docker image prune -f >/dev/null

echo "==> Status"
docker compose -f docker-compose.prod.yml ps
echo
echo "Done. Follow app logs with:"
echo "  docker compose -f docker-compose.prod.yml logs -f app"
