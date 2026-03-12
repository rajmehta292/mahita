import { SchwabConfig } from "@prisma/client"
import { getPublicAppOrigin, isLocalhostOrigin } from "@/lib/auth-environment"
import { decryptSecret, encryptSecret } from "@/lib/secrets"

export type ResolvedSchwabConfig = Omit<
  SchwabConfig,
  "clientSecret" | "accessToken" | "refreshToken"
> & {
  clientSecret: string | null
  accessToken: string | null
  refreshToken: string | null
}

export function getSchwabCallbackUrl(baseUrl?: string | null) {
  const origin = (baseUrl?.trim() || getPublicAppOrigin()).replace(/\/$/, "")
  return `${origin}/schwab/callback`
}

function allowLocalSchwabOAuth() {
  return process.env.MAHITA_ALLOW_LOCAL_SCHWAB_OAUTH === "true"
}

export function getInteractiveSchwabOAuthConfig(requestOrigin?: string | null) {
  const sanitizedOrigin = requestOrigin?.trim().replace(/\/$/, "") || null

  if (sanitizedOrigin && !isLocalhostOrigin(sanitizedOrigin)) {
    return {
      supported: true,
      interactiveOrigin: sanitizedOrigin,
      callbackUrl: getSchwabCallbackUrl(sanitizedOrigin),
      reason: null,
    }
  }

  if (sanitizedOrigin && isLocalhostOrigin(sanitizedOrigin) && allowLocalSchwabOAuth()) {
    return {
      supported: true,
      interactiveOrigin: sanitizedOrigin,
      callbackUrl: getSchwabCallbackUrl(sanitizedOrigin),
      reason: null,
    }
  }

  return {
    supported: false,
    interactiveOrigin: null,
    callbackUrl: getSchwabCallbackUrl(),
    reason:
      "Live Schwab OAuth is only supported on the public Mahita app origin right now. Use https://mahita.ai to complete brokerage authorization.",
  }
}

export function resolveSchwabConfig(config: SchwabConfig): ResolvedSchwabConfig {
  return {
    ...config,
    clientSecret: decryptSecret(config.clientSecret),
    accessToken: decryptSecret(config.accessToken),
    refreshToken: decryptSecret(config.refreshToken),
  }
}

export function encryptSchwabSecrets(input: {
  clientSecret?: string
  accessToken?: string | null
  refreshToken?: string | null
}) {
  const encrypted: {
    clientSecret?: string
    accessToken?: string | null
    refreshToken?: string | null
  } = {}

  if (input.clientSecret !== undefined) {
    encrypted.clientSecret = encryptSecret(input.clientSecret) ?? undefined
  }

  if (input.accessToken !== undefined) {
    encrypted.accessToken =
      input.accessToken === null ? null : encryptSecret(input.accessToken) ?? null
  }

  if (input.refreshToken !== undefined) {
    encrypted.refreshToken =
      input.refreshToken === null
        ? null
        : encryptSecret(input.refreshToken) ?? null
  }

  return encrypted
}
