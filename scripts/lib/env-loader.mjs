import fs from 'node:fs/promises'
import path from 'node:path'

function parseEnvValue(value) {
  const trimmed = value.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }

  return trimmed
}

export async function loadEnvFile(relativePath = '.env.local', cwd = process.cwd()) {
  const absolutePath = path.join(cwd, relativePath)

  try {
    const content = await fs.readFile(absolutePath, 'utf8')
    const entries = Object.fromEntries(
      content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => {
          const separatorIndex = line.indexOf('=')
          if (separatorIndex === -1) {
            return [line, '']
          }

          const key = line.slice(0, separatorIndex).trim()
          const value = parseEnvValue(line.slice(separatorIndex + 1))
          return [key, value]
        }),
    )

    return entries
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return {}
    }

    throw error
  }
}
