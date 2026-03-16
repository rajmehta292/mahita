import fs from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'

const ROOT = process.cwd()
const OUTPUT_DIR = path.join(ROOT, 'artifacts', 'senior-project')
const STAGING_DIR = path.join(OUTPUT_DIR, 'mahita-demo-bundle')
const ZIP_PATH = path.join(OUTPUT_DIR, 'mahita-demo-bundle.zip')

const EXCLUDED_PREFIXES = [
  '.git',
  '.next',
  '.next-playwright',
  'node_modules',
  'test-results',
  'tmp',
  'artifacts',
]

const EXCLUDED_FILES = new Set([
  '.DS_Store',
  '.env',
  '.env.local',
  'demo.db',
  'dev.db',
  'prisma/dev.db',
])

function shouldCopy(relativePath) {
  if (!relativePath) {
    return true
  }

  if (EXCLUDED_FILES.has(relativePath)) {
    return false
  }

  if (relativePath.endsWith('.zip') || relativePath.endsWith('.log')) {
    return false
  }

  if (relativePath.startsWith('data/vaults/') && relativePath.endsWith('.db')) {
    return false
  }

  return !EXCLUDED_PREFIXES.some((prefix) => relativePath === prefix || relativePath.startsWith(`${prefix}/`))
}

await fs.mkdir(OUTPUT_DIR, { recursive: true })
await fs.rm(STAGING_DIR, { recursive: true, force: true })
await fs.rm(ZIP_PATH, { force: true })

await fs.cp(ROOT, STAGING_DIR, {
  recursive: true,
  filter: (_source, destination) => {
    const relativePath = path.relative(ROOT, destination)
    return shouldCopy(relativePath)
  },
})

if (process.platform === 'win32') {
  runChecked('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path "${STAGING_DIR}" -DestinationPath "${ZIP_PATH}" -Force`,
  ], { cwd: ROOT, stdio: 'pipe' })
} else {
  runChecked('zip', ['-qr', ZIP_PATH, path.basename(STAGING_DIR)], {
    cwd: OUTPUT_DIR,
    stdio: 'pipe',
  })
}

console.log(`Created ${ZIP_PATH}`)
