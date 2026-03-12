import prisma from "@/lib/prisma"
import { continuousIngestController } from "@/app/services/market-data/continuous-ingest"
import { providerTelemetryBus } from "@/app/services/market-data/provider-telemetry"
import { marketDataStore } from "@/app/services/market-data/store"
import { checkSchwabTokenHealth } from "@/app/services/schwab/runtime"
import { backfillSchwabBrokerageConnections } from "@/lib/brokerage-connections"
import {
  listProviderPoolMembers,
  serializeProviderPoolMember,
} from "@/lib/provider-credentials"
import { getRuntimeHealthSnapshot } from "@/lib/runtime-health"

async function readTokenHealthSafe() {
  try {
    return await checkSchwabTokenHealth()
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : "Mahita could not read Schwab token health.",
    }
  }
}

export async function getAdminOverview() {
  await backfillSchwabBrokerageConnections()

  const [
    totalUsers,
    usersWithBrokerage,
    providerPool,
    latestAudits,
    latestPreferences,
    tokenHealth,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.brokerageConnection.count({
      where: { provider: "SCHWAB" },
    }),
    listProviderPoolMembers("MARKET_DATA"),
    prisma.adminAuditEvent.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        actorUser: {
          select: { id: true, email: true, name: true },
        },
        targetUser: {
          select: { id: true, email: true, name: true },
        },
      },
    }),
    prisma.userPreference.count({
      where: { lastSignInAt: { not: null } },
    }),
    readTokenHealthSafe(),
  ])

  const runtimeHealth = await getRuntimeHealthSnapshot()

  return {
    userSummary: {
      totalUsers,
      usersWithBrokerage,
      activePreferenceProfiles: latestPreferences,
    },
    runtimeSummary: {
      runtimeHealth,
      platformDataProviderCount: providerPool.length,
      tokenHealth,
      availableProviders: marketDataStore.getAvailableProviders(),
      continuousIngest: continuousIngestController.getStatus(),
    },
    providerPool: providerPool.map(serializeProviderPoolMember),
    latestAudits,
  }
}

export async function getDataCommandSnapshot() {
  const [vaults, unhealthyInventory, inventoryAggregate, recentAudits, tokenHealth] =
    await Promise.all([
      prisma.vault.findMany({
        orderBy: [{ isEnabled: "desc" }, { name: "asc" }],
        include: {
          _count: {
            select: { inventories: true },
          },
        },
      }),
      prisma.dataInventory.findMany({
        orderBy: [{ healthScore: "asc" }, { lastSynced: "asc" }],
        take: 25,
        include: {
          vault: {
            select: { id: true, name: true, type: true, isEnabled: true },
          },
        },
      }),
      prisma.dataInventory.aggregate({
        _count: { id: true },
        _avg: { healthScore: true, targetCoveragePercent: true },
        _sum: { barCount: true, gapCount: true },
        _max: { lastSynced: true },
      }),
      prisma.adminAuditEvent.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          actorUser: {
            select: { id: true, email: true, name: true },
          },
        },
      }),
      readTokenHealthSafe(),
    ])

  const runtimeHealth = await getRuntimeHealthSnapshot()

  return {
    runtime: {
      runtimeHealth,
      continuousIngest: continuousIngestController.getStatus(),
      providers: marketDataStore.getAvailableProviders(),
      providerEvents: providerTelemetryBus.getRecent(40),
      tokenHealth,
    },
    vaults,
    inventorySummary: {
      rows: inventoryAggregate._count.id,
      avgHealthScore: inventoryAggregate._avg.healthScore ?? 0,
      avgCoveragePercent: inventoryAggregate._avg.targetCoveragePercent ?? 0,
      totalBars: inventoryAggregate._sum.barCount ?? 0,
      totalGaps: inventoryAggregate._sum.gapCount ?? 0,
      latestSyncAt: inventoryAggregate._max.lastSynced ?? null,
    },
    weakestInventory: unhealthyInventory,
    recentAudits,
  }
}
