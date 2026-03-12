#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

OUTPUT_DIR="$ROOT_DIR/artifacts/senior-project"
STAGING_DIR="$OUTPUT_DIR/mahita-demo-bundle"
ZIP_PATH="$OUTPUT_DIR/mahita-demo-bundle.zip"

mkdir -p "$OUTPUT_DIR"
rm -rf "$STAGING_DIR" "$ZIP_PATH"
mkdir -p "$STAGING_DIR"

rsync -a \
  --exclude ".git" \
  --exclude ".DS_Store" \
  --exclude ".next" \
  --exclude "node_modules" \
  --exclude "test-results" \
  --exclude "tmp" \
  --exclude "artifacts" \
  --exclude ".env" \
  --exclude ".env.local" \
  --exclude "demo.db" \
  --exclude "dev.db" \
  --exclude "prisma/dev.db" \
  --exclude "data/vaults/*.db" \
  --exclude "*.zip" \
  --exclude "*.log" \
  "$ROOT_DIR/" "$STAGING_DIR/"

(cd "$OUTPUT_DIR" && zip -qr "mahita-demo-bundle.zip" "mahita-demo-bundle")

echo "Created $ZIP_PATH"
