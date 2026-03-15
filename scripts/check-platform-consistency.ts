#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import {
  readVaultBarsPage,
  readVaultBarsRange,
  listDistinctVaultSources,
  getInventoryProvenance,
  classifyPlatformDataProvenance,
  type PlatformDataVerificationStatus,
} from "../app/services/market-data/read-service"
import { DataHealthManager } from "../app/services/market-data/health"
import { getBaseRequirement } from "../app/services/market-data/timeframe-math"
import type { Timeframe } from "../app/services/market-data/types"

type ConsistencyCase = {
  symbol: string
  timeframe: Timeframe
  lookbackSeconds: number
  vaultName?: string
}

function coerceVerificationStatus(
  value: string | null | undefined
): PlatformDataVerificationStatus | null | undefined {
  if (!value) {
    return null
  }

  switch (value) {
    case "single-source-unverified":
    case "same-source-verified":
    case "cross-source-verified":
    case "derived-from-verified-base":
    case "disputed":
    case "stale":
      return value
    default:
      return null
  }
}

function parseArgs(argv: string[]) {
  const args = {
    output: path.join(process.cwd(), "artifacts", "platform-data-validation", "consistency-checks.json"),
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]
    if (value === "--output" && argv[index + 1]) {
      args.output = path.isAbsolute(argv[index + 1])
        ? argv[index + 1]
        : path.join(process.cwd(), argv[index + 1])
      index += 1
    }
  }

  return args
}

function createCases(): ConsistencyCase[] {
  return [
    { symbol: "AAPL", timeframe: "1m", lookbackSeconds: 2 * 24 * 60 * 60, vaultName: "schwab" },
    { symbol: "CRM", timeframe: "1m", lookbackSeconds: 2 * 24 * 60 * 60, vaultName: "schwab" },
    { symbol: "MSFT", timeframe: "1m", lookbackSeconds: 2 * 24 * 60 * 60, vaultName: "schwab" },
    { symbol: "AAPL", timeframe: "30s", lookbackSeconds: 24 * 60 * 60, vaultName: "schwab" },
    { symbol: "WMT", timeframe: "1m", lookbackSeconds: 2 * 24 * 60 * 60, vaultName: "schwab" },
  ]
}

async function runCase(input: ConsistencyCase) {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = endTime - input.lookbackSeconds
  const storageTimeframe = getBaseRequirement(input.timeframe)
  const vaultName = input.vaultName || "schwab"
  const rangeBars = await readVaultBarsRange({
    symbol: input.symbol,
    timeframe: storageTimeframe,
    startTime,
    endTime,
    vaultName,
  })
  const barsPage = await readVaultBarsPage({
    symbol: input.symbol,
    timeframe: storageTimeframe,
    page: 1,
    pageSize: 25,
    vaultName,
  })
  const sources = await listDistinctVaultSources({
    symbol: input.symbol,
    timeframe: storageTimeframe,
    startTime,
    endTime,
    vaultName,
  })
  const inventoryProvenance = await getInventoryProvenance({
    symbol: input.symbol,
    timeframe: input.timeframe,
    vaultName,
  })
  const provenance = classifyPlatformDataProvenance({
    requestedTimeframe: input.timeframe,
    vaultName,
    sources,
    verificationStatus: coerceVerificationStatus(inventoryProvenance?.verificationStatus),
    verificationMethod: inventoryProvenance?.verificationMethod ?? null,
    lastVerifiedAt: inventoryProvenance?.lastVerifiedAt?.toISOString() ?? null,
  })
  const health = await DataHealthManager.getHealth(input.symbol, storageTimeframe, vaultName)

  return {
    symbol: input.symbol,
    requestedTimeframe: input.timeframe,
    storageTimeframe,
    vaultName,
    routeLikeCount: rangeBars.length,
    cacheBars: rangeBars.length,
    fetchedBars: 0,
    persistedBars: 0,
    storagePageCount: barsPage.totalCount,
    sampleBars: barsPage.bars.slice(0, 3),
    sources,
    provenance,
    inventoryProvenance,
    health: {
      count: health.count,
      healthScore: health.healthScore,
      targetCoveragePercent: health.targetCoveragePercent,
      gapCount: health.gapCount ?? health.gaps.length,
      source: health.source,
    },
    warnings: [],
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const results = []

  for (const item of createCases()) {
    try {
      results.push({
        ok: true,
        ...(await runCase(item)),
      })
    } catch (error) {
      results.push({
        ok: false,
        symbol: item.symbol,
        requestedTimeframe: item.timeframe,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    sourceOfTruth: {
      bars: "vault-sqlite",
      metadata: "main-prisma-db",
      parquet: "experimental",
    },
    results,
  }

  await fs.mkdir(path.dirname(args.output), { recursive: true })
  await fs.writeFile(args.output, JSON.stringify(payload, null, 2))
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[check-platform-consistency] Failed:", error)
  process.exitCode = 1
})
