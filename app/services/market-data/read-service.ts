import prisma from "@/lib/prisma"
import { CustomerCatalogRow } from "@/lib/platform/customer-read-models"
import { getBaseRequirement } from "./timeframe-math"
import { Timeframe } from "./types"
import { vaultManager, withVaultQueryRetry } from "./vault-manager"

export type PlatformDataStorageClass = "native-cached" | "derived"
export type PlatformDataVerificationStatus =
  | "single-source-unverified"
  | "same-source-verified"
  | "cross-source-verified"
  | "derived-from-verified-base"
  | "disputed"
  | "stale"

export interface PlatformDataProvenance {
  requestedTimeframe: Timeframe
  storageTimeframe: Timeframe
  storageClass: PlatformDataStorageClass
  verificationStatus: PlatformDataVerificationStatus
  verificationMethod: string | null
  lastVerifiedAt: string | null
  vaultName: string
  sourceOfTruth: "vault-sqlite"
  sources: string[]
}

export interface CachedVaultBarRow {
  id: string
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  source: string | null
}

export interface CachedVaultBarPage {
  bars: CachedVaultBarRow[]
  totalCount: number
}

export async function readVaultBarsRange(input: {
  symbol: string
  timeframe: Timeframe
  startTime: number
  endTime: number
  vaultName?: string
}): Promise<CachedVaultBarRow[]> {
  const vaultName = input.vaultName || "schwab"
  const client = await vaultManager.getClient(vaultName)
  const bars = await withVaultQueryRetry(() =>
    client.marketData.findMany({
      where: {
        symbol: input.symbol,
        timeframe: input.timeframe,
        time: {
          gte: new Date(input.startTime * 1000),
          lte: new Date(input.endTime * 1000),
        },
      },
      orderBy: { time: "asc" },
    })
  )

  return bars.map((bar) => ({
    id: bar.id,
    time: Math.floor(bar.time.getTime() / 1000),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volume,
    source: bar.source,
  }))
}

export function classifyPlatformDataProvenance(input: {
  requestedTimeframe: Timeframe
  vaultName: string
  sources: string[]
  verificationStatus?: PlatformDataVerificationStatus | null
  verificationMethod?: string | null
  lastVerifiedAt?: string | null
}): PlatformDataProvenance {
  const storageTimeframe = getBaseRequirement(input.requestedTimeframe)
  const storageClass: PlatformDataStorageClass =
    storageTimeframe === input.requestedTimeframe ? "native-cached" : "derived"
  const verificationStatus: PlatformDataVerificationStatus =
    input.verificationStatus ??
    (input.sources.includes("consolidator-verified") || input.vaultName === "master"
      ? "cross-source-verified"
      : "single-source-unverified")

  return {
    requestedTimeframe: input.requestedTimeframe,
    storageTimeframe,
    storageClass,
    verificationStatus,
    verificationMethod: input.verificationMethod ?? null,
    lastVerifiedAt: input.lastVerifiedAt ?? null,
    vaultName: input.vaultName,
    sourceOfTruth: "vault-sqlite",
    sources: [...input.sources].sort(),
  }
}

export async function listDistinctVaultSources(input: {
  symbol: string
  timeframe: Timeframe
  startTime: number
  endTime: number
  vaultName?: string
}): Promise<string[]> {
  const vaultName = input.vaultName || "schwab"
  const client = await vaultManager.getClient(vaultName)
  const rows = await withVaultQueryRetry(() =>
    client.marketData.findMany({
      where: {
        symbol: input.symbol,
        timeframe: input.timeframe,
        time: {
          gte: new Date(input.startTime * 1000),
          lte: new Date(input.endTime * 1000),
        },
      },
      select: { source: true },
      distinct: ["source"],
    })
  )

  return rows.map((row) => row.source).filter((source): source is string => Boolean(source))
}

export async function readVaultBarsPage(input: {
  symbol: string
  timeframe: Timeframe
  page: number
  pageSize: number
  vaultName?: string
}): Promise<CachedVaultBarPage> {
  const vaultName = input.vaultName || "schwab"
  const client = await vaultManager.getClient(vaultName)
  const bars = await withVaultQueryRetry(() =>
    client.marketData.findMany({
      where: {
        symbol: input.symbol,
        timeframe: input.timeframe,
      },
      orderBy: { time: "desc" },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize,
    })
  )
  const totalCount = await withVaultQueryRetry(() =>
    client.marketData.count({
      where: {
        symbol: input.symbol,
        timeframe: input.timeframe,
      },
    })
  )

  return {
    bars: bars.map((bar) => ({
      id: bar.id,
      time: Math.floor(bar.time.getTime() / 1000),
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      source: bar.source,
    })),
    totalCount,
  }
}

export async function getCanonicalChartCatalogRows(vaultName = "schwab"): Promise<CustomerCatalogRow[]> {
  let vault = await prisma.vault.findUnique({
    where: { name: vaultName },
    select: { id: true },
  })

  if (!vault) {
    await vaultManager.seedVaults()
    vault = await prisma.vault.findUnique({
      where: { name: vaultName },
      select: { id: true },
    })
  }

  if (!vault) {
    return []
  }

  const inventoryRows = await prisma.dataInventory.findMany({
    where: { vaultId: vault.id },
    select: {
      symbol: true,
      timeframe: true,
      lastSynced: true,
      lastBar: true,
      barCount: true,
    },
    orderBy: [{ symbol: "asc" }, { timeframe: "asc" }],
  })

  if (inventoryRows.length > 0) {
    return inventoryRows
  }

  const client = await vaultManager.getClient(vaultName)
  const marketRows = await withVaultQueryRetry(() =>
    client.marketData.findMany({
      distinct: ["symbol", "timeframe"],
      select: {
        symbol: true,
        timeframe: true,
        time: true,
      },
      orderBy: [{ symbol: "asc" }, { timeframe: "asc" }, { time: "desc" }],
    })
  )

  return marketRows.map((row) => ({
    symbol: row.symbol,
    timeframe: row.timeframe,
    lastSynced: row.time,
    lastBar: row.time,
    barCount: 0,
  }))
}

export async function getInventoryProvenance(input: {
  symbol: string
  timeframe: Timeframe
  vaultName?: string
}) {
  const vault = await prisma.vault.findUnique({
    where: { name: input.vaultName || "schwab" },
    select: { id: true },
  })

  if (!vault) {
    return null
  }

  return prisma.dataInventory.findUnique({
    where: {
      vaultId_symbol_timeframe: {
        vaultId: vault.id,
        symbol: input.symbol,
        timeframe: getBaseRequirement(input.timeframe),
      },
    },
    select: {
      verificationStatus: true,
      verificationMethod: true,
      lastVerifiedAt: true,
      canonicalInterval: true,
      storageClass: true,
    },
  })
}
