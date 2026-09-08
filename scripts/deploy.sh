#!/usr/bin/env bash
#
# Deploy simmodeltwin.net. Run from anywhere:  ./scripts/deploy.sh
#
# Pulls, installs, builds, and reloads the PM2 process. Does not commit or push
# anything - Adam commits.
#
# The public path in is the Cloudflare tunnel (docker container "cloudflared"),
# which reaches this process at http://host.docker.internal:3003. Nothing here
# touches nginx or DNS.

set -euo pipefail

REPO=/opt/smt-fa2026
APP=smt-fa2026
PORT=3003

cd "$REPO"

echo "==> Pulling"
# Fail early and legibly on a dirty tree rather than letting --ff-only produce a
# cryptic error. .env, var/ and node_modules are gitignored and never show here.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "    Tracked files are modified locally:"
  git status --short --untracked-files=no | sed 's/^/      /'
  echo
  echo "    Commit them, or discard with:  git checkout -- <file>"
  exit 1
fi
git pull --ff-only

echo "==> Installing dependencies"
# ci, not install: the lockfile is committed and this must be reproducible.
npm ci

echo "==> Building (prebuild mirrors content/submissions/data into static/)"
npm run build

echo "==> Reloading PM2"
# startOrReload covers both the first deploy and every one after it.
pm2 startOrReload ecosystem.config.cjs
pm2 save

echo "==> Health check"
# Check the docker-gateway address, not loopback: that is the one the tunnel
# actually uses, so a loopback-only bind would pass a localhost check and still
# be down in public.
for i in $(seq 1 20); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "http://172.18.0.1:${PORT}/" || true)
  if [ "$code" = "200" ]; then
    echo "    OK - 200 on http://172.18.0.1:${PORT}/ (attempt $i)"
    echo
    echo "Deployed. https://simmodeltwin.net"
    exit 0
  fi
  sleep 1
done

echo "    FAILED - no 200 after 20s (last: ${code:-none})"
echo "    Logs:  pm2 logs $APP --lines 50"
exit 1
