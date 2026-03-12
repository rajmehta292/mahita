import { afterEach, describe, expect, it, vi } from "vitest"
import {
  getBootstrapSuperuserEmails,
  getRouteAccessPolicy,
  isBootstrapSuperuserEmail,
  resolvePersistedAppRole,
} from "@/lib/auth-policy"

describe("auth-policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("includes the default bootstrap superuser and configured admin emails", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com, admin@example.com ")

    const emails = getBootstrapSuperuserEmails()

    expect(emails.has("raj.dmehta292@gmail.com")).toBe(true)
    expect(emails.has("owner@example.com")).toBe(true)
    expect(emails.has("admin@example.com")).toBe(true)
  })

  it("treats configured bootstrap emails as superuser seeds", () => {
    vi.stubEnv("ADMIN_EMAILS", "owner@example.com")

    expect(isBootstrapSuperuserEmail("owner@example.com")).toBe(true)
    expect(isBootstrapSuperuserEmail("OWNER@example.com")).toBe(true)
    expect(isBootstrapSuperuserEmail("someone@example.com")).toBe(false)
  })

  it("prefers a persisted non-default role over bootstrap heuristics", () => {
    expect(
      resolvePersistedAppRole({
        persistedRole: "ADMIN",
        email: "raj.dmehta292@gmail.com",
      })
    ).toBe("ADMIN")
  })

  it("bootstraps the default superuser when only a default role exists", () => {
    expect(
      resolvePersistedAppRole({
        persistedRole: "USER",
        email: "raj.dmehta292@gmail.com",
      })
    ).toBe("SUPERUSER")
  })

  it("returns the documented route access policies", () => {
    expect(getRouteAccessPolicy("signedIn")).toMatchObject({
      requireAdmin: false,
      requireSuperuser: false,
    })
    expect(getRouteAccessPolicy("admin")).toMatchObject({
      requireAdmin: true,
      requireSuperuser: false,
    })
    expect(getRouteAccessPolicy("superuser")).toMatchObject({
      requireAdmin: false,
      requireSuperuser: true,
    })
  })
})
