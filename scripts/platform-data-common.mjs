import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { loadEnvFile } from './lib/env-loader.mjs'
import { runChecked } from './lib/command-runner.mjs'

export const ROOT_DIR = process.cwd()

export function formatStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('') + '-' + [pad(date.getHours()), pad(date.getMinutes()), pad(date.getSeconds())].join('')
}

export async function findPlatformEnvFile(rootDir = ROOT_DIR) {
  for (const candidate of ['.env.local', '.env.demo.example', '.env.example']) {
    if (fs.existsSync(path.join(rootDir, candidate))) {
      return candidate
    }
  }

  throw new Error('No environment file found. Expected .env.local, .env.demo.example, or .env.example.')
}

export async function loadPlatformEnv(rootDir = ROOT_DIR) {
  const envFile = await findPlatformEnvFile(rootDir)
  const env = await loadEnvFile(envFile, rootDir)
  return { envFile, env }
}

export function resolveSqlitePath(databaseUrl, rootDir = ROOT_DIR) {
  if (!databaseUrl?.startsWith('file:')) {
    return null
  }

  const rawPath = databaseUrl.slice('file:'.length)
  return path.isAbsolute(rawPath) ? rawPath : path.join(rootDir, rawPath)
}

export async function ensureDir(dirPath) {
  await fsp.mkdir(dirPath, { recursive: true })
}

export async function copyFileIfExists(sourcePath, destinationDir) {
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    return null
  }

  await ensureDir(destinationDir)
  const destinationPath = path.join(destinationDir, path.basename(sourcePath))
  await fsp.copyFile(sourcePath, destinationPath)
  return destinationPath
}

export async function copyDirectoryContents(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir)) {
    return false
  }

  await ensureDir(destinationDir)
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true })
  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name)
    const destinationPath = path.join(destinationDir, entry.name)
    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, destinationPath)
      continue
    }

    if (entry.isFile()) {
      await ensureDir(path.dirname(destinationPath))
      await fsp.copyFile(sourcePath, destinationPath)
    }
  }
  return true
}

export async function replaceDirectoryContents(sourceDir, destinationDir) {
  if (!fs.existsSync(sourceDir)) {
    return false
  }

  await fsp.rm(destinationDir, { recursive: true, force: true })
  await ensureDir(destinationDir)
  return copyDirectoryContents(sourceDir, destinationDir)
}

export async function countFiles(dirPath) {
  try {
    const entries = await fsp.readdir(dirPath, { withFileTypes: true })
    let total = 0

    for (const entry of entries) {
      const absolutePath = path.join(dirPath, entry.name)
      if (entry.isDirectory()) {
        total += await countFiles(absolutePath)
      } else if (entry.isFile()) {
        total += 1
      }
    }

    return total
  } catch {
    return 0
  }
}

export async function runPlatformSnapshot(outputPath, env) {
  runChecked('node', ['scripts/platform-data-snapshot.mjs', '--output', outputPath], {
    cwd: ROOT_DIR,
    stdio: 'pipe',
    env: {
      ...process.env,
      ...env,
    },
  })
}
