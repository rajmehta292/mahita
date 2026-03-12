import type { Session } from "next-auth"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { isAdminRole, isSuperuserRole, normalizeAppRole, type AppRole } from "@/lib/roles"
import { getRouteAccessPolicy, type RouteAccessPolicyName } from "@/lib/auth-policy"
import { getAppServerSession } from "@/lib/server-session"

export interface RouteAccessSuccess {
  ok: true
  session: Session
  userId: string
  role: AppRole
}

export interface RouteAccessFailure {
  ok: false
  response: NextResponse
}

export type RouteAccessResult = RouteAccessSuccess | RouteAccessFailure

export function getPlatformCredentialIsolationError() {
  return "Platform jobs are configured to reject end-user Schwab brokerage credentials. Configure a dedicated provider pool before enabling shared ingestion."
}

export function allowInsecureUserBrokeragePlatformFallback() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK === "true"
  )
}

export function getBreakGlassRevealWindowMs() {
  const configured = Number(process.env.MAHITA_BREAK_GLASS_REVEAL_WINDOW_MS)
  if (Number.isFinite(configured) && configured >= 30_000) {
    return configured
  }

  return 60_000
}

export function getBreakGlassRecentAuthMaxAgeMinutes() {
  const configured = Number(process.env.MAHITA_BREAK_GLASS_RECENT_AUTH_MINUTES)
  if (Number.isFinite(configured) && configured >= 1) {
    return configured
  }

  return 30
}

export async function requireRouteAccess(options?: {
  policy?: RouteAccessPolicyName
  requireAdmin?: boolean
  requireSuperuser?: boolean
}): Promise<RouteAccessResult> {
  const session = await getAppServerSession()

  if (!session?.user?.id) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const role = normalizeAppRole(session.user.role)
  const policy = getRouteAccessPolicy(options?.policy)
  const requireSuperuser = options?.requireSuperuser ?? policy.requireSuperuser
  const requireAdmin = options?.requireAdmin ?? policy.requireAdmin

  if (requireSuperuser && !isSuperuserRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  if (requireAdmin && !isAdminRole(role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return {
    ok: true,
    session,
    userId: session.user.id,
    role,
  }
}

export async function writeAdminAuditEvent(input: {
  actorUserId: string
  action: string
  targetUserId?: string | null
  reason?: string | null
  metadata?: string | null
}) {
  return prisma.adminAuditEvent.create({
    data: {
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId ?? null,
      action: input.action,
      reason: input.reason ?? null,
      metadata: input.metadata ?? null,
    },
  })
}

export async function hasRecentAuthentication(input: {
  userId: string
  maxAgeMinutes?: number
}) {
  const lastSignIn = await prisma.userPreference.findUnique({
    where: { userId: input.userId },
    select: { lastSignInAt: true },
  })

  if (!lastSignIn?.lastSignInAt) {
    return {
      ok: false,
      reason: "Recent authentication is required before using break-glass actions.",
      lastSignInAt: null,
    }
  }

  const maxAgeMinutes = input.maxAgeMinutes ?? getBreakGlassRecentAuthMaxAgeMinutes()
  const ageMs = Date.now() - lastSignIn.lastSignInAt.getTime()

  if (ageMs > maxAgeMinutes * 60_000) {
    return {
      ok: false,
      reason: `Break-glass actions require a fresh sign-in within the last ${maxAgeMinutes} minutes.`,
      lastSignInAt: lastSignIn.lastSignInAt,
    }
  }

  return {
    ok: true,
    lastSignInAt: lastSignIn.lastSignInAt,
  }
}

export async function createAdminSecretRevealGrant(input: {
  actorUserId: string
  providerCredentialId: string
  targetUserId?: string | null
  reason: string
  revealWindowMs?: number
}) {
  const expiresAt = new Date(Date.now() + (input.revealWindowMs ?? getBreakGlassRevealWindowMs()))

  return prisma.adminSecretRevealGrant.create({
    data: {
      actorUserId: input.actorUserId,
      providerCredentialId: input.providerCredentialId,
      targetUserId: input.targetUserId ?? null,
      reason: input.reason,
      expiresAt,
    },
  })
}

export async function scrubUnusedOAuthAccountTokens(input: {
  userId: string
  provider: string
}) {
  // Mahita does not use provider access tokens after authentication.
  // Scrub them so the auth account table cannot become a secondary secret store.
  return prisma.account.updateMany({
    where: {
      userId: input.userId,
      provider: input.provider,
    },
    data: {
      access_token: null,
      refresh_token: null,
      id_token: null,
      scope: null,
      session_state: null,
      token_type: null,
      expires_at: null,
    },
  })
}
