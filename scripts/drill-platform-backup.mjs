#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT_DIR,
  copyDirectoryContents,
  countFiles,
  formatStamp,
} from './platform-data-common.mjs'
import { runChecked } from './lib/command-runner.mjs'

const drillDir = path.join(ROOT_DIR, 'artifacts', 'platform-data-backups', `drill-${formatStamp()}`)
const backupDir = path.join(drillDir, 'backup')
const sandboxDir = path.join(drillDir, 'sandbox')

await fs.mkdir(backupDir, { recursive: true })
await fs.mkdir(sandboxDir, { recursive: true })

runChecked('node', ['scripts/backup-platform-data.mjs', backupDir], {
  cwd: ROOT_DIR,
  stdio: 'pipe',
})

await Promise.all([
  copyDirectoryContents(path.join(backupDir, 'app-db'), path.join(sandboxDir, 'app-db')),
  copyDirectoryContents(path.join(backupDir, 'vaults'), path.join(sandboxDir, 'vaults')),
  copyDirectoryContents(path.join(backupDir, 'lake'), path.join(sandboxDir, 'lake')),
  copyDirectoryContents(path.join(backupDir, 'logs'), path.join(sandboxDir, 'logs')),
])

const manifest = JSON.parse(await fs.readFile(path.join(backupDir, 'manifest.json'), 'utf8'))
const summary = {
  generatedAt: new Date().toISOString(),
  manifestAuthState: manifest.authState,
  manifestProviderState: manifest.providerState,
  manifestInventoryState: manifest.inventoryState,
  sandbox: {
    appDbFiles: await countFiles(path.join(sandboxDir, 'app-db')),
    vaultFiles: await countFiles(path.join(sandboxDir, 'vaults')),
    lakeFiles: await countFiles(path.join(sandboxDir, 'lake')),
    logFiles: await countFiles(path.join(sandboxDir, 'logs')),
  },
  manualFollowUp: [
    'Sign in as an existing Google-linked user against the live app after backup creation.',
    'Load one chart-backed symbol and one DI-UI admin route.',
    'Confirm UserPreference, BrokerageConnection, and ProviderPoolMember rows still resolve.',
  ],
}

await fs.writeFile(path.join(drillDir, 'restore-summary.json'), JSON.stringify(summary, null, 2))
await fs.writeFile(path.join(drillDir, 'README.md'), `# Platform Data Backup Drill

- Created: ${new Date().toISOString()}
- Backup dir: ${backupDir}
- Sandbox dir: ${sandboxDir}

Files:
- \`backup/\`: exact platform-data backup snapshot
- \`sandbox/\`: copied restore target used for non-destructive drill validation
- \`restore-summary.json\`: manifest and file-count comparison for the drill

Manual follow-up still required:
1. verify Google-linked sign-in still works against the live app
2. verify one chart route
3. verify one DI-UI admin route
`)

console.log(`Platform data backup drill created at ${drillDir}`)
