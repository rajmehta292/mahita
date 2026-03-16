import fs from 'node:fs'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'
import { loadEnvFile } from './lib/env-loader.mjs'

const ROOT = process.cwd()
const args = new Set(process.argv.slice(2))
const mode = process.argv.includes('--mode=build') ? 'build' : 'dev'
const MAIN_SCHEMA = path.join(ROOT, 'prisma', 'schema.prisma')
const GENERATED_SCHEMA = path.join(ROOT, 'node_modules', '.prisma', 'client', 'schema.prisma')
const PRISMA_CLI = path.join(ROOT, 'node_modules', 'prisma', 'build', 'index.js')
const NEXT_DEV_LOCK = path.join(ROOT, '.next', 'dev', 'lock')
const DEFAULT_VAULTS = ['schwab', 'yahoo', 'google', 'ollama', 'csv', 'master']
const ACTIVE_NEXT_DIST_DIR = process.env.NEXT_DIST_DIR || '.next'

function toSqliteFileUrl(targetPath) {
  const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.resolve(ROOT, targetPath)
  return `file:${absolutePath.replace(/\\/g, '/')}`
}

function resolveDatabaseUrl(rawUrl) {
  if (!rawUrl.startsWith('file:')) {
    return rawUrl
  }

  const filePath = rawUrl.slice('file:'.length)
  return toSqliteFileUrl(filePath)
}

function shouldGeneratePrismaClient() {
  if (!fs.existsSync(GENERATED_SCHEMA)) {
    return true
  }

  const sourceTime = fs.statSync(MAIN_SCHEMA).mtimeMs
  const generatedTime = fs.statSync(GENERATED_SCHEMA).mtimeMs
  return sourceTime > generatedTime
}

function ensureBuildPreconditions() {
  if (mode !== 'build') {
    return
  }

  if (ACTIVE_NEXT_DIST_DIR === '.next' && fs.existsSync(NEXT_DEV_LOCK)) {
    throw new Error('Refusing to run build preparation while the Next dev server lock is present. Stop the dev server before running npm run build.')
  }
}

function ensureVaultDirectory() {
  fs.mkdirSync(path.join(ROOT, 'data', 'vaults'), { recursive: true })
}

function ensureVaultDatabases() {
  ensureVaultDirectory()

  for (const vaultName of DEFAULT_VAULTS) {
    const vaultPath = path.join(ROOT, 'data', 'vaults', `${vaultName}.db`)
    if (!fs.existsSync(vaultPath)) {
      fs.closeSync(fs.openSync(vaultPath, 'a'))
    }

    const vaultUrl = toSqliteFileUrl(vaultPath)
    runChecked('node', [PRISMA_CLI, 'db', 'push', '--skip-generate'], {
      cwd: ROOT,
      stdio: 'pipe',
      env: {
        ...process.env,
        DATABASE_URL: vaultUrl,
      },
    })
  }
}

function tryPrismaGenerate() {
  try {
    runChecked('node', [PRISMA_CLI, 'generate'], {
      cwd: ROOT,
      stdio: 'pipe',
    })
  } catch (error) {
    if (process.platform === 'win32' && error instanceof Error && /EPERM|rename/i.test(error.message)) {
      throw new Error('Prisma client regeneration failed because a Windows file lock is still held. Stop the dev server and any watcher holding node_modules/.prisma, then retry.')
    }

    throw error
  }
}

ensureBuildPreconditions()
runChecked('node', ['scripts/sync-monaco.mjs'], { cwd: ROOT, stdio: 'pipe' })

if (shouldGeneratePrismaClient()) {
  tryPrismaGenerate()
}

ensureVaultDatabases()

if (args.has('--push-main-db')) {
  const envFromFile = await loadEnvFile('.env.local', ROOT)
  runChecked('node', [PRISMA_CLI, 'db', 'push'], {
    cwd: ROOT,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...envFromFile,
      DATABASE_URL: resolveDatabaseUrl(envFromFile.DATABASE_URL ?? process.env.DATABASE_URL ?? ''),
    },
  })
}

console.log(`Runtime preparation completed for ${mode} mode.`)
