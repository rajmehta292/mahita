#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Mahita demo bootstrap"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found on PATH."
  exit 1
fi

if [ ! -f ".env.demo.example" ]; then
  echo "Missing .env.demo.example"
  exit 1
fi

cp .env.demo.example .env.local
rm -f demo.db

echo "==> Installing dependencies"
npm install

echo "==> Preparing local assets"
npm run sync:monaco
npx prisma generate

echo "==> Initializing demo database"
DATABASE_URL="file:./demo.db" npx prisma db push --accept-data-loss
DATABASE_URL="file:./demo.db" npx tsx scripts/seed-demo.mjs

echo
echo "Demo bootstrap complete."
echo "Run 'npm run dev' to start Mahita in presentation-safe demo mode."
echo "Use dev-bypass sign-in with one of:"
echo "  - owner.demo@mahita.ai"
echo "  - demo.user@mahita.ai"
echo "  - reviewer@mahita.ai"
echo
echo "Start here after boot:"
echo "  - http://localhost:6244/docs"
echo "  - http://localhost:6244/dashboard"
echo
echo "For live-capable dev mode after the demo setup:"
echo "  1. Replace .env.local with real local/dev secrets"
echo "  2. Configure Google auth and Schwab developer keys"
echo "  3. Use the setup guides in docs and /docs"
