import { DEFAULT_APP_ROLE, normalizeAppRole, type AppRole } from "@/lib/roles"

export const DEFAULT_SUPERUSER_EMAIL = "raj.dmehta292@gmail.com"

export const AUTH_LAYERS = [
  "public-identity",
  "session",
  "authorization",
  "brokerage-authorization",
  "operator-control-plane",
] as const

export type AuthLayer = (typeof AUTH_LAYERS)[number]

export const ROUTE_ACCESS_POLICIES = {
  signedIn: {
    key: "signedIn",
    label: "Signed-in session required",
    requireAdmin: false,
    requireSuperuser: false,
  },
  admin: {
    key: "admin",
    label: "Admin role required",
    requireAdmin: true,
    requireSuperuser: false,
  },
  superuser: {
    key: "superuser",
    label: "Superuser role required",
    requireAdmin: false,
    requireSuperuser: true,
  },
} as const

export type RouteAccessPolicyName = keyof typeof ROUTE_ACCESS_POLICIES

export function getBootstrapSuperuserEmails() {
  const configured =
    process.env.ADMIN_EMAILS
      ?.split(",")
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean) ?? []

  return new Set([DEFAULT_SUPERUSER_EMAIL, ...configured])
}

export function isBootstrapSuperuserEmail(email?: string | null) {
  if (!email) {
    return false
  }

  return getBootstrapSuperuserEmails().has(email.trim().toLowerCase())
}

export function resolvePersistedAppRole(input?: {
  persistedRole?: string | null
  email?: string | null
}) {
  const normalizedPersistedRole = normalizeAppRole(input?.persistedRole)

  if (normalizedPersistedRole !== DEFAULT_APP_ROLE) {
    return normalizedPersistedRole
  }

  if (isBootstrapSuperuserEmail(input?.email)) {
    return "SUPERUSER" satisfies AppRole
  }

  return DEFAULT_APP_ROLE
}

export function getRouteAccessPolicy(policy?: RouteAccessPolicyName | null) {
  return ROUTE_ACCESS_POLICIES[policy ?? "signedIn"]
}

