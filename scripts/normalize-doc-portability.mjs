import fs from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'
import { ROOT, normalizeMarkdownPortability, shouldScanPortableFile } from './lib/path-portability.mjs'

function listTrackedFiles() {
  const result = runChecked('git', ['ls-files', '-z'])
  return result.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const trackedFiles = listTrackedFiles()
const markdownFiles = trackedFiles.filter((file) => shouldScanPortableFile(file) && /\.(md|mdx)$/i.test(file))

let updatedFiles = 0

for (const repoRelativePath of markdownFiles) {
  const absolutePath = path.join(ROOT, repoRelativePath)
  const original = await fs.readFile(absolutePath, 'utf8')
  const normalized = normalizeMarkdownPortability(original, absolutePath)

  if (normalized !== original) {
    await fs.writeFile(absolutePath, normalized)
    updatedFiles += 1
  }
}

console.log(`Normalized portability links in ${updatedFiles} Markdown file(s).`)
