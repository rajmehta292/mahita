import fs from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'

const ROOT = process.cwd()
const demoEnv = path.join(ROOT, '.env.demo.example')
const localEnv = path.join(ROOT, '.env.local')
const demoDb = path.join(ROOT, 'demo.db')

async function ensureFileExists(targetPath) {
  try {
    await fs.access(targetPath)
  } catch {
    throw new Error(`Missing required file: ${path.relative(ROOT, targetPath)}`)
  }
}

await ensureFileExists(demoEnv)

await fs.copyFile(demoEnv, localEnv)
await fs.rm(demoDb, { force: true })

runChecked('npm', ['install'], { cwd: ROOT, stdio: 'pipe' })
runChecked('node', ['./scripts/prepare-runtime.mjs', '--mode=dev'], { cwd: ROOT, stdio: 'pipe' })
runChecked('npx', ['prisma', 'db', 'push', '--accept-data-loss'], {
  cwd: ROOT,
  stdio: 'pipe',
  env: {
    ...process.env,
    DATABASE_URL: 'file:./demo.db',
  },
})
runChecked('npx', ['tsx', 'scripts/seed-demo.mjs'], {
  cwd: ROOT,
  stdio: 'pipe',
  env: {
    ...process.env,
    DATABASE_URL: 'file:./demo.db',
  },
})

console.log('Demo bootstrap complete. Run npm run dev to start Mahita on http://localhost:6244.')
