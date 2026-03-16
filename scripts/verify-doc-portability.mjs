import fs from 'node:fs/promises'
import path from 'node:path'
import { runChecked } from './lib/command-runner.mjs'
import { ROOT, containsMacOnlyPath, MAC_PATH_PATTERNS, shouldScanPortableFile } from './lib/path-portability.mjs'

function listTrackedFiles() {
  const result = runChecked('git', ['ls-files', '-z'])
  return result.stdout
    .split('\0')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

const findings = []

for (const repoRelativePath of listTrackedFiles().filter(shouldScanPortableFile)) {
  const absolutePath = path.join(ROOT, repoRelativePath)
  const content = await fs.readFile(absolutePath, 'utf8')

  if (!containsMacOnlyPath(content)) {
    continue
  }

  const lines = content.split(/\r?\n/)
  lines.forEach((line, index) => {
    const matchedPattern = MAC_PATH_PATTERNS.find((pattern) => line.includes(pattern))
    if (matchedPattern) {
      findings.push({
        file: repoRelativePath,
        line: index + 1,
        pattern: matchedPattern,
        text: line.trim(),
      })
    }
  })
}

if (findings.length > 0) {
  console.error(`Found ${findings.length} non-portable path reference(s) in README/docs/generated artifacts:`)
  for (const finding of findings.slice(0, 200)) {
    console.error(`- ${finding.file}:${finding.line} -> ${finding.text}`)
  }
  process.exit(1)
}

console.log('README/docs/generated portability check passed.')
