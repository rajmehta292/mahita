import path from 'node:path'

export const ROOT = process.cwd()
export const MAC_REPO_ROOT = '/Users/rmehta01/Sites/mahita'
export const MAC_CODEX_HOME = '/Users/rmehta01/.codex'
export const MAC_PATH_PATTERNS = [
  `${MAC_REPO_ROOT}/`,
  `file://${MAC_REPO_ROOT}/`,
  `${MAC_CODEX_HOME}`,
]

export function toPosix(targetPath) {
  return targetPath.split(path.sep).join('/')
}

export function shouldScanPortableFile(repoRelativePath) {
  if (repoRelativePath === 'README.md') {
    return true
  }

  if (!repoRelativePath.startsWith('docs/')) {
    return false
  }

  if (repoRelativePath.startsWith('docs/internal/evidence/archive/')) {
    return false
  }

  return /\.(md|mdx|json)$/i.test(repoRelativePath)
}

export function containsMacOnlyPath(content) {
  return MAC_PATH_PATTERNS.some((pattern) => content.includes(pattern))
}

export function toPortableDocLink(sourceFile, repoRelativeTarget) {
  const relativeTarget = path.relative(path.dirname(sourceFile), path.join(ROOT, repoRelativeTarget))
  const normalized = toPosix(relativeTarget)
  return normalized === '' ? '.' : normalized
}

export function normalizeMarkdownPortability(content, sourceFile) {
  const markdownLinkPattern = /\]\((file:\/\/\/Users\/rmehta01\/Sites\/mahita\/|\/Users\/rmehta01\/Sites\/mahita\/)([^)#]+)(#[^)]+)?\)/g

  let nextContent = content.replace(markdownLinkPattern, (_match, _prefix, targetPath, anchor = '') => {
    return `](${toPortableDocLink(sourceFile, targetPath)}${anchor})`
  })

  nextContent = nextContent.replaceAll(MAC_CODEX_HOME, '$CODEX_HOME')

  return nextContent
}
