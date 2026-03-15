import crypto from "crypto"
import YahooFinance from "yahoo-finance2"
import prisma from "@/lib/prisma"
import { getVisibleDocs, getDocHref } from "@/lib/docs"
import { getCanonicalChartCatalogRows } from "@/app/services/market-data/read-service"
import { DOW30_SYMBOLS, SP500_SYMBOLS, CRYPTO_SYMBOLS, FOREX_SYMBOLS } from "@/app/services/market-data/universe"
import { getSchwabClient } from "@/app/services/schwab/client"
import { vaultManager, withVaultQueryRetry } from "@/app/services/market-data/vault-manager"
import {
  requireUserSchwabBrokerageConnection,
  resolveBrokerageAccountSelection,
} from "@/lib/brokerage-connections"
import { parseStoredStringArray } from "@/lib/preferences-serialization"
import { getSchwabCallbackUrl } from "@/lib/schwab-config"
import { BUILT_IN_SCREENER_PRESETS } from "./presets"
import { SCREENER_FIELDS, SCREENER_GROUP_TABS, SCREENER_ORDER_OPTIONS, SCREENER_SIGNALS } from "./field-registry"
import { SCREENER_RESULT_TABS } from "./result-tabs"
import type {
  GlobalSearchGroup,
  GlobalSearchResult,
  ScreenerFieldDefinition,
  ScreenerFilterClause,
  ScreenerMetricPayload,
  ScreenerPresetDocument,
  ScreenerQueryRequest,
  ScreenerQueryResponse,
  ScreenerRow,
} from "./types"

type QuoteResult = Record<string, unknown>
type QuoteSummaryResult = Record<string, Record<string, unknown> | null | undefined>

interface YahooFinanceClient {
  quote(symbol: string): Promise<unknown>
  quoteSummary(symbol: string, options: { modules: string[] }): Promise<unknown>
}

const yahoo = new (YahooFinance as unknown as {
  new (options: { suppressNotices: string[] }): YahooFinanceClient
})({ suppressNotices: ["ripHistorical"] })

function getWorkspaceChartHref(symbol: string, timeframe = "1d") {
  return `/superchart?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}`
}
const DEFAULT_QUERY_PAGE_SIZE = 20
const SCREENER_CACHE_TTL_MS = 2 * 60 * 1000
const SNAPSHOT_STALE_MS = 6 * 60 * 60 * 1000
const QUOTE_CONCURRENCY = 8
const CONFIG_WARM_LIMIT = 24
const QUERY_WARM_LIMIT = 72
const SEARCH_WARM_LIMIT = 24

interface BarRow {
  close: number
  high: number
  low: number
  open: number
  volume: number
  time: Date
}

interface InstrumentSnapshotRecord {
  id: string
  symbol: string
  name: string | null
  assetType: string
  exchange: string | null
  country: string | null
  sector: string | null
  industry: string | null
  isEtf: boolean
  sponsor: string | null
  tags: string | null
  enabled: boolean
  updatedAt: Date
  metricSnapshot: {
    asOf: Date
    source: string
    price: number | null
    changePercent: number | null
    volume: number | null
    marketCap: number | null
    sector: string | null
    industry: string | null
    country: string | null
    exchange: string | null
    assetType: string | null
    descriptiveJson: string | null
    fundamentalJson: string | null
    technicalJson: string | null
    newsJson: string | null
    etfJson: string | null
  } | null
}

function uniq(values: string[]) {
  return [...new Set(values.filter(Boolean))]
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return await Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Timed out after ${timeoutMs}ms`)), timeoutMs)
    }),
  ])
}

function capitalize(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ")
}

function fireAndForget<T>(promise: Promise<T>) {
  void promise.catch((error) => {
    console.warn("[Screener] Background task failed:", error)
  })
}

function safeNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null
}

function round(value: number | null | undefined, digits = 2) {
  if (value == null || !Number.isFinite(value)) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function toPercent(value: number | null | undefined) {
  return value == null ? null : round(value * 100, 2)
}

function movingAverage(values: number[], period: number) {
  if (values.length < period) return null
  const subset = values.slice(values.length - period)
  return round(subset.reduce((sum, value) => sum + value, 0) / period, 4)
}

function relativeVolume(volumes: number[]) {
  if (volumes.length < 20) return null
  const recent = volumes[volumes.length - 1]
  const average = volumes.slice(Math.max(0, volumes.length - 20), volumes.length - 1)
  if (!average.length) return null
  const avg = average.reduce((sum, value) => sum + value, 0) / average.length
  if (!avg) return null
  return round(recent / avg, 2)
}

function computeRsi(values: number[], period = 14) {
  if (values.length <= period) return null
  let gains = 0
  let losses = 0
  for (let index = values.length - period; index < values.length; index += 1) {
    const diff = values[index] - values[index - 1]
    if (diff >= 0) gains += diff
    else losses -= diff
  }
  if (losses === 0) return 100
  const rs = gains / losses
  return round(100 - 100 / (1 + rs), 2)
}

function computeAtr(bars: BarRow[], period = 14) {
  if (bars.length <= period) return null
  const ranges: number[] = []
  for (let index = 1; index < bars.length; index += 1) {
    const current = bars[index]
    const previous = bars[index - 1]
    ranges.push(
      Math.max(
        current.high - current.low,
        Math.abs(current.high - previous.close),
        Math.abs(current.low - previous.close)
      )
    )
  }
  if (ranges.length < period) return null
  const subset = ranges.slice(ranges.length - period)
  return round(subset.reduce((sum, value) => sum + value, 0) / subset.length, 4)
}

function computeStdDev(values: number[]) {
  if (values.length < 10) return null
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function getAssetType(symbol: string, quote?: QuoteResult | null) {
  const quoteType = String(quote?.quoteType || quote?.typeDisp || "").toLowerCase()
  if (quoteType.includes("etf") || quoteType.includes("fund")) return "etf"
  if (symbol.endsWith("-USD")) return "crypto"
  if (symbol.endsWith("=X")) return "forex"
  if (CRYPTO_SYMBOLS.includes(symbol)) return "crypto"
  if (FOREX_SYMBOLS.includes(symbol)) return "forex"
  return "equity"
}

function isEtfSymbol(symbol: string, quote?: QuoteResult | null) {
  return getAssetType(symbol, quote) === "etf"
}

function getSeedUniverseSymbols() {
  return uniq([...SP500_SYMBOLS, ...CRYPTO_SYMBOLS, ...FOREX_SYMBOLS])
}

async function ensureInstrumentCatalogSeeded() {
  const catalogRows = await getCanonicalChartCatalogRows()
  const seededSymbols = uniq([
    ...catalogRows.map((row) => row.symbol),
    ...getSeedUniverseSymbols(),
  ])

  if (!seededSymbols.length) return

  await runWithConcurrency(seededSymbols, 24, async (symbol) => {
    await prisma.instrumentMaster.upsert({
      where: { symbol },
      update: {},
      create: {
        symbol,
        name: symbol,
        assetType: getAssetType(symbol),
        isEtf: isEtfSymbol(symbol),
        enabled: true,
      },
    })
  })
}

async function loadBarsForSymbol(symbol: string) {
  const candidates = [
    { vault: "schwab", timeframe: "1d", take: 260 },
    { vault: "yahoo", timeframe: "1d", take: 260 },
    { vault: "schwab", timeframe: "1h", take: 240 },
    { vault: "schwab", timeframe: "1m", take: 390 },
    { vault: "yahoo", timeframe: "1m", take: 390 },
  ] as const

  for (const candidate of candidates) {
    try {
      const client = await vaultManager.getClient(candidate.vault)
      const rows = await withVaultQueryRetry(() =>
        client.marketData.findMany({
          where: {
            symbol,
            timeframe: candidate.timeframe,
          },
          orderBy: { time: "asc" },
          take: candidate.take,
        })
      )

      if (rows.length > 1) {
        return {
          rows: rows.map((row) => ({
            close: row.close,
            high: row.high,
            low: row.low,
            open: row.open,
            volume: row.volume,
            time: row.time,
          })),
          timeframe: candidate.timeframe,
          vault: candidate.vault,
        }
      }
    } catch {
      continue
    }
  }

  return null
}

async function fetchYahooEnrichment(symbol: string) {
  try {
    const quote = (await yahoo.quote(symbol)) as QuoteResult
    let quoteSummary: QuoteSummaryResult | null = null

    if (quote?.quoteType !== "CRYPTOCURRENCY" && quote?.quoteType !== "CURRENCY") {
      try {
        quoteSummary = (await yahoo.quoteSummary(symbol, {
          modules: ["summaryProfile", "summaryDetail", "financialData", "defaultKeyStatistics", "fundProfile"],
        })) as QuoteSummaryResult
      } catch {
        quoteSummary = null
      }
    }

    return { quote, quoteSummary }
  } catch {
    return { quote: null, quoteSummary: null }
  }
}

function buildMetricPayload(symbol: string, bars: BarRow[], quote: QuoteResult | null, quoteSummary: QuoteSummaryResult | null): ScreenerMetricPayload {
  const closes = bars.map((bar) => bar.close)
  const volumes = bars.map((bar) => bar.volume)
  const latest = bars[bars.length - 1]
  const previous = bars[bars.length - 2]
  const performance1d = previous ? ((latest.close - previous.close) / previous.close) * 100 : safeNumber(quote?.regularMarketChangePercent)
  const performance1w = bars.length >= 6 ? ((latest.close - bars[Math.max(0, bars.length - 6)].close) / bars[Math.max(0, bars.length - 6)].close) * 100 : null
  const performance1m = bars.length >= 21 ? ((latest.close - bars[Math.max(0, bars.length - 21)].close) / bars[Math.max(0, bars.length - 21)].close) * 100 : null
  const performance3m = bars.length >= 63 ? ((latest.close - bars[Math.max(0, bars.length - 63)].close) / bars[Math.max(0, bars.length - 63)].close) * 100 : null
  const sma20 = movingAverage(closes, 20)
  const sma50 = movingAverage(closes, 50)
  const sma200 = movingAverage(closes, 200)
  const high52w = closes.length ? Math.max(...closes) : null
  const low52w = closes.length ? Math.min(...closes) : null
  const latestSummary = asRecord(quoteSummary?.summaryProfile) ?? {}
  const latestDetail = asRecord(quoteSummary?.summaryDetail) ?? {}
  const financialData = asRecord(quoteSummary?.financialData) ?? {}
  const keyStats = asRecord(quoteSummary?.defaultKeyStatistics) ?? {}
  const fundProfile = asRecord(quoteSummary?.fundProfile) ?? {}
  const feesExpensesInvestment = asRecord(fundProfile.feesExpensesInvestment) ?? {}
  const gapPercent = previous ? ((latest.open - previous.close) / previous.close) * 100 : null
  const volatilitySeries = closes.slice(-20).map((value, index, array) =>
    index === 0 ? 0 : (value - array[index - 1]) / array[index - 1]
  )
  const volatilityRaw = bars.length >= 20 ? computeStdDev(volatilitySeries) : null
  const volatility = volatilityRaw == null ? null : round(volatilityRaw * 100, 2)
  const currentPrice = safeNumber(quote?.regularMarketPrice) ?? latest?.close ?? null

  return {
    descriptive: {
      exchange: quote?.fullExchangeName || quote?.exchange || null,
      country: latestSummary?.country || null,
      sector: latestSummary?.sector || null,
      industry: latestSummary?.industry || null,
      averageVolume: safeNumber(quote?.averageDailyVolume3Month) ?? safeNumber(quote?.averageDailyVolume10Day),
      currentVolume: safeNumber(quote?.regularMarketVolume) ?? latest?.volume ?? null,
      relativeVolume: relativeVolume(volumes),
      price: currentPrice,
      targetPrice: safeNumber(financialData?.targetMeanPrice) ?? safeNumber(quote?.targetMeanPrice),
      sponsor: fundProfile?.family || null,
    },
    fundamental: {
      trailingPe: safeNumber(quote?.trailingPE) ?? safeNumber(latestDetail?.trailingPE),
      forwardPe: safeNumber(quote?.forwardPE) ?? safeNumber(financialData?.forwardPE),
      peg: safeNumber(quote?.pegRatio) ?? safeNumber(keyStats?.pegRatio),
      priceToSales: safeNumber(quote?.priceToSalesTrailing12Months) ?? safeNumber(keyStats?.priceToSalesTrailing12Months),
      priceToBook: safeNumber(quote?.priceToBook) ?? safeNumber(keyStats?.priceToBook),
      dividendYield: toPercent(safeNumber(quote?.dividendYield) ?? safeNumber(latestDetail?.dividendYield)),
      epsGrowthThisYear: toPercent(safeNumber(financialData?.earningsGrowth)),
      salesGrowth: toPercent(safeNumber(financialData?.revenueGrowth)),
      returnOnAssets: toPercent(safeNumber(financialData?.returnOnAssets)),
      returnOnEquity: toPercent(safeNumber(financialData?.returnOnEquity)),
      debtToEquity: safeNumber(financialData?.debtToEquity),
      grossMargin: toPercent(safeNumber(financialData?.grossMargins)),
      operatingMargin: toPercent(safeNumber(financialData?.operatingMargins)),
      netProfitMargin: toPercent(safeNumber(financialData?.profitMargins)),
      currentRatio: safeNumber(financialData?.currentRatio),
      quickRatio: safeNumber(financialData?.quickRatio),
      analystRecommendation: quote?.recommendationKey ?? financialData?.recommendationKey ?? null,
      targetPriceUpside: currentPrice && safeNumber(financialData?.targetMeanPrice)
        ? round(((safeNumber(financialData?.targetMeanPrice) as number) - currentPrice) / currentPrice * 100, 2)
        : null,
      institutionalOwnership: toPercent(safeNumber(keyStats?.heldPercentInstitutions)),
      insiderOwnership: toPercent(safeNumber(keyStats?.heldPercentInsiders)),
      insiderTransactions: keyStats?.lastFiscalYearEnd || null,
    },
    technical: {
      performance1d: round(performance1d, 2),
      performance1w: round(performance1w, 2),
      performance1m: round(performance1m, 2),
      performance3m: round(performance3m, 2),
      sma20,
      sma50,
      sma200,
      sma20Signal: sma20 == null || currentPrice == null ? null : currentPrice >= sma20 ? "above" : "below",
      sma50Signal: sma50 == null || currentPrice == null ? null : currentPrice >= sma50 ? "above" : "below",
      sma200Signal: sma200 == null || currentPrice == null ? null : currentPrice >= sma200 ? "above" : "below",
      high52w,
      low52w,
      high52wSignal: currentPrice == null || high52w == null || low52w == null
        ? null
        : currentPrice >= high52w * 0.98
          ? currentPrice >= high52w ? "breakout" : "near_high"
          : currentPrice <= low52w * 1.02
            ? "near_low"
            : null,
      rsi14: computeRsi(closes, 14),
      atr14: computeAtr(bars, 14),
      averageVolume: relativeVolume(volumes) == null ? null : round(volumes.slice(Math.max(0, volumes.length - 20)).reduce((sum, value) => sum + value, 0) / Math.min(volumes.length, 20), 2),
      relativeVolume: relativeVolume(volumes),
      volatility,
      beta: safeNumber(quote?.beta) ?? safeNumber(keyStats?.beta),
      gapPercent: round(gapPercent, 2),
      gapDirection: gapPercent == null ? null : gapPercent >= 0 ? "gap_up" : "gap_down",
      pattern: null,
      currentVolume: safeNumber(quote?.regularMarketVolume) ?? latest?.volume ?? null,
    },
    news: {
      latestHeadline: null,
      latestPublisher: null,
      latestCategory: null,
      latestAt: null,
      latestNews: null,
      keywords: [],
    },
    etf: {
      sponsor: asString(fundProfile.family) ?? asString(quote?.fundFamily),
      expenseRatio: toPercent(
        safeNumber(latestDetail.annualHoldingsTurnover) ??
        safeNumber(feesExpensesInvestment.annualReportExpenseRatio)
      ),
      annualizedReturn: null,
      netFlows: null,
      category: asString(fundProfile.categoryName),
      region: asString(fundProfile.categoryName),
      tags: [],
    },
  }
}

async function syncInstrumentSnapshot(symbol: string) {
  const barsContext = await loadBarsForSymbol(symbol)
  const enrichment = await fetchYahooEnrichment(symbol)
  const quote = enrichment.quote
  const quoteSummary = enrichment.quoteSummary
  const assetType = getAssetType(symbol, quote)
  const metricPayload = buildMetricPayload(symbol, barsContext?.rows ?? [], quote, quoteSummary)
  const latestPrice = safeNumber(quote?.regularMarketPrice) ?? barsContext?.rows.at(-1)?.close ?? null
  const changePercent = safeNumber(quote?.regularMarketChangePercent) ?? safeNumber(metricPayload.technical.performance1d)
  const latestVolume = safeNumber(quote?.regularMarketVolume) ?? barsContext?.rows.at(-1)?.volume ?? null
  const marketCap = safeNumber(quote?.marketCap) ?? safeNumber(quoteSummary?.price?.marketCap)
  const summaryProfile = asRecord(quoteSummary?.summaryProfile) ?? {}
  const fundProfile = asRecord(quoteSummary?.fundProfile) ?? {}
  const exchange = asString(quote?.fullExchangeName) ?? asString(quote?.exchange) ?? barsContext?.vault?.toUpperCase() ?? null
  const sector = asString(summaryProfile.sector)
  const industry = asString(summaryProfile.industry)
  const country = asString(summaryProfile.country)
  const sponsor = asString(fundProfile.family) ?? asString(quote?.fundFamily)
  const name = asString(quote?.shortName) ?? asString(quote?.longName) ?? symbol

  const instrument = await prisma.instrumentMaster.upsert({
    where: { symbol },
    update: {
      name,
      assetType,
      exchange,
      country,
      sector,
      industry,
      isEtf: isEtfSymbol(symbol, quote),
      sponsor,
      enabled: true,
    },
    create: {
      symbol,
      name,
      assetType,
      exchange,
      country,
      sector,
      industry,
      isEtf: isEtfSymbol(symbol, quote),
      sponsor,
      enabled: true,
    },
  })

  await prisma.instrumentProfileSnapshot.upsert({
    where: { instrumentId: instrument.id },
    update: {
      source: quote ? "yahoo" : "local-vault",
      asOf: new Date(),
      descriptiveJson: JSON.stringify(metricPayload.descriptive),
      companyJson: JSON.stringify({
        longName: asString(quote?.longName) ?? asString(quote?.shortName) ?? symbol,
        quoteType: asString(quote?.quoteType),
      }),
      newsJson: JSON.stringify(metricPayload.news),
      etfJson: JSON.stringify(metricPayload.etf),
      freshnessNote: quote ? "yahoo quote + local vault" : "local vault only",
    },
    create: {
      instrumentId: instrument.id,
      source: quote ? "yahoo" : "local-vault",
      asOf: new Date(),
      descriptiveJson: JSON.stringify(metricPayload.descriptive),
      companyJson: JSON.stringify({
        longName: asString(quote?.longName) ?? asString(quote?.shortName) ?? symbol,
        quoteType: asString(quote?.quoteType),
      }),
      newsJson: JSON.stringify(metricPayload.news),
      etfJson: JSON.stringify(metricPayload.etf),
      freshnessNote: quote ? "yahoo quote + local vault" : "local vault only",
    },
  })

  await prisma.instrumentMetricSnapshot.upsert({
    where: { instrumentId: instrument.id },
    update: {
      source: quote ? "yahoo+vault" : "vault",
      asOf: new Date(),
      price: latestPrice,
      changePercent,
      volume: latestVolume,
      marketCap,
      sector,
      industry,
      country,
      exchange,
      assetType,
      descriptiveJson: JSON.stringify(metricPayload.descriptive),
      fundamentalJson: JSON.stringify(metricPayload.fundamental),
      technicalJson: JSON.stringify(metricPayload.technical),
      newsJson: JSON.stringify(metricPayload.news),
      etfJson: JSON.stringify(metricPayload.etf),
    },
    create: {
      instrumentId: instrument.id,
      source: quote ? "yahoo+vault" : "vault",
      asOf: new Date(),
      price: latestPrice,
      changePercent,
      volume: latestVolume,
      marketCap,
      sector,
      industry,
      country,
      exchange,
      assetType,
      descriptiveJson: JSON.stringify(metricPayload.descriptive),
      fundamentalJson: JSON.stringify(metricPayload.fundamental),
      technicalJson: JSON.stringify(metricPayload.technical),
      newsJson: JSON.stringify(metricPayload.news),
      etfJson: JSON.stringify(metricPayload.etf),
    },
  })
}

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let index = 0
  const runners = Array.from({ length: Math.max(1, limit) }, async () => {
    while (index < items.length) {
      const current = items[index]
      index += 1
      await worker(current)
    }
  })
  await Promise.all(runners)
}

export async function warmInstrumentSnapshots(input?: { symbols?: string[]; maxSymbols?: number; force?: boolean }) {
  await ensureInstrumentCatalogSeeded()

  const now = Date.now()
  let candidates: Array<{ symbol: string; updatedAt: Date | null }> = []

  if (input?.symbols?.length) {
    const rows = await prisma.instrumentMaster.findMany({
      where: { symbol: { in: uniq(input.symbols) } },
      select: {
        symbol: true,
        metricSnapshot: {
          select: { asOf: true },
        },
      },
    })
    candidates = rows.map((row) => ({ symbol: row.symbol, updatedAt: row.metricSnapshot?.asOf ?? null }))
  } else {
    const rows = await prisma.instrumentMaster.findMany({
      orderBy: [{ updatedAt: "asc" }, { symbol: "asc" }],
      take: input?.maxSymbols ?? 120,
      select: {
        symbol: true,
        metricSnapshot: {
          select: { asOf: true },
        },
      },
    })
    candidates = rows.map((row) => ({ symbol: row.symbol, updatedAt: row.metricSnapshot?.asOf ?? null }))
  }

  const staleSymbols = candidates
    .filter((candidate) => input?.force || !candidate.updatedAt || now - candidate.updatedAt.getTime() > SNAPSHOT_STALE_MS)
    .map((candidate) => candidate.symbol)

  if (!staleSymbols.length) return

  await runWithConcurrency(staleSymbols, QUOTE_CONCURRENCY, async (symbol) => {
    try {
      await syncInstrumentSnapshot(symbol)
    } catch (error) {
      console.warn(`[Screener] Failed to sync ${symbol}:`, error)
    }
  })
}

function parseJsonObject(value: string | null) {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function recordToRow(record: InstrumentSnapshotRecord): ScreenerRow {
  return {
    symbol: record.symbol,
    name: record.name || record.symbol,
    assetType: record.assetType,
    exchange: record.metricSnapshot?.exchange || record.exchange,
    sector: record.metricSnapshot?.sector || record.sector,
    industry: record.metricSnapshot?.industry || record.industry,
    country: record.metricSnapshot?.country || record.country,
    isEtf: record.isEtf,
    sponsor: record.sponsor,
    price: record.metricSnapshot?.price ?? null,
    changePercent: record.metricSnapshot?.changePercent ?? null,
    volume: record.metricSnapshot?.volume ?? null,
    marketCap: record.metricSnapshot?.marketCap ?? null,
    updatedAt: record.metricSnapshot?.asOf?.toISOString() ?? null,
    descriptive: parseJsonObject(record.metricSnapshot?.descriptiveJson ?? null),
    fundamental: parseJsonObject(record.metricSnapshot?.fundamentalJson ?? null),
    technical: parseJsonObject(record.metricSnapshot?.technicalJson ?? null),
    news: parseJsonObject(record.metricSnapshot?.newsJson ?? null),
    etf: parseJsonObject(record.metricSnapshot?.etfJson ?? null),
  }
}

function getNestedValue(target: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((accumulator, segment) => {
    if (accumulator == null || typeof accumulator !== "object") {
      return null
    }

    return (accumulator as Record<string, unknown>)[segment]
  }, target)
}

function matchNumericBucket(value: number | null, bucket: string) {
  if (value == null) return false

  if (bucket === "micro") return value < 300_000_000
  if (bucket === "small") return value >= 300_000_000 && value < 2_000_000_000
  if (bucket === "mid") return value >= 2_000_000_000 && value < 10_000_000_000
  if (bucket === "large") return value >= 10_000_000_000 && value < 200_000_000_000
  if (bucket === "mega") return value >= 200_000_000_000

  if (bucket === "under_0_25") return value < 0.25
  if (bucket === "under_0_5") return value < 0.5
  if (bucket === "under_1") return value < 1
  if (bucket === "under_2") return value < 2
  if (bucket === "under_10") return value < 10
  if (bucket === "under_30") return value < 30

  if (bucket === "1_3") return value >= 1 && value <= 3
  if (bucket === "2_5") return value >= 2 && value <= 5
  if (bucket === "3_10") return value > 3 && value <= 10
  if (bucket === "10_20") return value >= 10 && value <= 20
  if (bucket === "10_50") return value >= 10 && value <= 50
  if (bucket === "20_40") return value > 20 && value <= 40
  if (bucket === "30_50") return value >= 30 && value < 50
  if (bucket === "50_70") return value >= 50 && value < 70
  if (bucket === "50_100") return value >= 50 && value <= 100

  if (bucket === "positive" || bucket === "up") return value > 0
  if (bucket === "down") return value < 0
  if (bucket === "under_-5") return value < -5
  if (bucket === "under_-10") return value < -10

  if (bucket === "over_1") return value > 1
  if (bucket === "over_1_5") return value > 1.5
  if (bucket === "over_2") return value > 2
  if (bucket === "over_3") return value > 3
  if (bucket === "over_4") return value > 4
  if (bucket === "over_5") return value > 5
  if (bucket === "over_6") return value > 6
  if (bucket === "over_10") return value > 10
  if (bucket === "over_15") return value > 15
  if (bucket === "over_20") return value > 20
  if (bucket === "over_30") return value > 30
  if (bucket === "over_40") return value > 40
  if (bucket === "over_70") return value >= 70
  if (bucket === "over_100") return value > 100

  if (bucket === "over_100k") return value > 100_000
  if (bucket === "over_500k") return value > 500_000
  if (bucket === "over_1m") return value > 1_000_000
  if (bucket === "over_5m") return value > 5_000_000

  return false
}

function resolveOrderKeyPath(orderKey: string) {
  const aliases: Record<string, string> = {
    rsi14: "technical.rsi14",
    performance1m: "technical.performance1m",
    dividendYield: "fundamental.dividendYield",
    trailingPe: "fundamental.trailingPe",
    forwardPe: "fundamental.forwardPe",
    priceToBook: "fundamental.priceToBook",
    priceToSales: "fundamental.priceToSales",
    peg: "fundamental.peg",
    relativeVolume: "technical.relativeVolume",
    volatility: "technical.volatility",
    expenseRatio: "etf.expenseRatio",
    annualizedReturn: "etf.annualizedReturn",
  }

  return aliases[orderKey] || orderKey
}

function matchesSignal(row: ScreenerRow, signal: string) {
  const technical = row.technical as Record<string, unknown>
  switch (signal) {
    case "oversold_rsi":
      return safeNumber(technical.rsi14) != null && Number(technical.rsi14) < 30
    case "above_20d_sma":
      return row.price != null && safeNumber(technical.sma20) != null && row.price > Number(technical.sma20)
    case "above_50d_sma":
      return row.price != null && safeNumber(technical.sma50) != null && row.price > Number(technical.sma50)
    case "breakout_52w":
      return technical.high52wSignal === "breakout"
    case "high_relative_volume":
      return safeNumber(technical.relativeVolume) != null && Number(technical.relativeVolume) >= 1.5
    default:
      return true
  }
}

function matchesFilter(row: ScreenerRow, filter: ScreenerFilterClause) {
  if (!filter.value || filter.value === "any") return true

  const descriptive = row.descriptive as Record<string, unknown>
  const fundamental = row.fundamental as Record<string, unknown>
  const technical = row.technical as Record<string, unknown>
  const news = row.news as Record<string, unknown>
  const etf = row.etf as Record<string, unknown>

  switch (filter.field) {
    case "index":
      return matchesIndex(row, filter.value)
    case "exchange":
    case "country":
    case "sector":
    case "industry":
    case "assetType":
    case "sponsor": {
      const current = String(
        ({
          exchange: row.exchange,
          country: row.country,
          sector: row.sector,
          industry: row.industry,
          assetType: row.assetType,
          sponsor: row.sponsor || etf.sponsor || descriptive.sponsor,
        } as Record<string, unknown>)[filter.field] || ""
      )
        .toLowerCase()
        .replace(/\s+/g, "_")
      return current.includes(filter.value.toLowerCase())
    }
    case "marketCap":
      return matchNumericBucket(row.marketCap, filter.value)
    case "price":
      return matchNumericBucket(row.price, filter.value)
    case "averageVolume":
      return matchNumericBucket(safeNumber(technical.averageVolume) ?? safeNumber(descriptive.averageVolume), filter.value)
    case "relativeVolume":
      return matchNumericBucket(safeNumber(technical.relativeVolume) ?? safeNumber(descriptive.relativeVolume), filter.value)
    case "currentVolume":
      return matchNumericBucket(row.volume, filter.value)
    case "trailingPe":
      return matchNumericBucket(safeNumber(fundamental.trailingPe), filter.value)
    case "forwardPe":
      return matchNumericBucket(safeNumber(fundamental.forwardPe), filter.value)
    case "priceToBook":
      return matchNumericBucket(safeNumber(fundamental.priceToBook), filter.value)
    case "dividendYield":
      return matchNumericBucket(safeNumber(fundamental.dividendYield), filter.value)
    case "returnOnEquity":
      return matchNumericBucket(safeNumber(fundamental.returnOnEquity), filter.value)
    case "debtToEquity":
      return matchNumericBucket(safeNumber(fundamental.debtToEquity), filter.value)
    case "targetPriceUpside":
      return matchNumericBucket(safeNumber(fundamental.targetPriceUpside), filter.value)
    case "performance1d":
      return matchNumericBucket(safeNumber(technical.performance1d), filter.value)
    case "performance1m":
      return matchNumericBucket(safeNumber(technical.performance1m), filter.value)
    case "rsi14":
      return matchNumericBucket(safeNumber(technical.rsi14), filter.value)
    case "sma20Signal":
    case "sma50Signal":
    case "sma200Signal":
    case "high52wSignal":
      return String(technical[filter.field] || "") === filter.value
    case "volatility":
      return matchNumericBucket(safeNumber(technical.volatility), filter.value)
    case "gap":
      if (filter.value === "gap_up") return technical.gapDirection === "gap_up"
      if (filter.value === "gap_down") return technical.gapDirection === "gap_down"
      if (filter.value === "gap_gt_2") return Math.abs(safeNumber(technical.gapPercent) ?? 0) > 2
      return true
    case "latestNews":
      return filter.value === "none" ? !news.latestHeadline : Boolean(news.latestHeadline)
    case "newsKeywords": {
      const term = filter.value.toLowerCase()
      const haystack = [news.latestHeadline, news.latestPublisher, ...(Array.isArray(news.keywords) ? news.keywords : [])].join(" ").toLowerCase()
      return haystack.includes(term)
    }
    case "expenseRatio":
      return matchNumericBucket(safeNumber(etf.expenseRatio), filter.value)
    case "annualizedReturn":
      return matchNumericBucket(safeNumber(etf.annualizedReturn), filter.value)
    default:
      return true
  }
}

function compareValues(left: unknown, right: unknown, direction: "asc" | "desc") {
  const order = direction === "asc" ? 1 : -1
  if (left == null && right == null) return 0
  if (left == null) return 1
  if (right == null) return -1
  if (typeof left === "number" && typeof right === "number") {
    return (left - right) * order
  }
  return String(left).localeCompare(String(right)) * order
}

function hashRequest(request: ScreenerQueryRequest) {
  return crypto.createHash("sha1").update(JSON.stringify(request)).digest("hex")
}

function buildRows(records: InstrumentSnapshotRecord[]) {
  return records.map(recordToRow)
}

function resolveResultScope(groupTab: ScreenerQueryRequest["groupTab"]) {
  if (groupTab === "all") return undefined
  return groupTab
}

function matchesIndex(row: ScreenerRow, indexName: string) {
  switch (indexName) {
    case "dow30":
      return DOW30_SYMBOLS.includes(row.symbol)
    case "sp500":
      return SP500_SYMBOLS.includes(row.symbol)
    default:
      return true
  }
}

export async function getScreenerConfig(userId: string) {
  await ensureInstrumentCatalogSeeded()
  fireAndForget(warmInstrumentSnapshots({ maxSymbols: CONFIG_WARM_LIMIT }))

  const userPresets = await prisma.screenerPreset.findMany({
    where: { userId },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  })

  const masters = await prisma.instrumentMaster.findMany({
    take: 200,
    select: {
      exchange: true,
      country: true,
      sector: true,
      industry: true,
      sponsor: true,
    },
  })

  const dynamicValues = {
    exchange: uniq(masters.map((master) => master.exchange || "")).slice(0, 12),
    country: uniq(masters.map((master) => master.country || "")).slice(0, 12),
    sector: uniq(masters.map((master) => master.sector || "")).slice(0, 20),
    industry: uniq(masters.map((master) => master.industry || "")).slice(0, 20),
    sponsor: uniq(masters.map((master) => master.sponsor || "")).slice(0, 20),
  }

  const fields: ScreenerFieldDefinition[] = SCREENER_FIELDS.map((field) => {
    if (!["exchange", "country", "sector", "industry", "sponsor"].includes(field.key)) {
      return field
    }
    const values = dynamicValues[field.key as keyof typeof dynamicValues]
    if (!values.length) return field
    return {
      ...field,
      options: [{ value: "any", label: "Any" }, ...values.map((value) => ({
        value: value.toLowerCase().replace(/\s+/g, "_"),
        label: value,
      }))],
    }
  })

  return {
    groupTabs: SCREENER_GROUP_TABS,
    resultTabs: SCREENER_RESULT_TABS,
    fields,
    builtInPresets: BUILT_IN_SCREENER_PRESETS,
    userPresets: userPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      groupTab: preset.groupTab,
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection,
      signal: preset.signal,
      filters: JSON.parse(preset.filtersJson || "[]"),
    })),
    orderOptions: SCREENER_ORDER_OPTIONS,
    signals: SCREENER_SIGNALS,
  }
}

export async function queryScreener(userId: string, request: ScreenerQueryRequest): Promise<ScreenerQueryResponse> {
  await ensureInstrumentCatalogSeeded()

  const queryHash = hashRequest(request)
  const cached = await prisma.screenerRunCache.findUnique({ where: { queryHash } })
  if (cached && cached.expiresAt.getTime() > Date.now()) {
    return JSON.parse(cached.responseJson) as ScreenerQueryResponse
  }

  const preloadSize =
    request.filters.length > 0 ||
    request.signal !== "none" ||
    request.tickerQuery ||
    !["symbol", "name"].includes(request.orderKey)
      ? QUERY_WARM_LIMIT
      : SEARCH_WARM_LIMIT
  await warmInstrumentSnapshots({ maxSymbols: preloadSize })

  const records = await prisma.instrumentMaster.findMany({
    where: {
      enabled: true,
    },
    include: {
      metricSnapshot: true,
    },
    orderBy: { symbol: "asc" },
  }) as InstrumentSnapshotRecord[]

  let rows = buildRows(records)

  if (request.tickerQuery?.trim()) {
    const query = request.tickerQuery.trim().toLowerCase()
    rows = rows.filter((row) =>
      row.symbol.toLowerCase().includes(query) ||
      row.name.toLowerCase().includes(query)
    )
  }

  const scope = resolveResultScope(request.groupTab)
  if (scope && scope !== "news") {
    rows = rows.filter((row) => {
      if (scope === "etf") return row.assetType === "etf" || row.isEtf
      if (scope === "fundamental" || scope === "technical" || scope === "descriptive") {
        return row.assetType === "equity" || row.assetType === "etf"
      }
      return true
    })
  }

  rows = rows.filter((row) => matchesSignal(row, request.signal))
  rows = rows.filter((row) => request.filters.every((filter) => matchesFilter(row, filter)))

  const orderKeyPath = resolveOrderKeyPath(request.orderKey)
  rows.sort((left, right) => {
    const leftValue = getNestedValue(left as unknown as Record<string, unknown>, orderKeyPath)
    const rightValue = getNestedValue(right as unknown as Record<string, unknown>, orderKeyPath)
    return compareValues(leftValue, rightValue, request.orderDirection)
  })

  const page = Math.max(1, request.page || 1)
  const pageSize = Math.max(10, Math.min(100, request.pageSize || DEFAULT_QUERY_PAGE_SIZE))
  const pagedRows = rows.slice((page - 1) * pageSize, page * pageSize)

  await warmInstrumentSnapshots({ symbols: pagedRows.map((row) => row.symbol), maxSymbols: pagedRows.length })

  const finalRecords = await prisma.instrumentMaster.findMany({
    where: { symbol: { in: pagedRows.map((row) => row.symbol) } },
    include: { metricSnapshot: true },
  }) as InstrumentSnapshotRecord[]
  const bySymbol = new Map(finalRecords.map((record) => [record.symbol, recordToRow(record)]))
  const refreshedRows = pagedRows.map((row) => bySymbol.get(row.symbol) || row)

  const freshnessDates = refreshedRows
    .map((row) => row.updatedAt)
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.localeCompare(left))

  const response: ScreenerQueryResponse = {
    rows: refreshedRows,
    totalCount: rows.length,
    page,
    pageSize,
    freshness: {
      asOf: freshnessDates[0] ?? null,
      source: "instrument-snapshots",
      universeSize: records.length,
    },
  }

  await prisma.screenerRunCache.upsert({
    where: { queryHash },
    update: {
      userId,
      requestJson: JSON.stringify(request),
      responseJson: JSON.stringify(response),
      expiresAt: new Date(Date.now() + SCREENER_CACHE_TTL_MS),
    },
    create: {
      userId,
      queryHash,
      requestJson: JSON.stringify(request),
      responseJson: JSON.stringify(response),
      expiresAt: new Date(Date.now() + SCREENER_CACHE_TTL_MS),
    },
  })

  return response
}

export async function upsertScreenerPreset(userId: string, preset: ScreenerPresetDocument) {
  const filtersJson = JSON.stringify(preset.filters || [])
  if (preset.id) {
    const updated = await prisma.screenerPreset.updateMany({
      where: { id: preset.id, userId },
      data: {
        name: preset.name,
        groupTab: preset.groupTab,
        resultTab: preset.resultTab,
        orderKey: preset.orderKey,
        orderDirection: preset.orderDirection,
        signal: preset.signal,
        filtersJson,
      },
    })

    if (!updated.count) {
      throw new Error("Preset not found")
    }

    return prisma.screenerPreset.findUniqueOrThrow({
      where: { id: preset.id },
    })
  }

  return prisma.screenerPreset.upsert({
    where: {
      userId_name: {
        userId,
        name: preset.name,
      },
    },
    update: {
      groupTab: preset.groupTab,
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection,
      signal: preset.signal,
      filtersJson,
    },
    create: {
      userId,
      name: preset.name,
      groupTab: preset.groupTab,
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection,
      signal: preset.signal,
      filtersJson,
    },
  })
}

export async function deleteScreenerPreset(userId: string, presetId: string) {
  await prisma.screenerPreset.deleteMany({
    where: { id: presetId, userId },
  })
}

function scoreTickerMatch(query: string, symbol: string, name: string | null) {
  const q = query.toLowerCase()
  const s = symbol.toLowerCase()
  const n = (name || "").toLowerCase()
  if (s === q) return 120
  if (s.startsWith(q)) return 100
  if (n === q) return 90
  if (n.startsWith(q)) return 80
  if (n.includes(q)) return 60
  if (s.includes(q)) return 50
  return 0
}

async function loadPortfolioMatches(userId: string, query: string): Promise<GlobalSearchResult[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  try {
    const preferences = await prisma.userPreference.findUnique({
      where: { userId },
      select: { selectedAccountId: true },
    })

    const resolved = await requireUserSchwabBrokerageConnection(userId).catch(() => null)
    if (!resolved) return []

    const { connection, config } = resolved
    if (!config.clientId || !config.clientSecret || !config.accessToken || !config.refreshToken) {
      return []
    }

    const client = getSchwabClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      callbackUrl: getSchwabCallbackUrl(),
    })
    client.setAccessToken(config.accessToken, config.refreshToken)

    let accountId = resolveBrokerageAccountSelection(connection, preferences?.selectedAccountId)
    if (!accountId) {
      const accounts = await withTimeout(client.getAccounts(), 3000)
      const firstAccount = (accounts.data || [])[0]
      accountId =
        firstAccount?.securitiesAccount?.hashValue ||
        firstAccount?.hashValue ||
        null
    }

    if (!accountId) return []

    const positions = await withTimeout(client.getPositions(accountId), 3500)

    return positions
      .map((position) => ({
        symbol: position.symbol,
        score: scoreTickerMatch(q, position.symbol, position.symbol) + 15,
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 8)
      .map((item) => ({
        id: `portfolio:${item.symbol}`,
        group: "portfolio" as const,
        title: item.symbol,
        subtitle: "Portfolio holding",
        href: getWorkspaceChartHref(item.symbol),
        symbol: item.symbol,
        score: item.score,
        badge: "Portfolio",
      }))
  } catch {
    return []
  }
}

export async function globalSearch(userId: string, query: string): Promise<GlobalSearchGroup[]> {
  const q = query.trim()
  if (!q) return []

  await ensureInstrumentCatalogSeeded()
  fireAndForget(warmInstrumentSnapshots({ maxSymbols: SEARCH_WARM_LIMIT }))

  const [instrumentRows, presetRows, strategyRows, preferences, docs, portfolioResults] = await Promise.all([
    prisma.instrumentMaster.findMany({
      where: {
        enabled: true,
        OR: [
          { symbol: { contains: q.toUpperCase() } },
          { name: { contains: q } },
        ],
      },
      take: 20,
      orderBy: { symbol: "asc" },
    }),
    prisma.screenerPreset.findMany({
      where: {
        userId,
        name: { contains: q },
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.strategy.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: q } },
          { description: { contains: q } },
          { asset: { contains: q.toUpperCase() } },
        ],
      },
      take: 10,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.userPreference.findUnique({ where: { userId } }),
    getVisibleDocs(true),
    loadPortfolioMatches(userId, q),
  ])

  const watchlistSymbols = parseStoredStringArray(preferences?.watchlistSymbols)
  const watchlistMatches = watchlistSymbols.filter((symbol) => symbol.toLowerCase().includes(q.toLowerCase()))

  const docMatches = docs
    .map((doc) => ({
      doc,
      score: scoreTickerMatch(q, doc.slug, doc.title),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)

  const groups: GlobalSearchGroup[] = []

  const instrumentResults: GlobalSearchResult[] = instrumentRows
    .map((row) => ({
      id: `instrument:${row.id}`,
      group: "instruments" as const,
      title: row.symbol,
      subtitle: row.name || capitalize(row.assetType),
      href: getWorkspaceChartHref(row.symbol),
      symbol: row.symbol,
      score: scoreTickerMatch(q, row.symbol, row.name),
      badge: capitalize(row.assetType),
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)

  if (instrumentResults.length) {
    groups.push({ key: "instruments", label: "Instruments", results: instrumentResults })
  }

  const presetResults: GlobalSearchResult[] = [
    ...BUILT_IN_SCREENER_PRESETS,
    ...presetRows.map((preset) => ({
      id: preset.id,
      name: preset.name,
      groupTab: preset.groupTab as ScreenerPresetDocument["groupTab"],
      resultTab: preset.resultTab,
      orderKey: preset.orderKey,
      orderDirection: preset.orderDirection as ScreenerPresetDocument["orderDirection"],
      signal: preset.signal,
      filters: JSON.parse(preset.filtersJson || "[]"),
    })),
  ]
    .map((preset) => ({
      id: `preset:${preset.id ?? preset.name}`,
      group: "presets" as const,
      title: preset.name,
      subtitle: `${capitalize(preset.groupTab)} preset`,
      href: `/screener?preset=${encodeURIComponent(preset.id ?? preset.name)}`,
      score: scoreTickerMatch(q, preset.name, preset.name),
      badge: preset.id ? "Saved" : "Built-in",
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)

  if (presetResults.length) {
    groups.push({ key: "presets", label: "Screener Presets", results: presetResults })
  }

  const strategyResults: GlobalSearchResult[] = strategyRows
    .map((strategy) => ({
      id: `strategy:${strategy.id}`,
      group: "strategies" as const,
      title: strategy.name,
      subtitle: `${strategy.asset} • ${strategy.timeframe}`,
      href: `/backtest?strategy=${encodeURIComponent(strategy.id)}`,
      symbol: strategy.asset,
      score: Math.max(scoreTickerMatch(q, strategy.asset, strategy.name), strategy.name.toLowerCase().includes(q.toLowerCase()) ? 70 : 0),
      badge: "Strategy",
    }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 8)

  if (strategyResults.length) {
    groups.push({ key: "strategies", label: "Saved Strategies", results: strategyResults })
  }

  const watchlistResults: GlobalSearchResult[] = watchlistMatches
    .map((symbol) => ({
      id: `watchlist:${symbol}`,
      group: "watchlist" as const,
      title: symbol,
      subtitle: "Watchlist symbol",
      href: getWorkspaceChartHref(symbol),
      symbol,
      score: scoreTickerMatch(q, symbol, symbol) + 10,
      badge: "Watchlist",
    }))
    .slice(0, 8)

  if (watchlistResults.length) {
    groups.push({ key: "watchlist", label: "Watchlist Symbols", results: watchlistResults })
  }

  if (portfolioResults.length) {
    groups.push({ key: "portfolio", label: "Portfolio Symbols", results: portfolioResults })
  }

  if (docMatches.length) {
    groups.push({
      key: "documentation",
      label: "Documentation",
      results: docMatches.map(({ doc, score }) => ({
        id: `doc:${doc.slug}`,
        group: "documentation",
        title: doc.title,
        subtitle: doc.category,
        href: getDocHref(doc.slug),
        score,
        badge: doc.status,
      })),
    })
  }

  return groups
}
