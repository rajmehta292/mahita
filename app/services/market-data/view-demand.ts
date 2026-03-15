import prisma from "@/lib/prisma"

export interface ViewDemandInput {
  userId: string
  surface: string
  symbol?: string | null
  timeframe?: string | null
  providerPreference?: string | null
  priorityScore?: number
  refreshIntervalSeconds?: number
  ttlSeconds?: number
}

export function buildViewDemandKey(input: {
  userId: string
  surface: string
  symbol?: string | null
  timeframe?: string | null
}) {
  return [
    input.userId,
    input.surface.trim().toLowerCase(),
    input.symbol?.trim().toUpperCase() || "_",
    input.timeframe?.trim().toLowerCase() || "_",
  ].join(":")
}

export async function upsertViewDemand(input: ViewDemandInput) {
  const now = new Date()
  const ttlSeconds = Math.max(10, input.ttlSeconds ?? Math.max(30, (input.refreshIntervalSeconds ?? 13) * 3))
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)
  const surfaceKey = buildViewDemandKey(input)

  return prisma.ingestionViewDemand.upsert({
    where: { surfaceKey },
    update: {
      providerPreference: input.providerPreference ?? undefined,
      priorityScore: input.priorityScore ?? 1,
      refreshIntervalSeconds: Math.max(3, Math.floor(input.refreshIntervalSeconds ?? 13)),
      lastSeenAt: now,
      expiresAt,
    },
    create: {
      surfaceKey,
      userId: input.userId,
      surface: input.surface,
      symbol: input.symbol?.trim().toUpperCase() || null,
      timeframe: input.timeframe?.trim().toLowerCase() || null,
      providerPreference: input.providerPreference ?? null,
      priorityScore: input.priorityScore ?? 1,
      refreshIntervalSeconds: Math.max(3, Math.floor(input.refreshIntervalSeconds ?? 13)),
      lastSeenAt: now,
      expiresAt,
    },
  })
}

export async function purgeExpiredViewDemands() {
  return prisma.ingestionViewDemand.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  })
}

export async function listActiveViewDemands() {
  await purgeExpiredViewDemands()

  return prisma.ingestionViewDemand.findMany({
    where: {
      expiresAt: {
        gte: new Date(),
      },
    },
    orderBy: [{ priorityScore: "desc" }, { lastSeenAt: "desc" }],
  })
}
