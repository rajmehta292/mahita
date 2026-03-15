import prisma from "@/lib/prisma"
import { providerTelemetryBus } from "@/app/services/market-data/provider-telemetry"
import { getSchedulerSnapshot, runSchedulerAdminAction } from "@/app/services/market-data/scheduler"
import { readVaultBarsPage } from "@/app/services/market-data/read-service"
import type { Timeframe } from "@/app/services/market-data/types"
import { vaultManager } from "@/app/services/market-data/vault-manager"
import {
  assertRequiredDiUiModels,
  assertRequiredRuntimeModels,
  getRuntimeHealthSnapshot,
} from "@/lib/runtime-health"

const STORAGE_TIMEFRAMES: Timeframe[] = [
  "1s",
  "5s",
  "15s",
  "30s",
  "1m",
  "3m",
  "5m",
  "10m",
  "15m",
  "30m",
  "45m",
  "1h",
  "2h",
  "3h",
  "4h",
  "1d",
  "1w",
  "1M",
]

function normalizeStorageTimeframe(timeframe?: string | null): Timeframe {
  if (!timeframe) return "1m"
  return STORAGE_TIMEFRAMES.includes(timeframe as Timeframe) ? (timeframe as Timeframe) : "1m"
}

function ensureDiUiModels() {
  assertRequiredDiUiModels()
}

function summarizeRecentEvents(limit = 200) {
  const events = providerTelemetryBus.getRecent(limit)
  const oneMinuteAgo = Date.now() - 60_000

  const metrics = new Map<string, { calls: number; errors: number; retries: number; lastError: string | null; throttledSymbols: Set<string> }>()

  for (const event of events) {
    if (new Date(event.timestamp).getTime() < oneMinuteAgo) continue
    const provider = event.provider || "unknown"
    if (provider === "unknown") continue
    const metric = metrics.get(provider) ?? {
      calls: 0,
      errors: 0,
      retries: 0,
      lastError: null,
      throttledSymbols: new Set<string>(),
    }
    if (event.kind === "request") metric.calls += 1
    if (event.kind === "error") {
      metric.errors += 1
      metric.lastError = event.message
      if (event.message.includes("RATE_LIMITED") && event.symbol) {
        metric.retries += 1
        metric.throttledSymbols.add(event.symbol)
      }
    }
    metrics.set(provider, metric)
  }

  return {
    metrics: Array.from(metrics.entries()).map(([provider, value]) => ({
      provider,
      callsPerMinute: value.calls,
      errorCount: value.errors,
      retryCount: value.retries,
      throttledSymbols: Array.from(value.throttledSymbols),
      lastError: value.lastError,
    })),
    events,
  }
}

export async function getDiUiSchedulerSnapshot() {
  const runtimeHealth = await getRuntimeHealthSnapshot()
  if (!runtimeHealth.runtime.diUiPrismaClientReady) {
    return {
      runtimeHealth,
      scheduler: null,
    }
  }

  ensureDiUiModels()
  const scheduler = await getSchedulerSnapshot()

  return {
    runtimeHealth,
    scheduler,
  }
}

export async function getDiUiCallerSnapshot() {
  return summarizeRecentEvents(300)
}

export async function getDiUiProcessorSnapshot() {
  const runtimeHealth = await getRuntimeHealthSnapshot()
  if (!runtimeHealth.runtime.diUiPrismaClientReady) {
    return {
      runtimeHealth,
      jobs: null,
      logs: null,
    }
  }

  ensureDiUiModels()
  const [jobs, logs] = await Promise.all([
    prisma.ingestionJob.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 80,
    }),
    prisma.ingestionDispatchLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 120,
    }),
  ])

  return {
    runtimeHealth,
    jobs,
    logs,
  }
}

export async function getDiUiVerificationSnapshot() {
  const runtimeHealth = await getRuntimeHealthSnapshot()
  if (!runtimeHealth.runtime.diUiPrismaClientReady) {
    return {
      runtimeHealth,
      jobs: null,
      observations: null,
      statusSummary: {},
      classificationSummary: {},
    }
  }

  ensureDiUiModels()
  const [jobs, observations] = await Promise.all([
    prisma.verificationJob.findMany({
      orderBy: [{ updatedAt: "desc" }],
      take: 60,
    }),
    prisma.verificationObservation.findMany({
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ])

  const statusSummary = jobs.reduce<Record<string, number>>((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1
    return acc
  }, {})

  const classificationSummary = observations.reduce<Record<string, number>>((acc, observation) => {
    acc[observation.classification] = (acc[observation.classification] || 0) + 1
    return acc
  }, {})

  return {
    runtimeHealth,
    jobs,
    observations,
    statusSummary,
    classificationSummary,
  }
}

async function resolveStorageVault(input: {
  requestedVaultName?: string | null
  symbol: string
  timeframe: Timeframe
}) {
  if (input.requestedVaultName && input.requestedVaultName !== "auto") {
    return input.requestedVaultName
  }

  const inventoryMatch = await prisma.dataInventory.findFirst({
    where: {
      symbol: input.symbol,
      timeframe: input.timeframe,
      barCount: { gt: 0 },
    },
    include: {
      vault: {
        select: { name: true },
      },
    },
    orderBy: [{ barCount: "desc" }, { lastSynced: "desc" }],
  })

  if (inventoryMatch?.vault?.name) {
    return inventoryMatch.vault.name
  }

  const vaults = await prisma.vault.findMany({
    where: { isEnabled: true },
    orderBy: [{ isEnabled: "desc" }, { name: "asc" }],
    select: { name: true },
  })

  for (const vault of vaults) {
    const page = await readVaultBarsPage({
      symbol: input.symbol,
      timeframe: input.timeframe,
      page: 1,
      pageSize: 1,
      vaultName: vault.name,
    })

    if (page.totalCount > 0) {
      return vault.name
    }
  }

  return "schwab"
}

export async function getDiUiStorageSnapshot(input: {
  symbol?: string | null
  timeframe?: string | null
  vaultName?: string | null
  verificationStatus?: string | null
  page?: number
  pageSize?: number
}) {
  assertRequiredRuntimeModels()
  const page = Math.max(1, input.page || 1)
  const pageSize = Math.max(10, Math.min(200, input.pageSize || 50))
  const symbol = input.symbol?.trim().toUpperCase() || "AAPL"
  const timeframe = normalizeStorageTimeframe(input.timeframe)

  let vaults = await prisma.vault.findMany({
    orderBy: [{ isEnabled: "desc" }, { name: "asc" }],
  })

  if (vaults.length === 0) {
    await vaultManager.seedVaults()
    vaults = await prisma.vault.findMany({
      orderBy: [{ isEnabled: "desc" }, { name: "asc" }],
    })
  }

  const vaultName = await resolveStorageVault({
    requestedVaultName: input.vaultName,
    symbol,
    timeframe,
  })

  const [inventories, bars] = await Promise.all([
    prisma.dataInventory.findMany({
      where: {
        ...(vaultName ? { vault: { name: vaultName } } : {}),
        ...(input.symbol ? { symbol } : {}),
        ...(input.timeframe ? { timeframe } : {}),
        ...(input.verificationStatus ? { verificationStatus: input.verificationStatus } : {}),
      },
      include: {
        vault: {
          select: {
            name: true,
            type: true,
            isEnabled: true,
          },
        },
      },
      orderBy: [{ symbol: "asc" }, { timeframe: "asc" }],
      take: 200,
    }),
    readVaultBarsPage({
      symbol,
      timeframe,
      page,
      pageSize,
      vaultName,
    }),
  ])

  return {
    vaults,
    inventories,
    bars,
    filters: {
      symbol,
      timeframe,
      vaultName,
      verificationStatus: input.verificationStatus || null,
      page,
      pageSize,
    },
  }
}

export async function runDiUiAction(input: Parameters<typeof runSchedulerAdminAction>[0]) {
  ensureDiUiModels()
  return runSchedulerAdminAction(input)
}
