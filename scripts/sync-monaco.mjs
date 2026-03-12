import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')
const sourceDir = resolve(projectRoot, 'node_modules/monaco-editor/min/vs')
const targetDir = resolve(projectRoot, 'public/monaco/vs')

if (!existsSync(sourceDir)) {
  console.error(`Monaco source assets not found at ${sourceDir}`)
  process.exit(1)
}

mkdirSync(dirname(targetDir), { recursive: true })
cpSync(sourceDir, targetDir, { recursive: true, force: true })
console.log(`Synced Monaco assets to ${targetDir}`)
