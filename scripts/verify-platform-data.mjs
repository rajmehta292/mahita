#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import {
  ROOT_DIR,
  ensureDir,
  loadPlatformEnv,
  runPlatformSnapshot,
} from './platform-data-common.mjs'

const { env } = await loadPlatformEnv(ROOT_DIR)
const outputDir = path.join(ROOT_DIR, 'tmp', 'platform-data-verify')
const snapshotPath = path.join(outputDir, 'snapshot.json')

await ensureDir(outputDir)
await runPlatformSnapshot(snapshotPath, env)

const snapshot = JSON.parse(await fs.readFile(snapshotPath, 'utf8'))
const checks = [
  ['Users', snapshot.authState.userCount],
  ['Accounts', snapshot.authState.accountCount],
  ['Sessions', snapshot.authState.sessionCount],
  ['UserPreferences', snapshot.authState.userPreferenceCount],
  ['BrokerageConnections', snapshot.authState.brokerageConnectionCount],
  ['ProviderPoolMembers', snapshot.providerState.providerPoolMemberCount],
  ['DataInventory rows', snapshot.inventoryState.inventoryCount],
]

console.log(`==> Snapshot written to ${snapshotPath}`)
console.log('==> Main DB/Auth summary')
for (const [label, count] of checks) {
  console.log(`- ${label}: ${count}`)
}

console.log('==> Storage summary')
console.log(`- Canonical bar source: ${snapshot.storage.canonicalBarSource}`)
console.log(`- Vault count: ${snapshot.storage.vaults.length}`)
console.log(`- Parquet files: ${snapshot.storage.parquet.fileCount}`)
console.log(`- Telemetry log exists: ${snapshot.storage.telemetry.exists}`)

async function printHealth(url, label) {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeout)
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }

    const payload = await response.text()
    console.log(`==> ${label}`)
    console.log(payload)
  } catch {
    console.log(`==> ${label} skipped (local server not reachable on :6244)`)
  }
}

await printHealth('http://127.0.0.1:6244/api/health/runtime', 'Runtime health')
await printHealth('http://127.0.0.1:6244/api/health/auth', 'Auth health')

console.log('Platform data verification complete.')
