import { NextRequest, NextResponse } from "next/server"
import { requireRouteAccess, writeAdminAuditEvent } from "@/lib/security/platform-security"
import { toErrorResponse } from "@/lib/route-errors"
import {
  listProviderPoolMembers,
  serializeProviderPoolMember,
  setProviderPoolMemberState,
  upsertUserSchwabProviderPoolMember,
} from "@/lib/provider-credentials"

export async function GET() {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const providerPool = await listProviderPoolMembers("MARKET_DATA")
    return NextResponse.json({
      providerPool: providerPool.map(serializeProviderPoolMember),
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load the provider pool.")
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === "promote-user-schwab") {
      const targetUserId =
        typeof body.targetUserId === "string" && body.targetUserId.trim()
          ? body.targetUserId
          : access.userId

      const member = await upsertUserSchwabProviderPoolMember({
        actorUserId: access.userId,
        targetUserId,
        label:
          typeof body.label === "string" && body.label.trim()
            ? body.label.trim()
            : undefined,
        priority: typeof body.priority === "number" ? body.priority : undefined,
        isPrimary: body.isPrimary !== false,
      })

      await writeAdminAuditEvent({
        actorUserId: access.userId,
        targetUserId,
        action: "PROVIDER_POOL_PROMOTE_USER_SCHWAB",
        metadata: JSON.stringify({
          providerPoolMemberId: member.id,
          providerCredentialId: member.providerCredential.id,
        }),
      })

      return NextResponse.json({
        success: true,
        member: serializeProviderPoolMember(member),
      })
    }

    return NextResponse.json({ error: "Unsupported provider-pool action" }, { status: 400 })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not update the provider pool.")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const body = await request.json().catch(() => ({}))

    if (typeof body.providerPoolMemberId !== "string" || !body.providerPoolMemberId) {
      return NextResponse.json({ error: "providerPoolMemberId is required" }, { status: 400 })
    }

    const member = await setProviderPoolMemberState({
      providerPoolMemberId: body.providerPoolMemberId,
      status: body.status,
      isPrimary: typeof body.isPrimary === "boolean" ? body.isPrimary : undefined,
      priority: typeof body.priority === "number" ? body.priority : undefined,
    })

    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "PROVIDER_POOL_MEMBER_UPDATE",
      metadata: JSON.stringify({
        providerPoolMemberId: member.id,
        status: member.status,
        isPrimary: member.isPrimary,
        priority: member.priority,
      }),
    })

    return NextResponse.json({
      success: true,
      member: serializeProviderPoolMember(member),
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not update the selected provider member.")
  }
}
