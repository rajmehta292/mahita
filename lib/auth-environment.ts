const DEFAULT_DEV_PORT = "6244"
const DEFAULT_PRODUCTION_ORIGIN = "https://mahita.ai"

export function isLocalhostOrigin(origin: string) {
  try {
    const url = new URL(origin)
    return url.hostname === "localhost" || url.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

function getDefaultDevOrigin() {
  const port =
    process.env.PORT?.trim() ||
    process.env.NEXT_PUBLIC_APP_PORT?.trim() ||
    DEFAULT_DEV_PORT

  return `http://localhost:${port}`
}

function sanitizeOrigin(origin?: string | null) {
  return origin?.trim().replace(/\/$/, "") || null
}

function getConfiguredAuthOrigin() {
  return sanitizeOrigin(process.env.NEXTAUTH_URL)
}

export function getPublicAppOrigin() {
  return (
    sanitizeOrigin(process.env.MAHITA_PUBLIC_APP_ORIGIN) ||
    sanitizeOrigin(process.env.NEXT_PUBLIC_APP_ORIGIN) ||
    DEFAULT_PRODUCTION_ORIGIN
  )
}

export function getRequestOriginFromHeaders(
  headers?: Headers | Record<string, string | string[] | undefined> | null
) {
  if (!headers) {
    return null
  }

  const getHeader = (name: string) => {
    if (headers instanceof Headers) {
      return headers.get(name)
    }

    const value = headers[name]
    if (Array.isArray(value)) {
      return value[0] ?? null
    }

    return value ?? null
  }

  const host = getHeader("x-forwarded-host") || getHeader("host")
  if (!host) {
    return null
  }

  const protocol =
    getHeader("x-forwarded-proto") ||
    (host.includes("localhost") || host.startsWith("127.0.0.1") ? "http" : "https")

  return sanitizeOrigin(`${protocol}://${host}`)
}

export function isGoogleAuthEnabled() {
  if (!isGoogleAuthConfigured()) {
    return false
  }

  const configuredOrigin = getConfiguredAuthOrigin()
  if (configuredOrigin && !isLocalhostOrigin(configuredOrigin)) {
    return true
  }

  return process.env.NODE_ENV !== "development"
}

export function isGoogleAuthEnabledForOrigin(requestOrigin?: string | null) {
  if (!isGoogleAuthEnabled()) {
    return false
  }

  if (!requestOrigin) {
    return true
  }

  if (isLocalhostOrigin(requestOrigin)) {
    return false
  }

  return true
}

export function isDevBypassEnabledForOrigin(requestOrigin?: string | null) {
  if (process.env.ENABLE_DEV_AUTH_BYPASS !== "true") {
    return false
  }

  if (!requestOrigin) {
    return true
  }

  return isLocalhostOrigin(requestOrigin)
}

export function getAuthMode() {
  if (process.env.NODE_ENV !== "development") {
    return isGoogleAuthEnabled() ? "production-google" : "production-misconfigured"
  }

  if (isGoogleAuthEnabled()) {
    return "development-public-google"
  }

  return "development-bypass"
}

export function normalizeAuthEnvironment() {
  if (process.env.NODE_ENV !== "development") {
    return
  }

  const configuredOrigin = getConfiguredAuthOrigin()
  if (configuredOrigin) {
    if (isLocalhostOrigin(configuredOrigin)) {
      process.env.NEXTAUTH_URL = getDefaultDevOrigin()
    }
    return
  }

  process.env.NEXTAUTH_URL = getDefaultDevOrigin()
}

export function getAuthBaseUrl() {
  normalizeAuthEnvironment()

  return (
    process.env.NEXTAUTH_URL?.trim() ||
    (process.env.NODE_ENV === "development"
      ? getDefaultDevOrigin()
      : DEFAULT_PRODUCTION_ORIGIN)
  )
}

export function isGoogleAuthConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() &&
      process.env.GOOGLE_CLIENT_SECRET?.trim()
  )
}

export function getAuthHealthSnapshot() {
  const authBaseUrl = getAuthBaseUrl()
  const googleSignInEnabled = isGoogleAuthEnabled()
  const publicAppOrigin = getPublicAppOrigin()
  const authMode = getAuthMode()

  return {
    authMode,
    authBaseUrl,
    publicAppOrigin,
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    hasGoogleProvider: isGoogleAuthConfigured(),
    googleSignInEnabled,
    hasDedicatedAppSecretKey: Boolean(
      process.env.MAHITA_SECRET_KEY?.trim() || process.env.ENCRYPTION_KEY?.trim()
    ),
    devBypassEnabled: process.env.ENABLE_DEV_AUTH_BYPASS === "true",
    usesSafeLocalOrigin:
      process.env.NODE_ENV !== "development" || isLocalhostOrigin(authBaseUrl),
    allowDevGoogleAuth: false,
  }
}

export function getAuthHealthSnapshotForOrigin(requestOrigin?: string | null) {
  const authBaseUrl = getAuthBaseUrl()
  const publicAppOrigin = getPublicAppOrigin()
  const authMode = getAuthMode()
  const googleSignInEnabled = isGoogleAuthEnabledForOrigin(requestOrigin)
  const devBypassEnabled = isDevBypassEnabledForOrigin(requestOrigin)

  return {
    authMode,
    authBaseUrl,
    publicAppOrigin,
    requestOrigin: requestOrigin ?? null,
    hasNextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET?.trim()),
    hasGoogleProvider: isGoogleAuthConfigured(),
    googleSignInEnabled,
    hasDedicatedAppSecretKey: Boolean(
      process.env.MAHITA_SECRET_KEY?.trim() || process.env.ENCRYPTION_KEY?.trim()
    ),
    devBypassEnabled,
    usesSafeLocalOrigin:
      !requestOrigin ||
      !isLocalhostOrigin(requestOrigin) ||
      isLocalhostOrigin(authBaseUrl) ||
      devBypassEnabled,
    allowDevGoogleAuth: false,
  }
}
