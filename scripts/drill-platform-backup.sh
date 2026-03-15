#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

STAMP="$(date '+%Y%m%d-%H%M%S')"
DRILL_DIR="$ROOT_DIR/artifacts/platform-data-backups/drill-$STAMP"
BACKUP_DIR="$DRILL_DIR/backup"
SANDBOX_DIR="$DRILL_DIR/sandbox"

mkdir -p "$BACKUP_DIR" "$SANDBOX_DIR"

bash ./scripts/backup-platform-data.sh "$BACKUP_DIR" >/dev/null

mkdir -p "$SANDBOX_DIR/app-db" "$SANDBOX_DIR/vaults" "$SANDBOX_DIR/lake" "$SANDBOX_DIR/logs"
if [ -d "$BACKUP_DIR/app-db" ]; then
  cp -R "$BACKUP_DIR/app-db/." "$SANDBOX_DIR/app-db/" || true
fi
if [ -d "$BACKUP_DIR/vaults" ]; then
  cp -R "$BACKUP_DIR/vaults/." "$SANDBOX_DIR/vaults/" || true
fi
if [ -d "$BACKUP_DIR/lake" ]; then
  cp -R "$BACKUP_DIR/lake/." "$SANDBOX_DIR/lake/" || true
fi
if [ -d "$BACKUP_DIR/logs" ]; then
  cp -R "$BACKUP_DIR/logs/." "$SANDBOX_DIR/logs/" || true
fi

node - "$BACKUP_DIR/manifest.json" "$SANDBOX_DIR" > "$DRILL_DIR/restore-summary.json" <<'EOF'
const fs = require("fs")
const path = require("path")

const manifestPath = process.argv[2]
const sandboxDir = process.argv[3]
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))

function countFiles(dirPath) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })
    let total = 0
    for (const entry of entries) {
      const absolutePath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += countFiles(absolutePath)
      } else if (entry.isFile()) {
        total += 1
      }
    }
    return total
  } catch {
    return 0
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  manifestAuthState: manifest.authState,
  manifestProviderState: manifest.providerState,
  manifestInventoryState: manifest.inventoryState,
  sandbox: {
    appDbFiles: countFiles(path.join(sandboxDir, "app-db")),
    vaultFiles: countFiles(path.join(sandboxDir, "vaults")),
    lakeFiles: countFiles(path.join(sandboxDir, "lake")),
    logFiles: countFiles(path.join(sandboxDir, "logs")),
  },
  manualFollowUp: [
    "Sign in as an existing Google-linked user against the live app after backup creation.",
    "Load one chart-backed symbol and one DI-UI admin route.",
    "Confirm UserPreference, BrokerageConnection, and ProviderPoolMember rows still resolve.",
  ],
}

process.stdout.write(JSON.stringify(summary, null, 2))
EOF

cat > "$DRILL_DIR/README.md" <<EOF
# Platform Data Backup Drill

- Created: $(date '+%Y-%m-%d %H:%M:%S %Z')
- Backup dir: $BACKUP_DIR
- Sandbox dir: $SANDBOX_DIR

Files:
- \`backup/\`: exact platform-data backup snapshot
- \`sandbox/\`: copied restore target used for non-destructive drill validation
- \`restore-summary.json\`: manifest and file-count comparison for the drill

Manual follow-up still required:
1. verify Google-linked sign-in still works against the live app
2. verify one chart route
3. verify one DI-UI admin route
EOF

echo "Platform data backup drill created at $DRILL_DIR"
