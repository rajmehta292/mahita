import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { backfillSchwabBrokerageConnections } from "@/lib/brokerage-connections"
import { toErrorResponse } from "@/lib/route-errors"
import { assertRequiredRuntimeModels } from "@/lib/runtime-health"
import { requireRouteAccess } from "@/lib/security/platform-security"

export async function GET() {
  try {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
      return access.response
    }

    assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])
    await backfillSchwabBrokerageConnections()

    const users = await prisma.user.findMany({
      orderBy: [{ role: "desc" }, { email: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        image: true,
        brokerageConnections: {
          where: { provider: "SCHWAB" },
          orderBy: [{ isPrimary: "desc" }, { updatedAt: "desc" }],
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            lastSyncedAt: true,
            lastError: true,
            accounts: {
              where: { isActive: true },
              select: {
                id: true,
              },
            },
            linkedSchwabConfig: {
              select: {
                accessTokenExpiry: true,
                refreshTokenExpiry: true,
              },
            },
          },
        },
        preferences: {
          select: {
            selectedAccountId: true,
            lastVisitedPath: true,
            lastVisitedAt: true,
            lastSignInAt: true,
          },
        },
      },
    })

    return NextResponse.json({
      users: users.map((user) => {
        const primaryBrokerageConnection = user.brokerageConnections[0] || null

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          image: user.image,
          primaryBrokerageConnection: primaryBrokerageConnection
            ? {
                id: primaryBrokerageConnection.id,
                provider: primaryBrokerageConnection.provider,
                status: primaryBrokerageConnection.status,
                lastSyncedAt: primaryBrokerageConnection.lastSyncedAt,
                lastError: primaryBrokerageConnection.lastError,
                accountCount: primaryBrokerageConnection.accounts.length,
                accessTokenExpiry:
                  primaryBrokerageConnection.linkedSchwabConfig?.accessTokenExpiry ?? null,
                refreshTokenExpiry:
                  primaryBrokerageConnection.linkedSchwabConfig?.refreshTokenExpiry ?? null,
              }
            : null,
          preferences: user.preferences,
        }
      }),
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not load admin user visibility.")
  }
}
