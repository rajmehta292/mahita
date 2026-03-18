#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs/promises'
import {
  ROOT_DIR,
  copyDirectoryContents,
  copyFileIfExists,
  ensureDir,
  formatStamp,
  loadPlatformEnv,
  resolveSqlitePath,
  runPlatformSnapshot,
} from './platform-data-common.mjs'

const backupDir = process.argv[2]
  ? path.resolve(ROOT_DIR, process.argv[2])
  : path.join(ROOT_DIR, 'artifacts', 'platform-data-backups', formatStamp())

const { envFile, env } = await loadPlatformEnv(ROOT_DIR)
const mainDbPath = resolveSqlitePath(env.DATABASE_URL, ROOT_DIR)

await ensureDir(backupDir)
await Promise.all([
  ensureDir(path.join(backupDir, 'app-db')),
  ensureDir(path.join(backupDir, 'vaults')),
  ensureDir(path.join(backupDir, 'lake')),
  ensureDir(path.join(backupDir, 'logs')),
])

await copyFileIfExists(mainDbPath, path.join(backupDir, 'app-db'))
await copyDirectoryContents(path.join(ROOT_DIR, 'data', 'vaults'), path.join(backupDir, 'vaults'))
await copyDirectoryContents(path.join(ROOT_DIR, 'data', 'lake'), path.join(backupDir, 'lake'))
await copyFileIfExists(path.join(ROOT_DIR, 'logs', 'provider-traffic.jsonl'), path.join(backupDir, 'logs'))

await runPlatformSnapshot(path.join(backupDir, 'manifest.json'), env)

await fs.writeFile(path.join(backupDir, 'README.md'), `# Platform Data Backup

- Created: ${new Date().toISOString()}
- Root: ${ROOT_DIR}
- Environment file: ${envFile}
- Main DB: ${mainDbPath ?? 'not-file-based'}

Contents:
- \`app-db/\`: main Prisma app database snapshot when \`DATABASE_URL\` is SQLite
- \`vaults/\`: vault SQLite cache databases
- \`lake/\`: parquet/data-lake files, if present
- \`logs/\`: provider telemetry logs, if present
- \`manifest.json\`: inventory/auth/provider/storage snapshot taken at backup time
`)

console.log(`Platform data backup created at ${backupDir}`)
