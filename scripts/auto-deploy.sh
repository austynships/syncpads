#!/usr/bin/env bash
# Deploys automatically when main on GitHub has a new commit.
# Run every minute by deploy/systemd/syncpads-auto-deploy.timer (see README).
# The repo is public, so the server pulls without any key or GitHub secret.
set -euo pipefail
cd "$(dirname "$0")/.."

# Skip this run if a deploy is already in progress.
exec 9>/run/lock/syncpads-deploy.lock
flock -n 9 || exit 0

git fetch -q origin main
if [ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ]; then
  exit 0
fi

echo "==> New commit on main: $(git log -1 --format='%h %s' origin/main)"
./scripts/deploy.sh
