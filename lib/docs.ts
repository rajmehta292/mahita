import fs from "fs/promises"
import path from "path"
import { cache } from "react"

export type DocVisibility = "public" | "signed-in"
export type DocStatus = "Current" | "Transitional" | "Historical" | "Superseded"
export type DocCategory =
  | "project-overview"
  | "senior-project"
  | "guidebook"
  | "evidence"
  | "runbook"
  | "status"
  | "archive"

export interface DocFrontmatter {
  title?: string
  slug?: string
  category?: DocCategory
  visibility?: DocVisibility
  audience?: string
  status?: DocStatus
  order?: number
  updatedAt?: string
}

export interface DocRecord {
  title: string
  slug: string
  category: DocCategory
  visibility: DocVisibility
  audience: string
  status: DocStatus
  order: number
  updatedAt: string
  description: string
  relativePath: string
  sourcePath: string
  content: string
}

const DOCS_ROOT = path.join(process.cwd(), "docs")
const CURRENT_DOC_PATTERNS: Array<{
  pattern: RegExp
  defaults: Partial<DocFrontmatter>
}> = [
  {
    pattern: /^internal\/evidence\/archive\//,
    defaults: { visibility: "signed-in", status: "Historical", category: "archive", audience: "developers" },
  },
  {
    pattern: /^public\//,
    defaults: { visibility: "public", status: "Current", audience: "public" },
  },
  {
    pattern: /^internal\/guidebook\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "developers" },
  },
  {
    pattern: /^internal\/generated\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "developers" },
  },
  {
    pattern: /^internal\/evidence\//,
    defaults: { visibility: "signed-in", status: "Current", category: "evidence", audience: "reviewers" },
  },
  {
    pattern: /^internal\/runbooks\//,
    defaults: { visibility: "signed-in", status: "Current", category: "runbook", audience: "operators" },
  },
  {
    pattern: /^guidebook\/auth\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "developers" },
  },
  {
    pattern: /^security\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "security reviewers" },
  },
  {
    pattern: /^execution\//,
    defaults: { visibility: "signed-in", status: "Current", category: "status", audience: "operators" },
  },
  {
    pattern: /^qa\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "testers" },
  },
  {
    pattern: /^desktop\//,
    defaults: { visibility: "signed-in", status: "Current", category: "guidebook", audience: "operators" },
  },
  {
    pattern: /^current_state_baseline\.md$/,
    defaults: { visibility: "signed-in", status: "Transitional", category: "status", audience: "operators" },
  },
]

function normalizeWhitespace(value: string) {
  return value.replace(/\r\n/g, "\n")
}

function stripQuotes(value: string) {
  return value.replace(/^['"]|['"]$/g, "")
}

function parseFrontmatter(source: string): { frontmatter: DocFrontmatter; content: string } {
  const normalized = normalizeWhitespace(source)
  if (!normalized.startsWith("---\n")) {
    return { frontmatter: {}, content: normalized }
  }

  const endIndex = normalized.indexOf("\n---\n", 4)
  if (endIndex === -1) {
    return { frontmatter: {}, content: normalized }
  }

  const rawFrontmatter = normalized.slice(4, endIndex)
  const content = normalized.slice(endIndex + 5)
  const frontmatter: DocFrontmatter = {}

  for (const line of rawFrontmatter.split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) {
      continue
    }

    const separatorIndex = trimmed.indexOf(":")
    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim() as keyof DocFrontmatter
    const rawValue = stripQuotes(trimmed.slice(separatorIndex + 1).trim())

    if (!rawValue) {
      continue
    }

    if (key === "order") {
      frontmatter.order = Number(rawValue)
      continue
    }

    if (key === "category") {
      frontmatter.category = rawValue as DocCategory
      continue
    }

    if (key === "visibility") {
      frontmatter.visibility = rawValue as DocVisibility
      continue
    }

    if (key === "status") {
      frontmatter.status = rawValue as DocStatus
      continue
    }

    frontmatter[key] = rawValue
  }

  return { frontmatter, content }
}

function titleFromFileName(relativePath: string) {
  const name = relativePath
    .split("/")
    .pop()
    ?.replace(/\.md$/, "")
    .replace(/[-_]/g, " ")
    .trim()

  return name
    ? name.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Documentation"
}

function titleFromContent(content: string) {
  const heading = content
    .split("\n")
    .find((line) => line.trim().startsWith("# "))
    ?.replace(/^# /, "")
    .trim()

  return heading || null
}

function inferCategory(relativePath: string): DocCategory {
  if (relativePath.startsWith("public/project-overview/")) return "project-overview"
  if (relativePath.startsWith("public/senior-project/")) return "senior-project"
  if (relativePath.startsWith("internal/guidebook/") || relativePath.startsWith("guidebook/")) return "guidebook"
  if (relativePath.startsWith("internal/evidence/")) return "evidence"
  if (relativePath.startsWith("internal/runbooks/")) return "runbook"
  if (relativePath.startsWith("execution/") || relativePath === "current_state_baseline.md") return "status"
  return "archive"
}

function inferDefaults(relativePath: string): Partial<DocFrontmatter> {
  const matched = CURRENT_DOC_PATTERNS.find(({ pattern }) => pattern.test(relativePath))
  if (matched) {
    return matched.defaults
  }

  return {
    visibility: "signed-in",
    status: "Historical",
    category: "archive",
    audience: "developers",
  }
}

function extractDescription(content: string) {
  const paragraph = content
    .split("\n\n")
    .map((block) => block.replace(/^#+\s+/gm, "").trim())
    .find((block) => block.length > 40)

  return paragraph ? paragraph.slice(0, 220) : "Documentation entry"
}

function buildSlug(relativePath: string, frontmatter: DocFrontmatter) {
  if (frontmatter.slug) {
    return frontmatter.slug.replace(/^\/+|\/+$/g, "")
  }

  return relativePath.replace(/\.md$/, "").replace(/^(public|internal)\//, "")
}

async function walkDocs(dirPath: string, relativeDir = ""): Promise<string[]> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDir, entry.name)
    const absolutePath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await walkDocs(absolutePath, relativePath)))
      continue
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(relativePath)
    }
  }

  return files
}

const readAllDocs = cache(async (): Promise<DocRecord[]> => {
  const relativePaths = await walkDocs(DOCS_ROOT)

  const docs = await Promise.all(
    relativePaths.map(async (relativePath) => {
      const sourcePath = path.join(DOCS_ROOT, relativePath)
      const rawSource = await fs.readFile(sourcePath, "utf8")
      const stats = await fs.stat(sourcePath)
      const { frontmatter, content } = parseFrontmatter(rawSource)
      const defaults = inferDefaults(relativePath)

      const title =
        frontmatter.title ||
        titleFromContent(content) ||
        titleFromFileName(relativePath)

      return {
        title,
        slug: buildSlug(relativePath, frontmatter),
        category: frontmatter.category || defaults.category || inferCategory(relativePath),
        visibility: frontmatter.visibility || defaults.visibility || "signed-in",
        audience: frontmatter.audience || defaults.audience || "developers",
        status: frontmatter.status || defaults.status || "Historical",
        order: frontmatter.order ?? 999,
        updatedAt: frontmatter.updatedAt || stats.mtime.toISOString().slice(0, 10),
        description: extractDescription(content),
        relativePath,
        sourcePath,
        content,
      } satisfies DocRecord
    })
  )

  return docs.sort((left, right) => {
    if (left.category !== right.category) {
      return left.category.localeCompare(right.category)
    }

    if (left.order !== right.order) {
      return left.order - right.order
    }

    return left.title.localeCompare(right.title)
  })
})

export async function getVisibleDocs(viewerSignedIn: boolean) {
  const docs = await readAllDocs()
  return docs.filter((doc) => viewerSignedIn || doc.visibility === "public")
}

export async function getDocBySlug(slugParts: string[], viewerSignedIn: boolean) {
  const docs = await readAllDocs()
  const slug = slugParts.join("/")
  const match = docs.find((doc) => doc.slug === slug)

  if (!match) {
    return null
  }

  if (!viewerSignedIn && match.visibility === "signed-in") {
    return {
      doc: match,
      requiresAuth: true,
    }
  }

  return {
    doc: match,
    requiresAuth: false,
  }
}

export function groupDocsByCategory(docs: DocRecord[]) {
  const grouped = new Map<DocCategory, DocRecord[]>()

  for (const doc of docs) {
    const list = grouped.get(doc.category) ?? []
    list.push(doc)
    grouped.set(doc.category, list)
  }

  return grouped
}

export function getDocCategoryLabel(category: DocCategory) {
  switch (category) {
    case "project-overview":
      return "Project Overview"
    case "senior-project":
      return "Senior Project"
    case "guidebook":
      return "Guidebook"
    case "evidence":
      return "Evidence"
    case "runbook":
      return "Runbooks"
    case "status":
      return "Current State"
    case "archive":
      return "Historical Archive"
    default:
      return "Documentation"
  }
}

export function getDocHref(slug: string) {
  return `/docs/${slug}`
}
