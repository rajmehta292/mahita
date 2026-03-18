#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import {
  ROOT_DIR,
  copyDirectoryContents,
  ensureDir,
  formatStamp,
  loadPlatformEnv,
  replaceDirectoryContents,
  resolveSqlitePath,
} from './platform-data-common.mjs'
import { runChecked } from './lib/command-runner.mjs'

const backupDir = process.argv[2] ? path.resolve(ROOT_DIR, process.argv[2]) : null

if (!backupDir) {
  console.error('Usage: node scripts/restore-platform-data.mjs <backup-dir>')
  process.exit(1)
}

if (!fs.existsSync(backupDir)) {
  console.error(`Backup directory not found: ${backupDir}`)
  process.exit(1)
}

const { env } = await loadPlatformEnv(ROOT_DIR)
const mainDbPath = resolveSqlitePath(env.DATABASE_URL, ROOT_DIR)
const preRestoreBackup = path.join(ROOT_DIR, 'artifacts', 'platform-data-backups', `pre-restore-${formatStamp()}`)

runChecked('node', ['scripts/backup-platform-data.mjs', preRestoreBackup], {
  cwd: ROOT_DIR,
  stdio: 'pipe',
})

if (mainDbPath && fs.existsSync(path.join(backupDir, 'app-db'))) {
  const files = fs.readdirSync(path.join(backupDir, 'app-db'))
  const sourceDb = files.length > 0 ? path.join(backupDir, 'app-db', files[0]) : null
  if (sourceDb) {
    await ensureDir(path.dirname(mainDbPath))
    await fs.promises.rm(mainDbPath, { force: true })
    await fs.promises.copyFile(sourceDb, mainDbPath)
  }
}

await replaceDirectoryContents(path.join(backupDir, 'vaults'), path.join(ROOT_DIR, 'data', 'vaults'))
await replaceDirectoryContents(path.join(backupDir, 'lake'), path.join(ROOT_DIR, 'data', 'lake'))
await copyDirectoryContents(path.join(backupDir, 'logs'), path.join(ROOT_DIR, 'logs'))

console.log(`Platform data restored from ${backupDir}`)
console.log(`Pre-restore snapshot saved to ${preRestoreBackup}`)
console.log('Run `node scripts/verify-platform-data.mjs` before using the app.')
