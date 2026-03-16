import fs from 'fs/promises'
import path from 'path'
import { CANONICAL_DOCS, SOURCE_PATHS } from './lib/mahacharts-context.mjs'

const ROOT = process.cwd()
const markdownLinkPattern = /\[[^\]]+\]\(([^)]+)\)/g

async function assertExists(targetPath, label) {
  try {
    await fs.access(targetPath)
  } catch {
    console.error(`${label} does not exist: ${targetPath}`)
    process.exit(1)
  }
}

for (const relativePath of CANONICAL_DOCS) {
  const absolutePath = path.join(ROOT, relativePath)
  await assertExists(absolutePath, 'Canonical MahaCharts doc')

  const content = await fs.readFile(absolutePath, 'utf8')
  for (const match of content.matchAll(markdownLinkPattern)) {
    const href = match[1]

    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('#')
    ) {
      continue
    }

    const [target] = href.split('#')
    await assertExists(path.resolve(path.dirname(absolutePath), target), 'Linked MahaCharts file')
  }
}

for (const group of Object.values(SOURCE_PATHS)) {
  for (const relativePath of group) {
    await assertExists(path.join(ROOT, relativePath), 'MahaCharts source reference')
  }
}

console.log('MahaCharts doc links and referenced files are valid.')
