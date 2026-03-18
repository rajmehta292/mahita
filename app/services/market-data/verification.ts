import prisma from "@/lib/prisma"
import { marketDataStore } from "./store"
import { vaultManager } from "./vault-manager"
import { DataHealthManager } from "./health"
import { getProviderAvailabilitySnapshot, resolveVerificationProviders } from "./provider-policy"
import { Timeframe } from "./types"

const DEFAULT_POLICY = {
  sameSourcePriceToleranceBps: 5,
  crossSourcePriceToleranceBps: 10,
  volumeTolerancePct: 5,
}

function getVerificationWindowBars(timeframe: string) {
  switch (timeframe) {
    case "1m":
      return 240
    case "1h":
      return 120
    case "1w":
      return 52
    default:
      return 120
  }
}

function timeframeSeconds(timeframe: string) {
  switch (timeframe) {
    case "1m":
      return 60
    case "1h":
      return 3600
    case "1d":
      return 86400
    case "1w":
      return 604800
    default:
      return 60
  }
}

async function getStoredBars(symbol: string, timeframe: string, rangeStart: number, rangeEnd: number, vaultName = "schwab") {
  const client = await vaultManager.getClient(vaultName)
  const rows = await client.marketData.findMany({
    where: {
      symbol,
      timeframe,
      time: {
        gte: new Date(rangeStart * 1000),
        lte: new Date(rangeEnd * 1000),
      },
    },
    orderBy: { time: "asc" },
  })

  return rows.map((row) => ({
    time: Math.floor(row.time.getTime() / 1000),
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    source: row.source,
  }))
}

function getVaultNameForProvider(provider?: string | null) {
  return provider === "yahoo" ? "yahoo" : "schwab"
}

async function getVerificationPolicy(profileId: string | null | undefined, timeframe: string) {
  const policy = await prisma.verificationPolicy.findFirst({
    where: {
      profileId: profileId ?? null,
      timeframe,
    },
  })

  return {
    sameSourcePriceToleranceBps: policy?.sameSourcePriceToleranceBps ?? DEFAULT_POLICY.sameSourcePriceToleranceBps,
    crossSourcePriceToleranceBps: policy?.crossSourcePriceToleranceBps ?? DEFAULT_POLICY.crossSourcePriceToleranceBps,
    volumeTolerancePct: policy?.volumeTolerancePct ?? DEFAULT_POLICY.volumeTolerancePct,
  }
}

function classifyComparison(input: {
  primaryClose: number | null
  secondaryClose: number | null
  primaryVolume: number | null
  secondaryVolume: number | null
  priceToleranceBps: number
  volumeTolerancePct: number
}) {
  if (input.primaryClose == null || input.secondaryClose == null) {
    return {
      classification: "PROVIDER_GAP" as const,
      decision: "KEEP_EXISTING",
      priceDiffBps: null,
      volumeDiffPct: null,
    }
  }

  const priceDiffBps = input.primaryClose === 0
    ? 0
    : Math.abs((input.primaryClose - input.secondaryClose) / input.primaryClose) * 10_000
  const volumeDiffPct =
    input.primaryVolume == null || input.secondaryVolume == null || input.primaryVolume === 0
      ? null
      : Math.abs((input.primaryVolume - input.secondaryVolume) / input.primaryVolume) * 100

  if (priceDiffBps === 0 && (volumeDiffPct == null || volumeDiffPct === 0)) {
    return {
      classification: "EXACT_MATCH" as const,
      decision: "ACCEPT_CANONICAL",
      priceDiffBps,
      volumeDiffPct,
    }
  }

  if (priceDiffBps <= input.priceToleranceBps && (volumeDiffPct == null || volumeDiffPct <= input.volumeTolerancePct)) {
    return {
      classification: "WITHIN_TOLERANCE" as const,
      decision: "ACCEPT_CANONICAL",
      priceDiffBps,
      volumeDiffPct,
    }
  }

  return {
    classification: "MATERIAL_DIFFERENCE" as const,
    decision: "MARK_DISPUTED",
    priceDiffBps,
    volumeDiffPct,
  }
}

async function updateInventoryVerificationStatus(input: {
  symbol: string
  timeframe: string
  verificationStatus: string
  verificationMethod: string
  vaultName?: string
}) {
  const vault = await prisma.vault.findUnique({
    where: { name: input.vaultName || "schwab" },
    select: { id: true },
  })
  if (!vault) return

  await prisma.dataInventory.updateMany({
    where: {
      vaultId: vault.id,
      symbol: input.symbol,
      timeframe: input.timeframe,
    },
    data: {
      verificationStatus: input.verificationStatus,
      verificationMethod: input.verificationMethod,
      lastVerifiedAt: new Date(),
      canonicalInterval: input.timeframe,
      storageClass: "native-cached",
    },
  })

  await prisma.ingestionJob.updateMany({
    where: {
      symbol: input.symbol,
      storageTimeframe: input.timeframe,
      status: "COMPLETED",
    },
    data: {
      verificationStatus: input.verificationStatus,
    },
  })
}

export async function seedAfterHoursVerificationJobs(profileId: string) {
  const recentOneMinuteJobs = await prisma.ingestionJob.findMany({
    where: {
      profileId,
      storageTimeframe: "1m",
      status: "COMPLETED",
    },
    orderBy: { completedAt: "desc" },
    take: 40,
  })

  const weakestInventory = await prisma.dataInventory.findMany({
    where: {
      timeframe: "1m",
    },
    orderBy: [{ healthScore: "asc" }, { lastSynced: "asc" }],
    take: 20,
  })

  const candidates = new Map<string, { symbol: string; timeframe: string; sourceProvider?: string | null }>()
  for (const job of recentOneMinuteJobs) {
    candidates.set(`${job.symbol}:${job.storageTimeframe}`, {
      symbol: job.symbol,
      timeframe: job.storageTimeframe,
      sourceProvider: job.provider,
    })
  }
  for (const row of weakestInventory) {
    candidates.set(`${row.symbol}:${row.timeframe}`, {
      symbol: row.symbol,
      timeframe: row.timeframe,
      sourceProvider: row.source,
    })
  }

  for (const candidate of candidates.values()) {
    const exists = await prisma.verificationJob.findFirst({
      where: {
        profileId,
        symbol: candidate.symbol,
        timeframe: candidate.timeframe,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      select: { id: true },
    })

    if (exists) continue

    await prisma.verificationJob.create({
      data: {
        profileId,
        laneKind: "AFTER_HOURS_VERIFY",
        mode: "BOTH",
        symbol: candidate.symbol,
        timeframe: candidate.timeframe,
        sourceProvider: candidate.sourceProvider || "schwab",
        comparisonProvider: candidate.sourceProvider === "yahoo" ? "schwab" : "yahoo",
        status: "QUEUED",
        scheduledFor: new Date(),
      },
    })
  }
}

export async function runVerificationJobNow(verificationJobId: string) {
  const job = await prisma.verificationJob.findUnique({
    where: { id: verificationJobId },
  })
  if (!job) {
    throw new Error("Mahita could not locate the verification job.")
  }

  await prisma.verificationObservation.deleteMany({
    where: { verificationJobId },
  })

  await prisma.verificationJob.update({
    where: { id: verificationJobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attemptCount: { increment: 1 },
      lastError: null,
    },
  })

  try {
    const availability = await getProviderAvailabilitySnapshot()
    const timeframe = job.timeframe as Timeframe
    const windowBars = getVerificationWindowBars(job.timeframe)
    const intervalSeconds = timeframeSeconds(job.timeframe)
    const providerResolution = resolveVerificationProviders({
      preferredProvider: job.sourceProvider || "schwab",
      availability,
    })
    const primaryProvider = providerResolution.sourceProvider || "schwab"

    let actualMode = job.mode
    let comparisonProvider: string | null = null
    if (job.mode === "SAME_SOURCE") {
      comparisonProvider = primaryProvider
    } else if (providerResolution.comparisonProvider && providerResolution.comparisonProvider !== primaryProvider) {
      comparisonProvider = providerResolution.comparisonProvider
    } else if (job.mode === "BOTH") {
      actualMode = "SAME_SOURCE"
      comparisonProvider = primaryProvider
    }

    const sourceVaultName = getVaultNameForProvider(primaryProvider)
    const health = await DataHealthManager.getHealth(job.symbol, timeframe, sourceVaultName)
    const rangeEnd = health.endIndex ? Math.floor(health.endIndex.getTime() / 1000) : Math.floor(Date.now() / 1000)
    const rangeStart = Math.max(0, rangeEnd - windowBars * intervalSeconds)
    const storedBars = await getStoredBars(job.symbol, job.timeframe, rangeStart, rangeEnd, sourceVaultName)
    const policy = await getVerificationPolicy(job.profileId, job.timeframe)

    const primaryFetched = await marketDataStore.fetchProviderBars(primaryProvider, job.symbol, timeframe, rangeStart, rangeEnd)
    const secondaryFetched = actualMode === "SAME_SOURCE"
      ? primaryFetched
      : comparisonProvider
        ? await marketDataStore.fetchProviderBars(comparisonProvider, job.symbol, timeframe, rangeStart, rangeEnd)
        : []

    const storedMap = new Map(storedBars.map((bar) => [bar.time, bar]))
    const primaryMap = new Map(primaryFetched.map((bar) => [bar.time, bar]))
    const secondaryMap = new Map(secondaryFetched.map((bar) => [bar.time, bar]))
    const allTimes = Array.from(new Set([...storedMap.keys(), ...primaryMap.keys(), ...secondaryMap.keys()])).sort((a, b) => a - b)

    let disputed = false
    let verifiedCount = 0

    for (const time of allTimes) {
      const stored = storedMap.get(time) || null
      const primary = primaryMap.get(time) || null
      const secondary = secondaryMap.get(time) || null

      let observation:
        | {
            classification: "EXACT_MATCH" | "WITHIN_TOLERANCE" | "MATERIAL_DIFFERENCE" | "PROVIDER_GAP"
            decision: string
            priceDiffBps: number | null
            volumeDiffPct: number | null
          }
        | {
            classification: "PARTIAL_OVERLAP"
            decision: string
            priceDiffBps: null
            volumeDiffPct: null
          }

      if (!stored || (!primary && !secondary)) {
        observation = {
          classification: "PARTIAL_OVERLAP",
          decision: "KEEP_EXISTING",
          priceDiffBps: null,
          volumeDiffPct: null,
        }
      } else if (actualMode === "SAME_SOURCE") {
        observation = classifyComparison({
          primaryClose: stored?.close ?? null,
          secondaryClose: primary?.close ?? null,
          primaryVolume: stored?.volume ?? null,
          secondaryVolume: primary?.volume ?? null,
          priceToleranceBps: policy.sameSourcePriceToleranceBps,
          volumeTolerancePct: policy.volumeTolerancePct,
        })
      } else {
        observation = classifyComparison({
          primaryClose: primary?.close ?? stored?.close ?? null,
          secondaryClose: secondary?.close ?? null,
          primaryVolume: primary?.volume ?? stored?.volume ?? null,
          secondaryVolume: secondary?.volume ?? null,
          priceToleranceBps: policy.crossSourcePriceToleranceBps,
          volumeTolerancePct: policy.volumeTolerancePct,
        })
      }

      if (observation.classification === "MATERIAL_DIFFERENCE") {
        disputed = true
      }
      if (observation.classification === "EXACT_MATCH" || observation.classification === "WITHIN_TOLERANCE") {
        verifiedCount += 1
      }

      await prisma.verificationObservation.create({
        data: {
          verificationJobId,
          barTime: new Date(time * 1000),
          classification: observation.classification,
          decision: observation.decision,
          primaryProvider,
          secondaryProvider: comparisonProvider,
          primaryClose: primary?.close ?? stored?.close ?? null,
          secondaryClose: secondary?.close ?? null,
          priceDiffBps: observation.priceDiffBps,
          primaryVolume: primary?.volume ?? stored?.volume ?? null,
          secondaryVolume: secondary?.volume ?? null,
          volumeDiffPct: observation.volumeDiffPct,
          metadata: JSON.stringify({
            storedClose: stored?.close ?? null,
            mode: job.mode,
          }),
        },
      })
    }

    const verificationStatus = disputed
      ? "disputed"
      : actualMode === "SAME_SOURCE"
        ? "same-source-verified"
        : comparisonProvider
          ? "cross-source-verified"
          : "stale"
    const verificationMethod =
      disputed
        ? comparisonProvider && comparisonProvider !== primaryProvider
          ? "cross-source-disputed"
          : "same-source-disputed"
        : actualMode === "SAME_SOURCE"
          ? "same-source-repeat"
          : comparisonProvider
            ? "cross-source-compare"
            : "provider-gap"

    await prisma.verificationJob.update({
      where: { id: verificationJobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        resultSummary: JSON.stringify({
          rangeStart,
          rangeEnd,
          barsCompared: allTimes.length,
          verifiedCount,
          disputed,
          verificationStatus,
          verificationMethod,
          actualMode,
          primaryProvider,
          comparisonProvider,
        }),
        lastVerifiedAt: new Date(),
        sourceProvider: primaryProvider,
        comparisonProvider,
      },
    })

    await updateInventoryVerificationStatus({
      symbol: job.symbol,
      timeframe: job.timeframe,
      verificationStatus,
      verificationMethod,
      vaultName: sourceVaultName,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown verification failure"
    await prisma.verificationJob.update({
      where: { id: verificationJobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        lastError: message,
      },
    })
    throw error
  }
}
