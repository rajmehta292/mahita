#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ $# -lt 1 ]; then
  echo "Usage: bash ./scripts/restore-platform-data.sh <backup-dir>"
  exit 1
fi

BACKUP_DIR="$1"
ENV_FILE=".env.local"

if [ ! -d "$BACKUP_DIR" ]; then
  echo "Backup directory not found: $BACKUP_DIR"
  exit 1
fi

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

MAIN_DB_PATH=""
if [[ "${DATABASE_URL:-}" == file:* ]]; then
  MAIN_DB_PATH="${DATABASE_URL#file:}"
  if [[ "$MAIN_DB_PATH" != /* ]]; then
    MAIN_DB_PATH="$ROOT_DIR/$MAIN_DB_PATH"
  fi
fi

PRE_RESTORE_BACKUP="$ROOT_DIR/artifacts/platform-data-backups/pre-restore-$(date '+%Y%m%d-%H%M%S')"
bash ./scripts/backup-platform-data.sh "$PRE_RESTORE_BACKUP" >/dev/null

if [ -n "$MAIN_DB_PATH" ] && [ -d "$BACKUP_DIR/app-db" ] && compgen -G "$BACKUP_DIR/app-db/*" > /dev/null; then
  BACKUP_APP_DB="$(find "$BACKUP_DIR/app-db" -maxdepth 1 -type f | head -n 1)"
  mkdir -p "$(dirname "$MAIN_DB_PATH")"
  rm -f "$MAIN_DB_PATH"
  cp "$BACKUP_APP_DB" "$MAIN_DB_PATH"
fi

if [ -d "$BACKUP_DIR/vaults" ]; then
  rm -rf "$ROOT_DIR/data/vaults"
  mkdir -p "$ROOT_DIR/data/vaults"
  cp -R "$BACKUP_DIR/vaults/." "$ROOT_DIR/data/vaults/"
fi

if [ -d "$BACKUP_DIR/lake" ]; then
  rm -rf "$ROOT_DIR/data/lake"
  mkdir -p "$ROOT_DIR/data/lake"
  cp -R "$BACKUP_DIR/lake/." "$ROOT_DIR/data/lake/"
fi

if [ -d "$BACKUP_DIR/logs" ]; then
  mkdir -p "$ROOT_DIR/logs"
  cp -R "$BACKUP_DIR/logs/." "$ROOT_DIR/logs/"
fi

echo "Platform data restored from $BACKUP_DIR"
echo "Pre-restore snapshot saved to $PRE_RESTORE_BACKUP"
echo "Run 'bash ./scripts/verify-platform-data.sh' before using the app."
