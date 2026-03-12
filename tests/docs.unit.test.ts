// @vitest-environment node

import { describe, expect, it } from "vitest"
import { getDocBySlug, getVisibleDocs } from "@/lib/docs"

describe("docs", () => {
  it("surfaces public docs to signed-out viewers", async () => {
    const docs = await getVisibleDocs(false)

    expect(docs.some((doc) => doc.slug === "project-overview/executive-overview")).toBe(true)
    expect(docs.some((doc) => doc.slug === "project-overview/how-to-use-this-documentation")).toBe(true)
    expect(docs.every((doc) => doc.visibility === "public")).toBe(true)
  })

  it("reveals internal docs to signed-in viewers", async () => {
    const docs = await getVisibleDocs(true)

    expect(docs.some((doc) => doc.slug === "guidebook/documentation-maintenance")).toBe(true)
    expect(docs.some((doc) => doc.visibility === "signed-in")).toBe(true)
  })

  it("flags signed-in docs as protected for signed-out viewers", async () => {
    const resolved = await getDocBySlug(["guidebook", "documentation-maintenance"], false)

    expect(resolved?.requiresAuth).toBe(true)
    expect(resolved?.doc.title).toContain("Documentation Maintenance")
  })
})
