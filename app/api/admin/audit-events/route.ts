import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { toErrorResponse } from "@/lib/route-errors"
import { requireRouteAccess } from "@/lib/security/platform-security"

export async function GET() {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    const events = await prisma.adminAuditEvent.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      include: {
        actorUser: {
          select: { id: true, email: true, name: true },
        },
        targetUser: {
          select: { id: true, email: true, name: true },
        },
      },
    })

    return NextResponse.json({ events })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load the audit log.")
  }
}
