import { DataHealthManager } from "./health"
import { marketDataStore } from "./store"
import type { Timeframe } from "./types"
import { getRuntimeSchwabClient } from "@/app/services/schwab/runtime"

export interface IngestionJobExecutionInput {
  symbol: string
  requestedTimeframe: string
  storageTimeframe: string
  provider: string
  pauseMs?: number
}

export interface IngestionJobExecutionResult {
  summary: {
    processed: number
    persistedBars: number
    symbols: string[]
    timeframes: Timeframe[]
  }
  providerUsed: string
  vaultName: string
  provenanceStatus: "native-cached" | "derived"
  healthSnapshot: Awaited<ReturnType<typeof DataHealthManager.getHealth>>
}

async function resolveProvider(inputProvider: string) {
  if (inputProvider !== "schwab") {
    return inputProvider
  }

  const runtimeClient = await getRuntimeSchwabClient()
  return runtimeClient ? "schwab" : "yahoo"
}

function resolveExecutionWindowSeconds(timeframe: Timeframe) {
  switch (timeframe) {
    case "1m":
      return 7 * 24 * 60 * 60
    case "1h":
      return 365 * 24 * 60 * 60
    case "1w":
      return 10 * 365 * 24 * 60 * 60
    case "1d":
      return 5 * 365 * 24 * 60 * 60
    default:
      return 7 * 24 * 60 * 60
  }
}

export async function executeIngestionJob(
  input: IngestionJobExecutionInput
): Promise<IngestionJobExecutionResult> {
  const providerUsed = await resolveProvider(input.provider)
  const storageTimeframe = input.storageTimeframe as Timeframe
  const rangeEnd = Math.floor(Date.now() / 1000)
  const rangeStart = Math.max(0, rangeEnd - resolveExecutionWindowSeconds(storageTimeframe))

  const fetchResult = await marketDataStore.getHistoricalDataWithReport(
    input.symbol,
    storageTimeframe,
    rangeStart,
    rangeEnd,
    {
      providerOverride: providerUsed,
      forceRefresh: true,
      vaultName: providerUsed === "yahoo" ? "yahoo" : "schwab",
    }
  )

  if (fetchResult.report.dbTotalAfterFetch === 0) {
    throw new Error(`NO_BARS_RETURNED: ${providerUsed} returned no cached bars for ${input.symbol} ${storageTimeframe}.`)
  }

  const summary = {
    processed: 1,
    persistedBars: fetchResult.report.persistedBars,
    symbols: [input.symbol],
    timeframes: [storageTimeframe],
  }

  await DataHealthManager.refreshInventorySelection(input.symbol, storageTimeframe, providerUsed === "yahoo" ? "yahoo" : "schwab")
  const healthSnapshot = await DataHealthManager.getHealth(
    input.symbol,
    storageTimeframe,
    providerUsed === "yahoo" ? "yahoo" : "schwab"
  )

  return {
    summary,
    providerUsed,
    vaultName: providerUsed === "yahoo" ? "yahoo" : "schwab",
    provenanceStatus:
      input.requestedTimeframe === input.storageTimeframe ? "native-cached" : "derived",
    healthSnapshot,
  }
}
