const DASHBOARD_PATH = "/dashboard"
export const SIGNUP_PATH = "/signup"
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000

export const AUTH_POST_SIGNIN_PATH = "/auth/post-signin"

function normalizePath(path?: string | null) {
    if (!path) {
        return null
    }

    const trimmed = path.trim()
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        return null
    }

    if (
        trimmed === "/" ||
        trimmed.startsWith("/auth") ||
        trimmed.startsWith("/api")
    ) {
        return null
    }

    return trimmed
}

function isRecentEnough(timestamp?: Date | string | null) {
    if (!timestamp) {
        return false
    }

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
        return false
    }

    return Date.now() - date.getTime() <= TWELVE_HOURS_MS
}

export function resolveSignedInHomePath(input?: {
    lastVisitedPath?: string | null
    lastSignInAt?: Date | string | null
}) {
    const lastVisitedPath = normalizePath(input?.lastVisitedPath)
    const signedInRecently = isRecentEnough(input?.lastSignInAt)

    if (signedInRecently && lastVisitedPath) {
        return lastVisitedPath
    }

    return DASHBOARD_PATH
}

export function resolvePostSignInPath(input?: {
    lastVisitedPath?: string | null
    previousSignInAt?: Date | string | null
}) {
    const lastVisitedPath = normalizePath(input?.lastVisitedPath)
    const signedInRecently = isRecentEnough(input?.previousSignInAt)

    if (!input?.previousSignInAt && !lastVisitedPath) {
        return SIGNUP_PATH
    }

    if (signedInRecently && lastVisitedPath) {
        return lastVisitedPath
    }

    return DASHBOARD_PATH
}

export function isTrackableAuthenticatedPath(path?: string | null) {
    return Boolean(normalizePath(path))
}

export function resolveClientCallbackUrl(path: string) {
    if (typeof window === "undefined") {
        return path
    }

    try {
        return new URL(path, window.location.origin).toString()
    } catch {
        return path
    }
}
