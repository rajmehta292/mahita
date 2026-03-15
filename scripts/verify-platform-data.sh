#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

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

TMP_DIR="$ROOT_DIR/tmp/platform-data-verify"
mkdir -p "$TMP_DIR"
SNAPSHOT_PATH="$TMP_DIR/snapshot.json"

node scripts/platform-data-snapshot.mjs --output "$SNAPSHOT_PATH"

echo "==> Snapshot written to $SNAPSHOT_PATH"

node - "$SNAPSHOT_PATH" <<'EOF'
const fs = require("fs")
const snapshotPath = process.argv[2]
const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"))

const checks = [
  ["Users", snapshot.authState.userCount],
  ["Accounts", snapshot.authState.accountCount],
  ["Sessions", snapshot.authState.sessionCount],
  ["UserPreferences", snapshot.authState.userPreferenceCount],
  ["BrokerageConnections", snapshot.authState.brokerageConnectionCount],
  ["ProviderPoolMembers", snapshot.providerState.providerPoolMemberCount],
  ["DataInventory rows", snapshot.inventoryState.inventoryCount],
]

console.log("==> Main DB/Auth summary")
for (const [label, count] of checks) {
  console.log(`- ${label}: ${count}`)
}

console.log("==> Storage summary")
console.log(`- Canonical bar source: ${snapshot.storage.canonicalBarSource}`)
console.log(`- Vault count: ${snapshot.storage.vaults.length}`)
console.log(`- Parquet files: ${snapshot.storage.parquet.fileCount}`)
console.log(`- Telemetry log exists: ${snapshot.storage.telemetry.exists}`)
EOF

if command -v curl >/dev/null 2>&1; then
  if curl -fsS http://127.0.0.1:6244/api/health/runtime >/dev/null 2>&1; then
    echo "==> Runtime health"
    curl -fsS http://127.0.0.1:6244/api/health/runtime
    echo
  else
    echo "==> Runtime health skipped (local server not reachable on :6244)"
  fi

  if curl -fsS http://127.0.0.1:6244/api/health/auth >/dev/null 2>&1; then
    echo "==> Auth health"
    curl -fsS http://127.0.0.1:6244/api/health/auth
    echo
  else
    echo "==> Auth health skipped (local server not reachable on :6244)"
  fi
fi

echo "Platform data verification complete."
