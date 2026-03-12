export const APP_ROLES = ["USER", "ADMIN", "SUPERUSER"] as const

export type AppRole = (typeof APP_ROLES)[number]

export const DEFAULT_APP_ROLE: AppRole = "USER"

export function normalizeAppRole(role?: string | null): AppRole {
    if (!role) {
        return DEFAULT_APP_ROLE
    }

    if (APP_ROLES.includes(role as AppRole)) {
        return role as AppRole
    }

    return DEFAULT_APP_ROLE
}

export function isAdminRole(role?: string | null) {
    const normalizedRole = normalizeAppRole(role)
    return normalizedRole === "ADMIN" || normalizedRole === "SUPERUSER"
}

export function isSuperuserRole(role?: string | null) {
    return normalizeAppRole(role) === "SUPERUSER"
}
