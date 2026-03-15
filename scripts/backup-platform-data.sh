#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date '+%Y%m%d-%H%M%S')"
BACKUP_DIR="${1:-$ROOT_DIR/artifacts/platform-data-backups/$STAMP}"
ENV_FILE=".env.local"

if [ ! -f "$ENV_FILE" ]; then
  if [ -f ".env.demo.example" ]; then
    ENV_FILE=".env.demo.example"
  elif [ -f ".env.example" ]; then
    ENV_FILE=".env.example"
  else
    echo "No environment file found. Expected .env.local, .env.demo.example, or .env.example."
    exit 1
  fi
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
mkdir -p "$BACKUP_DIR/app-db" "$BACKUP_DIR/vaults" "$BACKUP_DIR/logs" "$BACKUP_DIR/lake"

MAIN_DB_PATH=""
if [[ "${DATABASE_URL:-}" == file:* ]]; then
  MAIN_DB_PATH="${DATABASE_URL#file:}"
  if [[ "$MAIN_DB_PATH" != /* ]]; then
    MAIN_DB_PATH="$ROOT_DIR/$MAIN_DB_PATH"
  fi
fi

if [ -n "$MAIN_DB_PATH" ] && [ -f "$MAIN_DB_PATH" ]; then
  cp "$MAIN_DB_PATH" "$BACKUP_DIR/app-db/"
fi

if [ -d "$ROOT_DIR/data/vaults" ]; then
  cp -R "$ROOT_DIR/data/vaults/." "$BACKUP_DIR/vaults/"
fi

if [ -d "$ROOT_DIR/data/lake" ]; then
  cp -R "$ROOT_DIR/data/lake/." "$BACKUP_DIR/lake/"
fi

if [ -f "$ROOT_DIR/logs/provider-traffic.jsonl" ]; then
  cp "$ROOT_DIR/logs/provider-traffic.jsonl" "$BACKUP_DIR/logs/"
fi

node scripts/platform-data-snapshot.mjs --output "$BACKUP_DIR/manifest.json"

cat > "$BACKUP_DIR/README.md" <<EOF
# Platform Data Backup

- Created: $(date '+%Y-%m-%d %H:%M:%S %Z')
- Root: $ROOT_DIR
- Environment file: $ENV_FILE
- Main DB: ${MAIN_DB_PATH:-not-file-based}

Contents:
- \`app-db/\`: main Prisma app database snapshot when \`DATABASE_URL\` is SQLite
- \`vaults/\`: vault SQLite cache databases
- \`lake/\`: parquet/data-lake files, if present
- \`logs/\`: provider telemetry logs, if present
- \`manifest.json\`: inventory/auth/provider/storage snapshot taken at backup time
EOF

echo "Platform data backup created at $BACKUP_DIR"
