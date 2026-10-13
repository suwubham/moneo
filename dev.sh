#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

env_file=apps/app/.env.local
if [ ! -f "$env_file" ]; then
  cp apps/app/.env.example "$env_file"
  echo "dev: created $env_file from the example"
fi
if ! grep -qE '^NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=.+' "$env_file"; then
  echo "dev: no Clerk keys yet. Run this once:  (cd apps/app && npx clerk@latest init)"
  exit 1
fi
grep -qE '^GOOGLE_CLOUD_PROJECT=.+' "$env_file" || echo "dev: GOOGLE_CLOUD_PROJECT is empty, so the assistant is off"

docker compose up -d --wait postgres

cleanup() {
  trap - INT TERM EXIT
  kill 0 2>/dev/null || true
  docker compose stop postgres >/dev/null
  echo "dev: stopped (database kept)"
}
trap cleanup INT TERM EXIT

echo "dev: site http://localhost:3030  app http://localhost:3031  postgres localhost:5436"
npm run dev -w @moneo/app &
npm run dev -w @moneo/site &
wait
