import { NextRequest, NextResponse } from "next/server"
import { getProviderCredentialReveal } from "@/lib/provider-credentials"
import { toErrorResponse } from "@/lib/route-errors"
import {
  createAdminSecretRevealGrant,
  getBreakGlassRevealWindowMs,
  hasRecentAuthentication,
  requireRouteAccess,
  writeAdminAuditEvent,
} from "@/lib/security/platform-security"

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const body = await request.json().catch(() => ({}))
    const reason =
      typeof body.reason === "string" && body.reason.trim()
        ? body.reason.trim()
        : null

    if (!reason) {
      return NextResponse.json({ error: "A reason is required for credential reveal." }, { status: 400 })
    }

    const { id } = await context.params
    const credential = await getProviderCredentialReveal(id)

    if (!credential) {
      return NextResponse.json({ error: "Provider credential not found." }, { status: 404 })
    }

    const recentAuth = await hasRecentAuthentication({ userId: access.userId })
    if (!recentAuth.ok) {
      return NextResponse.json(
        {
          error: recentAuth.reason,
          lastSignInAt: recentAuth.lastSignInAt?.toISOString() ?? null,
        },
        { status: 403 }
      )
    }

    const revealGrant = await createAdminSecretRevealGrant({
      actorUserId: access.userId,
      providerCredentialId: credential.id,
      targetUserId: credential.linkedUser?.id ?? null,
      reason,
      revealWindowMs: getBreakGlassRevealWindowMs(),
    })

    await writeAdminAuditEvent({
      actorUserId: access.userId,
      targetUserId: credential.linkedUser?.id ?? null,
      action: "PROVIDER_CREDENTIAL_REVEAL",
      reason,
      metadata: JSON.stringify({
        revealGrantId: revealGrant.id,
        providerCredentialId: credential.id,
        provider: credential.provider,
        sourceType: credential.sourceType,
      }),
    })

    return NextResponse.json({
      revealGrantId: revealGrant.id,
      credential,
      revealExpiresAt: revealGrant.expiresAt.toISOString(),
      recentAuthAt: recentAuth.lastSignInAt?.toISOString() ?? null,
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not complete the break-glass reveal.")
  }
}
