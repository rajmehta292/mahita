import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.cwd())
const dataRoot = path.join(repoRoot, 'data')
const vaultsRoot = path.join(dataRoot, 'vaults')
const lakeRoot = path.join(dataRoot, 'lake')

export function getRepoRoot() {
  return repoRoot
}

export function getDataRoot() {
  return dataRoot
}

export function getVaultsRoot() {
  return vaultsRoot
}

export function getLakeRoot() {
  return lakeRoot
}

export function ensureDirectory(targetPath: string) {
  if (!fs.existsSync(targetPath)) {
    fs.mkdirSync(targetPath, { recursive: true })
  }

  return targetPath
}
