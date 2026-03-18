import prisma from "@/lib/prisma"
import { providerTelemetryBus, type ProviderTelemetryEvent } from "./provider-telemetry"
import { getGlobalUniverse } from "./universe-loader"
import { SP500_SYMBOLS } from "./universe"
import { isAfterHoursWindow } from "./market-hours"
import { listActiveViewDemands, purgeExpiredViewDemands } from "./view-demand"
import { runVerificationJobNow, seedAfterHoursVerificationJobs } from "./verification"
import { executeIngestionJob } from "./job-executor"
import { continuousIngestController } from "./continuous-ingest-controller"
import { DataHealthManager } from "./health"
import {
  decideRuntimeProvider,
  getProviderAvailabilitySnapshot,
  getProviderReadinessSnapshot,
  resolveVerificationProviders as resolveProviderVerificationPair,
  type ProviderAvailabilitySnapshot,
} from "./provider-policy"
import { writeAdminAuditEvent } from "@/lib/security/platform-security"

const DEFAULT_PROFILE_NAME = "presentation-default"
const DEFAULT_PROVIDER_BUDGETS = [
  { provider: "schwab", maxCallsPerMinute: 120, enabled: true, note: "Primary broker data source" },
  { provider: "yahoo", maxCallsPerMinute: 20, enabled: true, note: "Secondary/reference data source" },
]

const DOW30_SYMBOLS = [
  "AAPL",
  "AMGN",
  "AXP",
  "BA",
  "CAT",
  "CRM",
  "CSCO",
  "CVX",
  "DIS",
  "GS",
  "HD",
  "HON",
  "IBM",
  "INTC",
  "JNJ",
  "JPM",
  "KO",
  "MCD",
  "MMM",
  "MRK",
  "MSFT",
  "NKE",
  "PG",
  "SHW",
  "TRV",
  "UNH",
  "V",
  "VZ",
  "WMT",
  "XOM",
]

const DEFAULT_LANES: Array<{
  kind: import("@prisma/client").IngestionLaneKind
  priorityOrder: number
  weight: number
  reservedCallsPerMinute?: number
  minCallsPerMinute?: number
  targetRefreshSeconds?: number
  providerPreference?: string
  canonicalIntervals?: string[]
}> = [
  {
    kind: "USER_VIEW",
    priorityOrder: 10,
    weight: 1,
    minCallsPerMinute: 10,
    targetRefreshSeconds: 13,
    providerPreference: "schwab",
    canonicalIntervals: ["1m", "1h", "1w"],
  },
  {
    kind: "DOW30_REALTIME",
    priorityOrder: 20,
    weight: 1,
    reservedCallsPerMinute: 60,
    targetRefreshSeconds: 30,
    providerPreference: "schwab",
    canonicalIntervals: ["1m", "1h", "1w"],
  },
  {
    kind: "SELECTED_OR_SP500_REALTIME",
    priorityOrder: 30,
    weight: 0.5,
    targetRefreshSeconds: 60,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
  },
  {
    kind: "SELECTED_ALL_1M",
    priorityOrder: 40,
    weight: 0.5,
    targetRefreshSeconds: 60,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
  },
  {
    kind: "AFTER_HOURS_VERIFY",
    priorityOrder: 50,
    weight: 0.6,
    targetRefreshSeconds: 300,
    providerPreference: "yahoo",
    canonicalIntervals: ["1m"],
  },
  {
    kind: "REPEAT_FETCH_VERIFY",
    priorityOrder: 60,
    weight: 0.4,
    targetRefreshSeconds: 300,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
  },
]

const DEFAULT_TARGETS = [
  {
    name: "Dow 30 realtime",
    preset: "DOW30" as const,
    priorityOrder: 10,
    providerPreference: "schwab",
    canonicalIntervals: ["1m", "1h", "1w"],
    symbols: DOW30_SYMBOLS,
  },
  {
    name: "Selected or S&P 500 realtime",
    preset: "SP500" as const,
    priorityOrder: 20,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
    symbols: SP500_SYMBOLS,
  },
  {
    name: "Custom universe",
    preset: "CUSTOM" as const,
    priorityOrder: 25,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
    symbols: [] as string[],
  },
  {
    name: "All enabled 1m",
    preset: "ALL_ENABLED" as const,
    priorityOrder: 30,
    providerPreference: "schwab",
    canonicalIntervals: ["1m"],
    symbols: [] as string[],
  },
]
const SCHEDULER_SNAPSHOT_TIMEOUT_MS = 5_000

function parseJsonArray(value?: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function parseJsonObject<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function parseMetadataRecord(value?: string | null) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return parsed && typeof parsed === "object" ? parsed : null
  } catch {
    return null
  }
}

async function withSchedulerTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

function defaultVerificationPolicies() {
  return [
    { timeframe: "1m", sameSourcePriceToleranceBps: 5, crossSourcePriceToleranceBps: 10, volumeTolerancePct: 5 },
    { timeframe: "1h", sameSourcePriceToleranceBps: 8, crossSourcePriceToleranceBps: 15, volumeTolerancePct: 8 },
    { timeframe: "1w", sameSourcePriceToleranceBps: 12, crossSourcePriceToleranceBps: 20, volumeTolerancePct: 12 },
  ]
}

interface SchedulerDesiredState {
  shouldRun: boolean
  profileStatus: string
  isDefault: boolean
}

interface SchedulerActualRuntimeState {
  running: boolean
  currentPhase: string
  intervalMs: number
  providerOverride: string | null
  schedulerEnabled: boolean
  lastError: string | null
  cycleCount: number
}

interface SchedulerPlanPreviewItem {
  laneKind: string
  symbolSource: string
  queueDepthTarget: number
  existingQueued: number
  requestedTimeframe: string
  storageTimeframe: string
  preferredProvider: string
  chosenProvider: string | null
  reason: string
  blockedReason: string | null
  previewSymbols: string[]
}

function getRecentProviderUsage(events: ProviderTelemetryEvent[]) {
  const oneMinuteAgo = Date.now() - 60_000
  const usage = new Map<string, { calls: number; errors: number; throttledSymbols: Set<string>; retries: number; lastError: string | null }>()

  for (const event of events) {
    if (new Date(event.timestamp).getTime() < oneMinuteAgo) continue
    const provider = event.provider || "unknown"
    const entry = usage.get(provider) ?? {
      calls: 0,
      errors: 0,
      throttledSymbols: new Set<string>(),
      retries: 0,
      lastError: null,
    }
    if (event.kind === "request") entry.calls += 1
    if (event.kind === "error") {
      entry.errors += 1
      entry.lastError = event.message
      if (event.message.includes("RATE_LIMITED") && event.symbol) {
        entry.throttledSymbols.add(event.symbol)
        entry.retries += 1
      }
    }
    usage.set(provider, entry)
  }

  return usage
}

async function ensureProfileDefaults(profileId: string) {
  for (const lane of DEFAULT_LANES) {
    await prisma.ingestionLane.upsert({
      where: {
        profileId_kind: {
          profileId,
          kind: lane.kind,
        },
      },
      update: {
        priorityOrder: lane.priorityOrder,
        weight: lane.weight,
        reservedCallsPerMinute: lane.reservedCallsPerMinute ?? null,
        minCallsPerMinute: lane.minCallsPerMinute ?? null,
        targetRefreshSeconds: lane.targetRefreshSeconds ?? null,
        providerPreference: lane.providerPreference ?? null,
        canonicalIntervals: JSON.stringify(lane.canonicalIntervals ?? []),
      },
      create: {
        profileId,
        kind: lane.kind,
        priorityOrder: lane.priorityOrder,
        weight: lane.weight,
        reservedCallsPerMinute: lane.reservedCallsPerMinute ?? null,
        minCallsPerMinute: lane.minCallsPerMinute ?? null,
        targetRefreshSeconds: lane.targetRefreshSeconds ?? null,
        providerPreference: lane.providerPreference ?? null,
        canonicalIntervals: JSON.stringify(lane.canonicalIntervals ?? []),
      },
    })
  }

  for (const target of DEFAULT_TARGETS) {
    const record = await prisma.ingestionTarget.upsert({
      where: {
        id: `${profileId}:${target.preset}`,
      },
      update: {
        name: target.name,
        enabled: true,
        priorityOrder: target.priorityOrder,
        providerPreference: target.providerPreference,
        canonicalIntervals: JSON.stringify(target.canonicalIntervals),
      },
      create: {
        id: `${profileId}:${target.preset}`,
        profileId,
        name: target.name,
        preset: target.preset,
        enabled: true,
        priorityOrder: target.priorityOrder,
        providerPreference: target.providerPreference,
        canonicalIntervals: JSON.stringify(target.canonicalIntervals),
      },
    })

    if (target.symbols.length > 0) {
      const existingSymbols = await prisma.ingestionTargetSymbol.findMany({
        where: {
          targetId: record.id,
          symbol: { in: target.symbols },
        },
        select: { symbol: true },
      })

      const existingSet = new Set(existingSymbols.map((item) => item.symbol))
      const symbolsToCreate = target.symbols.filter((symbol) => !existingSet.has(symbol))

      for (const symbol of symbolsToCreate) {
        await prisma.ingestionTargetSymbol.upsert({
          where: {
            targetId_symbol: {
              targetId: record.id,
              symbol,
            },
          },
          update: {
            enabled: true,
            canonicalIntervals: JSON.stringify(target.canonicalIntervals),
          },
          create: {
            targetId: record.id,
            symbol,
            enabled: true,
            canonicalIntervals: JSON.stringify(target.canonicalIntervals),
          },
        })
      }

      await prisma.ingestionTargetSymbol.updateMany({
        where: {
          targetId: record.id,
          symbol: { in: target.symbols },
        },
        data: {
          enabled: true,
          canonicalIntervals: JSON.stringify(target.canonicalIntervals),
        },
      })
    }
  }

  for (const policy of defaultVerificationPolicies()) {
    await prisma.verificationPolicy.upsert({
      where: {
        profileId_timeframe: {
          profileId,
          timeframe: policy.timeframe,
        },
      },
      update: {
        enabled: true,
        mode: "BOTH",
        sameSourcePriceToleranceBps: policy.sameSourcePriceToleranceBps,
        crossSourcePriceToleranceBps: policy.crossSourcePriceToleranceBps,
        volumeTolerancePct: policy.volumeTolerancePct,
      },
      create: {
        profileId,
        timeframe: policy.timeframe,
        enabled: true,
        mode: "BOTH",
        sameSourcePriceToleranceBps: policy.sameSourcePriceToleranceBps,
        crossSourcePriceToleranceBps: policy.crossSourcePriceToleranceBps,
        volumeTolerancePct: policy.volumeTolerancePct,
      },
    })
  }
}

export async function ensureDefaultIngestionProfile() {
  let profile = await prisma.ingestionProfile.findFirst({
    where: { isDefault: true },
  })

  if (!profile) {
    profile = await prisma.ingestionProfile.create({
      data: {
        name: DEFAULT_PROFILE_NAME,
        label: "Presentation Default",
        description: "Default DI-UI scheduler profile for Mahita.",
        isDefault: true,
        status: "ACTIVE",
        providerBudgetsJson: JSON.stringify(DEFAULT_PROVIDER_BUDGETS),
      },
    })
  }

  await ensureProfileDefaults(profile.id)
  return profile
}

async function getProfileWithRelations() {
  const profile = await ensureDefaultIngestionProfile()
  return prisma.ingestionProfile.findUniqueOrThrow({
    where: { id: profile.id },
    include: {
      lanes: {
        orderBy: { priorityOrder: "asc" },
      },
      targets: {
        orderBy: { priorityOrder: "asc" },
        include: {
          symbols: {
            orderBy: { symbol: "asc" },
          },
        },
      },
      verificationPolicies: {
        orderBy: { timeframe: "asc" },
      },
    },
  })
}

async function getAllProfiles() {
  return prisma.ingestionProfile.findMany({
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      name: true,
      label: true,
      status: true,
      isDefault: true,
    },
  })
}

async function ensureSchedulerRuntime(profile: Awaited<ReturnType<typeof getProfileWithRelations>>) {
  await reconcileDefaultSchedulerRuntime()
  const status = continuousIngestController.getStatus()

  if (profile.status !== "ACTIVE") {
    return {
      ...status,
      currentPhase: status.running ? status.currentPhase : "profile paused",
    }
  }

  return status
}

async function resolveVerificationProviders(input: {
  symbol: string
  timeframe: string
  preferredProvider?: string | null
}) {
  const availability = await getSchedulerProviderAvailability()
  const latestInventory = await prisma.dataInventory.findFirst({
    where: {
      symbol: input.symbol.toUpperCase(),
      timeframe: input.timeframe,
      barCount: { gt: 0 },
    },
    orderBy: [{ lastVerifiedAt: "desc" }, { lastSynced: "desc" }, { barCount: "desc" }],
    select: {
      source: true,
    },
  })
  const latestJob = await prisma.ingestionJob.findFirst({
    where: {
      symbol: input.symbol.toUpperCase(),
      storageTimeframe: input.timeframe,
      status: "COMPLETED",
    },
    orderBy: { updatedAt: "desc" },
    select: {
      provider: true,
    },
  })

  let sourceProvider = input.preferredProvider || latestInventory?.source || latestJob?.provider || "schwab"
  if (sourceProvider === "schwab" && !availability.schwab) {
    sourceProvider = "yahoo"
  }
  if (sourceProvider === "yahoo" && !availability.yahoo && availability.schwab) {
    sourceProvider = "schwab"
  }

  const providerPair = resolveProviderVerificationPair({
    preferredProvider: sourceProvider,
    availability,
  })

  return {
    sourceProvider: providerPair.sourceProvider || sourceProvider,
    comparisonProvider: providerPair.comparisonProvider,
    availability,
  }
}

async function resolveTargetSymbols(target: Awaited<ReturnType<typeof getProfileWithRelations>>["targets"][number]) {
  if (target.preset === "DOW30") return DOW30_SYMBOLS
  if (target.preset === "SP500") return SP500_SYMBOLS
  if (target.preset === "CUSTOM") {
    return target.symbols.filter((item) => item.enabled).map((item) => item.symbol)
  }

  const universe = await getGlobalUniverse()
  return universe
}

function getQueueWeightSplit(hasQueuePressure: boolean) {
  return hasQueuePressure
    ? { selectedRealtime: 0.25, all1m: 0.75 }
    : { selectedRealtime: 0.5, all1m: 0.5 }
}

async function logDispatch(input: {
  profileId?: string | null
  ingestionJobId?: string | null
  laneKind?: import("@prisma/client").IngestionLaneKind | null
  stage: string
  message: string
  provider?: string | null
  symbol?: string | null
  requestedTimeframe?: string | null
  storageTimeframe?: string | null
  metadata?: Record<string, unknown> | null
}) {
  await prisma.ingestionDispatchLog.create({
    data: {
      profileId: input.profileId ?? null,
      ingestionJobId: input.ingestionJobId ?? null,
      laneKind: input.laneKind ?? null,
      stage: input.stage,
      message: input.message,
      provider: input.provider ?? null,
      symbol: input.symbol ?? null,
      requestedTimeframe: input.requestedTimeframe ?? null,
      storageTimeframe: input.storageTimeframe ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })
}

async function ensureJobsForLane(input: {
  profileId: string
  lane: Awaited<ReturnType<typeof getProfileWithRelations>>["lanes"][number]
  targetSymbols: string[]
  requestedTimeframe: string
  storageTimeframe: string
  provider: string
  queueDepthTarget: number
  cycleId: string
  queueReason: string
  symbolSource: string
}) {
  const existing = await prisma.ingestionJob.findMany({
    where: {
      profileId: input.profileId,
      laneKind: input.lane.kind,
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { symbol: true, requestedTimeframe: true },
  })

  const existingKeys = new Set(existing.map((item) => `${item.symbol}:${item.requestedTimeframe}`))
  const laneTargetSymbols = input.targetSymbols.filter(Boolean)
  if (laneTargetSymbols.length === 0) {
    return 0
  }

  const queueDeficit = Math.max(0, input.queueDepthTarget - existing.length)
  if (queueDeficit === 0) {
    return 0
  }

  const nextJobs: Array<{
    symbol: string
    requestedTimeframe: string
    storageTimeframe: string
    provider: string
  }> = []

  let cursor = input.lane.cursor % laneTargetSymbols.length
  while (nextJobs.length < queueDeficit && nextJobs.length < laneTargetSymbols.length) {
    const symbol = laneTargetSymbols[cursor]
    const key = `${symbol}:${input.requestedTimeframe}`
    if (!existingKeys.has(key)) {
      nextJobs.push({
        symbol,
        requestedTimeframe: input.requestedTimeframe,
        storageTimeframe: input.storageTimeframe,
        provider: input.provider,
      })
      existingKeys.add(key)
    }
    cursor = (cursor + 1) % laneTargetSymbols.length
  }

  if (nextJobs.length === 0) {
    return 0
  }

  await prisma.ingestionLane.update({
    where: { id: input.lane.id },
    data: { cursor },
  })

  const scheduledFor = new Date()
  for (const [index, job] of nextJobs.entries()) {
    const createdJob = await prisma.ingestionJob.create({
      data: {
        profileId: input.profileId,
        laneKind: input.lane.kind,
        symbol: job.symbol,
        requestedTimeframe: job.requestedTimeframe,
        storageTimeframe: job.storageTimeframe,
        provider: job.provider,
        status: "QUEUED",
        priorityScore: Math.max(1, 100 - input.lane.priorityOrder - index),
        scheduledFor,
        queueBucket: input.lane.kind,
        vaultName: input.provider === "yahoo" ? "yahoo" : "schwab",
        provenanceStatus: job.requestedTimeframe === job.storageTimeframe ? "native-cached" : "derived",
        verificationStatus: "unverified",
      },
    })

    await logDispatch({
      profileId: input.profileId,
      ingestionJobId: createdJob.id,
      laneKind: input.lane.kind,
      stage: "queued",
      message: `Queued ${job.symbol} ${job.requestedTimeframe} for ${input.lane.kind}.`,
      provider: job.provider,
      symbol: job.symbol,
      requestedTimeframe: job.requestedTimeframe,
      storageTimeframe: job.storageTimeframe,
      metadata: {
        cycleId: input.cycleId,
        laneReason: input.queueReason,
        symbolSource: input.symbolSource,
        providerDecision: {
          preferredProvider: input.lane.providerPreference || "schwab",
          queuedProvider: job.provider,
        },
        budgetDecision: "dispatch-time-budget-check",
        storageTarget: job.provider === "yahoo" ? "yahoo" : "schwab",
      },
    })
  }

  return nextJobs.length
}

async function seedCompatibilityJobs(profile: Awaited<ReturnType<typeof getProfileWithRelations>>, cycleId: string) {
  await purgeExpiredViewDemands()
  const activeViewDemands = await listActiveViewDemands()
  const providerAvailability = await getSchedulerProviderAvailability()
  const hasQueuePressure = (await prisma.ingestionJob.count({
    where: {
      profileId: profile.id,
      laneKind: "SELECTED_ALL_1M",
      status: "QUEUED",
    },
  })) > 120
  const split = getQueueWeightSplit(hasQueuePressure)

  for (const lane of profile.lanes) {
    if (!lane.enabled) continue
    if (lane.kind === "AFTER_HOURS_VERIFY" || lane.kind === "REPEAT_FETCH_VERIFY") continue

    if (lane.kind === "USER_VIEW") {
      const demands = activeViewDemands
        .filter((demand) => demand.symbol && demand.timeframe)
        .map((demand) => ({ symbol: demand.symbol!, timeframe: demand.timeframe || "1m" }))
      const uniqueDemands = Array.from(new Map(demands.map((demand) => [`${demand.symbol}:${demand.timeframe}`, demand])).values())
      const providerDecision = decideRuntimeProvider({
        preferredProvider: lane.providerPreference,
        providerAvailability,
      })
      if (!providerDecision.chosenProvider) {
        await logDispatch({
          profileId: profile.id,
          laneKind: lane.kind,
          stage: "blocked",
          message: `Skipped ${lane.kind} queueing because no runtime provider was available.`,
          metadata: {
            cycleId,
            laneReason: "active-view-demand",
            blockedReason: providerDecision.blockedReason,
          },
        })
        continue
      }
      await ensureJobsForLane({
        profileId: profile.id,
        lane,
        targetSymbols: uniqueDemands.map((item) => item.symbol),
        requestedTimeframe: "1m",
        storageTimeframe: "1m",
        provider: providerDecision.chosenProvider,
        queueDepthTarget: Math.max(uniqueDemands.length, 6),
        cycleId,
        queueReason: "active-view-demand",
        symbolSource: "view-demands",
      })
      continue
    }

    const target = profile.targets.find((item) => {
      if (lane.kind === "DOW30_REALTIME") return item.preset === "DOW30"
      if (lane.kind === "SELECTED_OR_SP500_REALTIME") return item.preset === "SP500" || item.preset === "CUSTOM"
      if (lane.kind === "SELECTED_ALL_1M") return item.preset === "ALL_ENABLED"
      return false
    })

    if (!target?.enabled) continue
    const symbols = await resolveTargetSymbols(target)
    const providerDecision = decideRuntimeProvider({
      preferredProvider: target.providerPreference || lane.providerPreference,
      providerAvailability,
    })
    if (!providerDecision.chosenProvider) {
      await logDispatch({
        profileId: profile.id,
        laneKind: lane.kind,
        stage: "blocked",
        message: `Skipped ${lane.kind} queueing because no runtime provider was available.`,
        metadata: {
          cycleId,
          laneReason: target.preset,
          blockedReason: providerDecision.blockedReason,
        },
      })
      continue
    }
    const queueDepthTarget = lane.kind === "DOW30_REALTIME"
      ? Math.min(symbols.length, 30)
      : lane.kind === "SELECTED_OR_SP500_REALTIME"
        ? Math.max(20, Math.round(80 * split.selectedRealtime))
        : Math.max(60, Math.round(120 * split.all1m))

    await ensureJobsForLane({
      profileId: profile.id,
      lane,
      targetSymbols: symbols,
      requestedTimeframe: lane.kind === "DOW30_REALTIME" || lane.kind === "SELECTED_OR_SP500_REALTIME" ? "30s" : "1m",
      storageTimeframe: "1m",
      provider: providerDecision.chosenProvider,
      queueDepthTarget,
      cycleId,
      queueReason: target.preset,
      symbolSource: target.preset,
    })
  }

  if (isAfterHoursWindow()) {
    await seedAfterHoursVerificationJobs(profile.id)
  }
}

async function buildSchedulerPlanPreview(
  profile: Awaited<ReturnType<typeof getProfileWithRelations>>,
  providerAvailability: ProviderAvailabilitySnapshot
): Promise<SchedulerPlanPreviewItem[]> {
  await purgeExpiredViewDemands()
  const activeViewDemands = await listActiveViewDemands()
  const hasQueuePressure = (await prisma.ingestionJob.count({
    where: {
      profileId: profile.id,
      laneKind: "SELECTED_ALL_1M",
      status: "QUEUED",
    },
  })) > 120
  const split = getQueueWeightSplit(hasQueuePressure)
  const queuedCounts = await prisma.ingestionJob.groupBy({
    by: ["laneKind"],
    where: {
      profileId: profile.id,
      status: "QUEUED",
    },
    _count: { _all: true },
  })
  const queuedMap = new Map(queuedCounts.map((row) => [row.laneKind, row._count._all]))

  const preview: SchedulerPlanPreviewItem[] = []
  for (const lane of profile.lanes) {
    if (!lane.enabled) {
      preview.push({
        laneKind: lane.kind,
        symbolSource: "disabled",
        queueDepthTarget: 0,
        existingQueued: queuedMap.get(lane.kind) ?? 0,
        requestedTimeframe: "1m",
        storageTimeframe: "1m",
        preferredProvider: lane.providerPreference || "schwab",
        chosenProvider: null,
        reason: "Lane disabled.",
        blockedReason: "lane-disabled",
        previewSymbols: [],
      })
      continue
    }

    if (lane.kind === "AFTER_HOURS_VERIFY" || lane.kind === "REPEAT_FETCH_VERIFY") {
      preview.push({
        laneKind: lane.kind,
        symbolSource: lane.kind === "AFTER_HOURS_VERIFY" ? "verification-candidates" : "post-ingest-repeat-verification",
        queueDepthTarget: lane.kind === "AFTER_HOURS_VERIFY" ? 10 : 1,
        existingQueued: queuedMap.get(lane.kind) ?? 0,
        requestedTimeframe: "1m",
        storageTimeframe: "1m",
        preferredProvider: lane.providerPreference || "schwab",
        chosenProvider: lane.providerPreference || "schwab",
        reason: lane.kind === "AFTER_HOURS_VERIFY" ? "Queue after-hours comparison jobs." : "Queue repeat verification after completed 1m ingest jobs.",
        blockedReason: null,
        previewSymbols: [],
      })
      continue
    }

    if (lane.kind === "USER_VIEW") {
      const demands = activeViewDemands.filter((demand) => demand.symbol)
      const providerDecision = decideRuntimeProvider({
        preferredProvider: lane.providerPreference,
        providerAvailability,
      })
      preview.push({
        laneKind: lane.kind,
        symbolSource: "view-demands",
        queueDepthTarget: Math.max(demands.length, 6),
        existingQueued: queuedMap.get(lane.kind) ?? 0,
        requestedTimeframe: "1m",
        storageTimeframe: "1m",
        preferredProvider: providerDecision.preferredProvider,
        chosenProvider: providerDecision.chosenProvider,
        reason: "Prioritize symbols actively viewed in product surfaces.",
        blockedReason: providerDecision.blockedReason,
        previewSymbols: demands.slice(0, 12).map((demand) => demand.symbol!),
      })
      continue
    }

    const target = profile.targets.find((item) => {
      if (lane.kind === "DOW30_REALTIME") return item.preset === "DOW30"
      if (lane.kind === "SELECTED_OR_SP500_REALTIME") return item.preset === "SP500" || item.preset === "CUSTOM"
      if (lane.kind === "SELECTED_ALL_1M") return item.preset === "ALL_ENABLED"
      return false
    })

    if (!target?.enabled) {
      preview.push({
        laneKind: lane.kind,
        symbolSource: "target-disabled",
        queueDepthTarget: 0,
        existingQueued: queuedMap.get(lane.kind) ?? 0,
        requestedTimeframe: "1m",
        storageTimeframe: "1m",
        preferredProvider: lane.providerPreference || "schwab",
        chosenProvider: null,
        reason: "Target disabled.",
        blockedReason: "target-disabled",
        previewSymbols: [],
      })
      continue
    }

    const symbols = await resolveTargetSymbols(target)
    const providerDecision = decideRuntimeProvider({
      preferredProvider: target.providerPreference || lane.providerPreference,
      providerAvailability,
    })
    const queueDepthTarget = lane.kind === "DOW30_REALTIME"
      ? Math.min(symbols.length, 30)
      : lane.kind === "SELECTED_OR_SP500_REALTIME"
        ? Math.max(20, Math.round(80 * split.selectedRealtime))
        : Math.max(60, Math.round(120 * split.all1m))

    preview.push({
      laneKind: lane.kind,
      symbolSource: target.preset,
      queueDepthTarget,
      existingQueued: queuedMap.get(lane.kind) ?? 0,
      requestedTimeframe: lane.kind === "DOW30_REALTIME" || lane.kind === "SELECTED_OR_SP500_REALTIME" ? "30s" : "1m",
      storageTimeframe: "1m",
      preferredProvider: providerDecision.preferredProvider,
      chosenProvider: providerDecision.chosenProvider,
      reason: `Queue symbols from ${target.name}.`,
      blockedReason: providerDecision.blockedReason,
      previewSymbols: symbols.slice(0, 12),
    })
  }

  return preview
}

function getProviderBudgets(profile: Awaited<ReturnType<typeof getProfileWithRelations>>) {
  return parseJsonObject(profile.providerBudgetsJson, DEFAULT_PROVIDER_BUDGETS)
}

async function getSchedulerProviderAvailability() {
  return getProviderAvailabilitySnapshot()
}

function resolveDispatchProvider(input: {
  preferredProvider: string
  availableByProvider: Map<string, number>
  providerAvailability: ProviderAvailabilitySnapshot
}) {
  const decision = decideRuntimeProvider({
    preferredProvider: input.preferredProvider,
    providerAvailability: input.providerAvailability,
  })

  if (decision.chosenProvider && (input.availableByProvider.get(decision.chosenProvider) ?? 0) > 0) {
    return {
      provider: decision.chosenProvider,
      fallbackReason: decision.fallbackReason,
      blockedReason: null,
    }
  }

  return {
    provider: null,
    fallbackReason: decision.fallbackReason,
    blockedReason: decision.blockedReason || `No remaining budget for ${decision.preferredProvider}.`,
  }
}

function getDesiredSchedulerState(profile: Awaited<ReturnType<typeof getProfileWithRelations>>): SchedulerDesiredState {
  return {
    shouldRun: profile.status === "ACTIVE",
    profileStatus: profile.status,
    isDefault: profile.isDefault,
  }
}

function getActualSchedulerRuntimeState(): SchedulerActualRuntimeState {
  const status = continuousIngestController.getStatus()
  return {
    running: status.running,
    currentPhase: status.currentPhase,
    intervalMs: status.intervalMs,
    providerOverride: status.providerOverride,
    schedulerEnabled: status.schedulerEnabled,
    lastError: status.lastError,
    cycleCount: status.cycleCount,
  }
}

let schedulerRuntimeInitPromise: Promise<void> | null = null

export async function reconcileDefaultSchedulerRuntime() {
  if (schedulerRuntimeInitPromise) {
    await schedulerRuntimeInitPromise
    return
  }

  schedulerRuntimeInitPromise = (async () => {
    try {
      const profile = await getProfileWithRelations()
      const desired = getDesiredSchedulerState(profile)
      const actual = getActualSchedulerRuntimeState()

      if (desired.shouldRun && !actual.running) {
        await continuousIngestController.start({ useScheduler: true })
        await providerTelemetryBus.log({
          kind: "control",
          message: "Scheduler runtime auto-reconciled from ACTIVE profile state.",
          response: { profileId: profile.id },
        })
      }

      if (!desired.shouldRun && actual.running) {
        await continuousIngestController.stop()
        await providerTelemetryBus.log({
          kind: "control",
          message: "Scheduler runtime auto-paused to match profile state.",
          response: { profileId: profile.id },
        })
      }
    } finally {
      schedulerRuntimeInitPromise = null
    }
  })()

  await schedulerRuntimeInitPromise
}

async function dispatchIngestionJob(job: {
  id: string
  profileId: string
  laneKind: import("@prisma/client").IngestionLaneKind
  symbol: string
  requestedTimeframe: string
  storageTimeframe: string
  provider: string
  vaultName: string | null
  dispatchMetadata?: Record<string, unknown>
}) {
  await prisma.ingestionJob.update({
    where: { id: job.id },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  })
  await logDispatch({
    profileId: job.profileId,
    ingestionJobId: job.id,
    laneKind: job.laneKind,
    stage: "dispatch",
    message: `Dispatching ${job.symbol} ${job.requestedTimeframe} via ${job.provider}.`,
    provider: job.provider,
    symbol: job.symbol,
    requestedTimeframe: job.requestedTimeframe,
    storageTimeframe: job.storageTimeframe,
    metadata: job.dispatchMetadata ?? null,
  })

  try {
    const result = await executeIngestionJob({
      symbol: job.symbol,
      requestedTimeframe: job.requestedTimeframe,
      storageTimeframe: job.storageTimeframe,
      provider: job.provider,
    })

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: JSON.stringify(result.summary),
        provider: result.providerUsed,
        vaultName: result.vaultName,
        provenanceStatus: result.provenanceStatus,
      },
    })
    await logDispatch({
      profileId: job.profileId,
      ingestionJobId: job.id,
      laneKind: job.laneKind,
      stage: "complete",
      message: `Completed ${job.symbol} ${job.storageTimeframe}.`,
      provider: result.providerUsed,
      symbol: job.symbol,
      requestedTimeframe: job.requestedTimeframe,
      storageTimeframe: job.storageTimeframe,
      metadata: {
        ...(job.dispatchMetadata ?? {}),
        providerRequested: job.provider,
        providerUsed: result.providerUsed,
        summary: result.summary,
        healthScore: result.healthSnapshot.healthScore,
        targetCoveragePercent: result.healthSnapshot.targetCoveragePercent,
        gapCount: result.healthSnapshot.gapCount ?? result.healthSnapshot.gaps.length,
      },
    })

    if (job.storageTimeframe === "1m") {
      await prisma.verificationJob.create({
        data: {
          profileId: job.profileId,
          laneKind: "REPEAT_FETCH_VERIFY",
          mode: "SAME_SOURCE",
          symbol: job.symbol,
          timeframe: job.storageTimeframe,
          sourceProvider: result.providerUsed,
          comparisonProvider: result.providerUsed === "schwab" ? "yahoo" : "schwab",
          status: "QUEUED",
          scheduledFor: new Date(Date.now() + (isAfterHoursWindow() ? 60_000 : 10 * 60_000)),
        },
      }).catch(() => undefined)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingestion failure"
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        lastError: message,
      },
    })
    await logDispatch({
      profileId: job.profileId,
      ingestionJobId: job.id,
      laneKind: job.laneKind,
      stage: "failed",
      message: `Failed ${job.symbol} ${job.storageTimeframe}: ${message}`,
      provider: job.provider,
      symbol: job.symbol,
      requestedTimeframe: job.requestedTimeframe,
      storageTimeframe: job.storageTimeframe,
      metadata: {
        ...(job.dispatchMetadata ?? {}),
        error: message,
      },
    })
  }
}

export interface SchedulerCycleResult {
  cycleId: string
  dispatchedIngestionJobs: number
  dispatchedVerificationJobs: number
  queuePressureMode: "balanced" | "one-minute-biased"
  afterHoursMode: boolean
}

export async function runSchedulerCompatibilityCycle(options: {
  intervalMs: number
  providerOverride?: string | null
  forceRun?: boolean
}) {
  await reconcileDefaultSchedulerRuntime()
  const profile = await getProfileWithRelations()
  const cycleId = `cycle-${Date.now()}`
  if (profile.status !== "ACTIVE" && !options.forceRun) {
    return {
      cycleId,
      dispatchedIngestionJobs: 0,
      dispatchedVerificationJobs: 0,
      queuePressureMode: "balanced",
      afterHoursMode: isAfterHoursWindow(),
    } satisfies SchedulerCycleResult
  }

  await seedCompatibilityJobs(profile, cycleId)

  const events = providerTelemetryBus.getRecent(500)
  const usage = getRecentProviderUsage(events)
  const budgets = getProviderBudgets(profile)
  const providerAvailability = await getSchedulerProviderAvailability()
  const afterHoursMode = isAfterHoursWindow()

  const availableByProvider = new Map<string, number>()
  for (const budget of budgets) {
    if (!budget.enabled) continue
    if ((providerAvailability[budget.provider as keyof typeof providerAvailability] ?? true) === false) {
      availableByProvider.set(budget.provider, 0)
      continue
    }
    const used = usage.get(budget.provider)?.calls ?? 0
    const intervalAllowance = Math.max(1, Math.ceil((budget.maxCallsPerMinute * options.intervalMs) / 60_000))
    const remaining = Math.max(0, Math.min(intervalAllowance, budget.maxCallsPerMinute - used))
    availableByProvider.set(budget.provider, remaining)
  }

  const queuedAll1m = await prisma.ingestionJob.count({
    where: { profileId: profile.id, laneKind: "SELECTED_ALL_1M", status: "QUEUED" },
  })
  const queuedRealtime = await prisma.ingestionJob.count({
    where: { profileId: profile.id, laneKind: "SELECTED_OR_SP500_REALTIME", status: "QUEUED" },
  })
  const queuePressureMode = queuedAll1m > queuedRealtime ? "one-minute-biased" : "balanced"

  const queuedJobs = await prisma.ingestionJob.findMany({
    where: {
      profileId: profile.id,
      status: "QUEUED",
    },
    orderBy: [{ priorityScore: "desc" }, { scheduledFor: "asc" }, { createdAt: "asc" }],
    take: 200,
  })

  const laneOrder = afterHoursMode
    ? ["USER_VIEW", "DOW30_REALTIME", "AFTER_HOURS_VERIFY", "REPEAT_FETCH_VERIFY", "SELECTED_OR_SP500_REALTIME", "SELECTED_ALL_1M"] as const
    : ["USER_VIEW", "DOW30_REALTIME", "SELECTED_OR_SP500_REALTIME", "SELECTED_ALL_1M"] as const

  let dispatchedIngestionJobs = 0
  for (const laneKind of laneOrder) {
    const laneJobs = queuedJobs.filter((job) => job.laneKind === laneKind)
    for (const job of laneJobs) {
      const preferredProvider = options.providerOverride || job.provider
      const providerDecision = resolveDispatchProvider({
        preferredProvider,
        availableByProvider,
        providerAvailability,
      })
      if (!providerDecision.provider) {
        await logDispatch({
          profileId: profile.id,
          ingestionJobId: job.id,
          laneKind: job.laneKind,
          stage: "blocked",
          message: `Blocked ${job.symbol} ${job.requestedTimeframe} because no provider could dispatch it.`,
          provider: preferredProvider,
          symbol: job.symbol,
          requestedTimeframe: job.requestedTimeframe,
          storageTimeframe: job.storageTimeframe,
          metadata: {
            cycleId,
            providerDecision,
          },
        })
        continue
      }
      const remaining = availableByProvider.get(providerDecision.provider) ?? 0
      if (remaining <= 0) continue
      await dispatchIngestionJob({
        ...job,
        provider: providerDecision.provider,
        dispatchMetadata: {
          cycleId,
          laneReason: job.laneKind,
          providerDecision,
          budgetDecision: {
            remainingBeforeDispatch: remaining,
            intervalMs: options.intervalMs,
          },
          storageTarget: providerDecision.provider === "yahoo" ? "yahoo" : "schwab",
        },
      })
      availableByProvider.set(providerDecision.provider, remaining - 1)
      dispatchedIngestionJobs += 1
    }
  }

  let dispatchedVerificationJobs = 0
  if (afterHoursMode) {
    const verificationJobs = await prisma.verificationJob.findMany({
      where: {
        profileId: profile.id,
        status: "QUEUED",
        scheduledFor: {
          lte: new Date(),
        },
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: 10,
    })

    for (const job of verificationJobs) {
      const provider = job.sourceProvider || "schwab"
      const remaining = availableByProvider.get(provider) ?? 0
      if (remaining <= 0) {
        continue
      }
      try {
        await runVerificationJobNow(job.id)
        availableByProvider.set(provider, remaining - 1)
        dispatchedVerificationJobs += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown verification failure"
        await logDispatch({
          profileId: profile.id,
          laneKind: job.laneKind,
          stage: "verification-failed",
          message: `Verification failed for ${job.symbol} ${job.timeframe}: ${message}`,
          provider: job.sourceProvider ?? null,
          symbol: job.symbol,
          requestedTimeframe: job.timeframe,
          storageTimeframe: job.timeframe,
          metadata: {
            verificationJobId: job.id,
            error: message,
          },
        })
      }
    }
  }

  return {
    cycleId,
    dispatchedIngestionJobs,
    dispatchedVerificationJobs,
    queuePressureMode,
    afterHoursMode,
  } satisfies SchedulerCycleResult
}

export async function getSchedulerSnapshot() {
  const profile = await getProfileWithRelations()
  const availableProfiles = await getAllProfiles()
  const budgets = getProviderBudgets(profile)
  const providerAvailability = await getSchedulerProviderAvailability()
  const providerReadiness = await getProviderReadinessSnapshot()
  const events = providerTelemetryBus.getRecent(500)
  const usage = getRecentProviderUsage(events)
  const viewDemands = await listActiveViewDemands()
  const jobCounts = await prisma.ingestionJob.groupBy({
    by: ["laneKind", "status"],
    where: { profileId: profile.id },
    _count: { _all: true },
  })
  const verificationCounts = await prisma.verificationJob.groupBy({
    by: ["status"],
    where: { profileId: profile.id },
    _count: { _all: true },
  })
  const recentJobs = await prisma.ingestionJob.findMany({
    where: { profileId: profile.id },
    orderBy: [{ updatedAt: "desc" }],
    take: 40,
  })
  const oldestQueuedJob = await prisma.ingestionJob.findFirst({
    where: {
      profileId: profile.id,
      status: "QUEUED",
    },
    orderBy: { scheduledFor: "asc" },
    select: { scheduledFor: true, createdAt: true },
  })
  const recentDispatchLogs = await prisma.ingestionDispatchLog.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  })
  const continuousIngestStatus = await ensureSchedulerRuntime(profile)
  const desiredState = getDesiredSchedulerState(profile)
  const actualRuntimeState = getActualSchedulerRuntimeState()
  const fallbackInventoryParity = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalVaultKeys: 0,
      totalInventoryKeys: 0,
      missingInventoryRows: 0,
      staleInventoryRows: 0,
    },
    byVault: [],
    exceptions: [],
  }
  const [availableUniverseSymbols, planPreview, inventoryParity] = await Promise.all([
    withSchedulerTimeout(getGlobalUniverse(), SCHEDULER_SNAPSHOT_TIMEOUT_MS, [] as string[]),
    withSchedulerTimeout(buildSchedulerPlanPreview(profile, providerAvailability), SCHEDULER_SNAPSHOT_TIMEOUT_MS, [] as SchedulerPlanPreviewItem[]),
    withSchedulerTimeout(DataHealthManager.getInventoryParitySnapshot({ limit: 20 }), SCHEDULER_SNAPSHOT_TIMEOUT_MS, fallbackInventoryParity),
  ])
  const queuedAll1m = await prisma.ingestionJob.count({
    where: { profileId: profile.id, laneKind: "SELECTED_ALL_1M", status: "QUEUED" },
  })
  const queuedRealtime = await prisma.ingestionJob.count({
    where: { profileId: profile.id, laneKind: "SELECTED_OR_SP500_REALTIME", status: "QUEUED" },
  })
  const latestCycleId = recentDispatchLogs
    .map((log) => parseMetadataRecord(log.metadata)?.cycleId)
    .find((cycleId): cycleId is string => typeof cycleId === "string" && cycleId.length > 0) || null
  const lastCycleTrace = latestCycleId
    ? recentDispatchLogs
        .filter((log) => parseMetadataRecord(log.metadata)?.cycleId === latestCycleId)
        .slice(0, 20)
        .reverse()
        .map((log) => ({
          id: log.id,
          stage: log.stage,
          message: log.message,
          provider: log.provider,
          symbol: log.symbol,
          requestedTimeframe: log.requestedTimeframe,
          storageTimeframe: log.storageTimeframe,
          createdAt: log.createdAt,
          metadata: parseMetadataRecord(log.metadata),
        }))
    : []

  return {
    profile: {
      id: profile.id,
      name: profile.name,
      label: profile.label,
      description: profile.description,
      status: profile.status,
      providerBudgets: budgets.map((budget) => {
        const entry = usage.get(budget.provider)
        return {
          ...budget,
          runtimeAvailable: providerAvailability[budget.provider as keyof typeof providerAvailability] ?? true,
          usedLastMinute: entry?.calls ?? 0,
          errorCountLastMinute: entry?.errors ?? 0,
          throttledSymbols: Array.from(entry?.throttledSymbols ?? []),
          retryCountLastMinute: entry?.retries ?? 0,
          lastError: entry?.lastError ?? null,
          remainingCalls: Math.max(0, budget.maxCallsPerMinute - (entry?.calls ?? 0)),
        }
      }),
    },
    availableProfiles,
    lanes: profile.lanes.map((lane) => ({
      id: lane.id,
      kind: lane.kind,
      enabled: lane.enabled,
      priorityOrder: lane.priorityOrder,
      weight: lane.weight,
      reservedCallsPerMinute: lane.reservedCallsPerMinute,
      minCallsPerMinute: lane.minCallsPerMinute,
      targetRefreshSeconds: lane.targetRefreshSeconds,
      providerPreference: lane.providerPreference,
      canonicalIntervals: parseJsonArray(lane.canonicalIntervals),
      queued: jobCounts
        .filter((row) => row.laneKind === lane.kind && row.status === "QUEUED")
        .reduce((sum, row) => sum + row._count._all, 0),
      running: jobCounts
        .filter((row) => row.laneKind === lane.kind && row.status === "RUNNING")
        .reduce((sum, row) => sum + row._count._all, 0),
      completed: jobCounts
        .filter((row) => row.laneKind === lane.kind && row.status === "COMPLETED")
        .reduce((sum, row) => sum + row._count._all, 0),
      failed: jobCounts
        .filter((row) => row.laneKind === lane.kind && row.status === "FAILED")
        .reduce((sum, row) => sum + row._count._all, 0),
    })),
    targets: await Promise.all(profile.targets.map(async (target) => {
      const resolvedSymbols = await resolveTargetSymbols(target)
      return {
        id: target.id,
        name: target.name,
        preset: target.preset,
        enabled: target.enabled,
        providerPreference: target.providerPreference,
        canonicalIntervals: parseJsonArray(target.canonicalIntervals),
        symbolCount: resolvedSymbols.length,
        previewSymbols: resolvedSymbols.slice(0, 12),
        symbols: target.symbols.map((item) => ({
          id: item.id,
          symbol: item.symbol,
          enabled: item.enabled,
          canonicalIntervals: parseJsonArray(item.canonicalIntervals),
        })),
      }
    })),
    availableUniverseSymbols,
    viewDemands: viewDemands.map((demand) => ({
      id: demand.id,
      surface: demand.surface,
      symbol: demand.symbol,
      timeframe: demand.timeframe,
      priorityScore: demand.priorityScore,
      refreshIntervalSeconds: demand.refreshIntervalSeconds,
      lastSeenAt: demand.lastSeenAt,
      expiresAt: demand.expiresAt,
    })),
    runtime: {
      desiredState,
      actualRuntimeState,
      continuousIngest: continuousIngestStatus,
      afterHoursMode: isAfterHoursWindow(),
      queuePressureMode: queuedAll1m > queuedRealtime
        ? "one-minute-biased"
        : "balanced",
      queueMetrics: {
        totalQueued: jobCounts.filter((row) => row.status === "QUEUED").reduce((sum, row) => sum + row._count._all, 0),
        totalRunning: jobCounts.filter((row) => row.status === "RUNNING").reduce((sum, row) => sum + row._count._all, 0),
        totalFailed: jobCounts.filter((row) => row.status === "FAILED").reduce((sum, row) => sum + row._count._all, 0),
        oldestQueuedAt: oldestQueuedJob?.scheduledFor?.toISOString() ?? oldestQueuedJob?.createdAt?.toISOString() ?? null,
      },
    },
    providerReadiness,
    inventoryParity,
    planPreview,
    recentJobs,
    recentDispatchLogs: recentDispatchLogs.map((log) => ({
      ...log,
      metadata: log.metadata,
    })),
    lastCycleTrace: {
      cycleId: latestCycleId,
      logs: lastCycleTrace,
    },
    verificationSummary: {
      queued: verificationCounts.filter((row) => row.status === "QUEUED").reduce((sum, row) => sum + row._count._all, 0),
      running: verificationCounts.filter((row) => row.status === "RUNNING").reduce((sum, row) => sum + row._count._all, 0),
      completed: verificationCounts.filter((row) => row.status === "COMPLETED").reduce((sum, row) => sum + row._count._all, 0),
      failed: verificationCounts.filter((row) => row.status === "FAILED").reduce((sum, row) => sum + row._count._all, 0),
    },
  }
}

export async function updateSchedulerProfile(input: {
  profileId: string
  status?: import("@prisma/client").IngestionProfileStatus
  isDefault?: boolean
  providerBudgets?: Array<{ provider: string; maxCallsPerMinute: number; enabled: boolean; note?: string }>
  laneWeights?: Array<{ laneId: string; weight: number; enabled?: boolean; targetRefreshSeconds?: number }>
  targetUpdates?: Array<{ targetId: string; enabled?: boolean; providerPreference?: string | null; canonicalIntervals?: string[] }>
  targetSymbolUpdates?: Array<{ targetId: string; symbol: string; enabled: boolean; canonicalIntervals?: string[] }>
}) {
  if (input.isDefault) {
    await prisma.ingestionProfile.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    })
  }

  if (input.status || input.providerBudgets) {
    await prisma.ingestionProfile.update({
      where: { id: input.profileId },
      data: {
        status: input.status,
        isDefault: input.isDefault,
        providerBudgetsJson: input.providerBudgets ? JSON.stringify(input.providerBudgets) : undefined,
      },
    })
  } else if (typeof input.isDefault === "boolean") {
    await prisma.ingestionProfile.update({
      where: { id: input.profileId },
      data: { isDefault: input.isDefault },
    })
  }

  for (const laneUpdate of input.laneWeights ?? []) {
    await prisma.ingestionLane.update({
      where: { id: laneUpdate.laneId },
      data: {
        weight: laneUpdate.weight,
        enabled: laneUpdate.enabled,
        targetRefreshSeconds: laneUpdate.targetRefreshSeconds,
      },
    })
  }

  for (const targetUpdate of input.targetUpdates ?? []) {
    await prisma.ingestionTarget.update({
      where: { id: targetUpdate.targetId },
      data: {
        enabled: targetUpdate.enabled,
        providerPreference: targetUpdate.providerPreference,
        canonicalIntervals: targetUpdate.canonicalIntervals ? JSON.stringify(targetUpdate.canonicalIntervals) : undefined,
      },
    })
  }

  for (const symbolUpdate of input.targetSymbolUpdates ?? []) {
    await prisma.ingestionTargetSymbol.upsert({
      where: {
        targetId_symbol: {
          targetId: symbolUpdate.targetId,
          symbol: symbolUpdate.symbol.trim().toUpperCase(),
        },
      },
      update: {
        enabled: symbolUpdate.enabled,
        canonicalIntervals: symbolUpdate.canonicalIntervals
          ? JSON.stringify(symbolUpdate.canonicalIntervals)
          : undefined,
      },
      create: {
        targetId: symbolUpdate.targetId,
        symbol: symbolUpdate.symbol.trim().toUpperCase(),
        enabled: symbolUpdate.enabled,
        canonicalIntervals: JSON.stringify(symbolUpdate.canonicalIntervals ?? ["1m"]),
      },
    })
  }
}

export async function runSchedulerAdminAction(input: {
  action: string
  actorUserId: string
  profileId?: string
  provider?: string | null
  intervalMs?: number | null
  laneWeights?: Array<{ laneId: string; weight: number; enabled?: boolean; targetRefreshSeconds?: number }>
  targetUpdates?: Array<{ targetId: string; enabled?: boolean; providerPreference?: string | null; canonicalIntervals?: string[] }>
  targetSymbolUpdates?: Array<{ targetId: string; symbol: string; enabled: boolean; canonicalIntervals?: string[] }>
  providerBudgets?: Array<{ provider: string; maxCallsPerMinute: number; enabled: boolean; note?: string }>
  verificationMode?: "SAME_SOURCE" | "CROSS_SOURCE" | "BOTH"
  symbol?: string
  timeframe?: string
}) {
  const profile = input.profileId ? await prisma.ingestionProfile.findUnique({ where: { id: input.profileId } }) : await ensureDefaultIngestionProfile()
  if (!profile) {
    throw new Error("Mahita could not locate the scheduler profile.")
  }

  if (input.action === "start-scheduler") {
    await updateSchedulerProfile({
      profileId: profile.id,
      status: "ACTIVE",
    })
    const status = await continuousIngestController.start({
      provider: input.provider || undefined,
      intervalMs: input.intervalMs ?? undefined,
      useScheduler: true,
    })
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_SCHEDULER_START",
      metadata: JSON.stringify({ profileId: profile.id, provider: input.provider ?? null, intervalMs: input.intervalMs ?? null }),
    })
    return { success: true, status }
  }

  if (input.action === "stop-scheduler") {
    await updateSchedulerProfile({
      profileId: profile.id,
      status: "PAUSED",
    })
    const status = await continuousIngestController.stop()
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_SCHEDULER_STOP",
      metadata: JSON.stringify({ profileId: profile.id }),
    })
    return { success: true, status }
  }

  if (input.action === "save-profile") {
    await updateSchedulerProfile({
      profileId: profile.id,
      providerBudgets: input.providerBudgets,
      laneWeights: input.laneWeights,
      targetUpdates: input.targetUpdates,
      targetSymbolUpdates: input.targetSymbolUpdates,
    })
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_SCHEDULER_SAVE",
      metadata: JSON.stringify({ profileId: profile.id }),
    })
    return { success: true }
  }

  if (input.action === "run-one-cycle") {
    const result = await runSchedulerCompatibilityCycle({
      intervalMs: input.intervalMs ?? 60_000,
      providerOverride: input.provider ?? undefined,
      forceRun: true,
    })
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_RUN_ONE_CYCLE",
      metadata: JSON.stringify({ profileId: profile.id, intervalMs: input.intervalMs ?? 60_000 }),
    })
    return { success: true, result }
  }

  if (input.action === "refresh-inventory") {
    let result: unknown
    if (input.symbol && input.timeframe) {
      result = await DataHealthManager.refreshInventorySelection(
        input.symbol.toUpperCase(),
        input.timeframe as import("./types").Timeframe,
        input.provider || "schwab"
      )
    } else {
      await DataHealthManager.refreshInventory(input.provider || undefined)
      result = { scope: input.provider || "all-vaults" }
    }
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_REFRESH_INVENTORY",
      metadata: JSON.stringify({ profileId: profile.id, symbol: input.symbol ?? null, timeframe: input.timeframe ?? null, vault: input.provider ?? null }),
    })
    return { success: true, result }
  }

  if (input.action === "repair-inventory") {
    const result = await DataHealthManager.repairInventoryParity({
      vaultName: input.provider ?? undefined,
      limit: 100,
    })
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_REPAIR_INVENTORY",
      metadata: JSON.stringify({ profileId: profile.id, vault: input.provider ?? null }),
    })
    return { success: true, result }
  }

  if (input.action === "requeue-failed") {
    const failedJobs = await prisma.ingestionJob.findMany({
      where: {
        profileId: profile.id,
        status: "FAILED",
        ...(input.symbol ? { symbol: input.symbol.toUpperCase() } : {}),
        ...(input.timeframe ? { storageTimeframe: input.timeframe } : {}),
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 50,
    })

    for (const job of failedJobs) {
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: "QUEUED",
          scheduledFor: new Date(),
          startedAt: null,
          completedAt: null,
          lastError: null,
        },
      })
      await logDispatch({
        profileId: profile.id,
        ingestionJobId: job.id,
        laneKind: job.laneKind,
        stage: "requeued",
        message: `Requeued failed job for ${job.symbol} ${job.storageTimeframe}.`,
        provider: job.provider,
        symbol: job.symbol,
        requestedTimeframe: job.requestedTimeframe,
        storageTimeframe: job.storageTimeframe,
        metadata: {
          reason: "operator-requeue-failed",
        },
      })
    }

    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_REQUEUE_FAILED",
      metadata: JSON.stringify({ profileId: profile.id, requeued: failedJobs.length }),
    })
    return { success: true, requeued: failedJobs.length }
  }

  if (input.action === "run-after-hours-verification") {
    await seedAfterHoursVerificationJobs(profile.id)
    const verificationJobs = await prisma.verificationJob.findMany({
      where: {
        profileId: profile.id,
        status: "QUEUED",
      },
      orderBy: [{ scheduledFor: "asc" }, { createdAt: "asc" }],
      take: 10,
    })
    let completed = 0
    const failures: Array<{ id: string; symbol: string; error: string }> = []
    for (const job of verificationJobs) {
      try {
        await runVerificationJobNow(job.id)
        completed += 1
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown verification failure"
        failures.push({
          id: job.id,
          symbol: job.symbol,
          error: message,
        })
        await logDispatch({
          profileId: profile.id,
          laneKind: job.laneKind,
          stage: "verification-failed",
          message: `Verification failed for ${job.symbol} ${job.timeframe}: ${message}`,
          provider: job.sourceProvider ?? null,
          symbol: job.symbol,
          requestedTimeframe: job.timeframe,
          storageTimeframe: job.timeframe,
          metadata: {
            verificationJobId: job.id,
            error: message,
          },
        })
      }
    }
    await runSchedulerCompatibilityCycle({
      intervalMs: input.intervalMs ?? 60_000,
      providerOverride: input.provider ?? undefined,
    })
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_AFTER_HOURS_VERIFY_ENQUEUE",
      metadata: JSON.stringify({ profileId: profile.id }),
    })
    return { success: true, completed, failures }
  }

  if (input.action === "set-active-profile") {
    await updateSchedulerProfile({
      profileId: profile.id,
      isDefault: true,
    })
    await reconcileDefaultSchedulerRuntime()
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_SET_ACTIVE_PROFILE",
      metadata: JSON.stringify({ profileId: profile.id }),
    })
    return { success: true }
  }

  if (input.action === "run-repeat-verification") {
    if (!input.symbol || !input.timeframe) {
      throw new Error("symbol and timeframe are required for repeat verification.")
    }
    const providers = await resolveVerificationProviders({
      symbol: input.symbol,
      timeframe: input.timeframe,
      preferredProvider: input.provider ?? undefined,
    })
    const job = await prisma.verificationJob.create({
      data: {
        profileId: profile.id,
        laneKind: "REPEAT_FETCH_VERIFY",
        mode: input.verificationMode || "BOTH",
        symbol: input.symbol.toUpperCase(),
        timeframe: input.timeframe,
        sourceProvider: providers.sourceProvider,
        comparisonProvider: providers.comparisonProvider,
        status: "QUEUED",
        scheduledFor: new Date(),
      },
    })
    let failure: string | null = null
    try {
      await runVerificationJobNow(job.id)
    } catch (error) {
      failure = error instanceof Error ? error.message : "Unknown verification failure"
      await logDispatch({
        profileId: profile.id,
        laneKind: "REPEAT_FETCH_VERIFY",
        stage: "verification-failed",
        message: `Verification failed for ${input.symbol.toUpperCase()} ${input.timeframe}: ${failure}`,
        provider: providers.sourceProvider,
        symbol: input.symbol.toUpperCase(),
        requestedTimeframe: input.timeframe,
        storageTimeframe: input.timeframe,
        metadata: {
          verificationJobId: job.id,
          error: failure,
          requestedMode: input.verificationMode || "BOTH",
          sourceProvider: providers.sourceProvider,
          comparisonProvider: providers.comparisonProvider,
        },
      })
    }
    await writeAdminAuditEvent({
      actorUserId: input.actorUserId,
      action: "DI_UI_REPEAT_VERIFY_RUN",
      metadata: JSON.stringify({ profileId: profile.id, symbol: input.symbol, timeframe: input.timeframe, mode: input.verificationMode || "BOTH" }),
    })
    return {
      success: !failure,
      verificationJobId: job.id,
      sourceProvider: providers.sourceProvider,
      comparisonProvider: providers.comparisonProvider,
      failure,
    }
  }

  throw new Error("Unsupported scheduler action.")
}
