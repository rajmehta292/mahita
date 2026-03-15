#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { SchwabProvider, buildSchwabHistoryParams } from "../app/services/market-data/providers/schwab"
import { YahooProvider } from "../app/services/market-data/providers/yahoo"
import { getRuntimeSchwabClientWithOptions } from "../app/services/schwab/runtime"
import type { Timeframe } from "../app/services/market-data/types"

type ValidationCase = {
  symbol: string
  timeframe: Timeframe
  provider: "schwab" | "yahoo"
  lookbackSeconds: number
}

type ValidationResult = {
  symbol: string
  timeframe: Timeframe
  provider: "schwab" | "yahoo"
  startTime: number
  endTime: number
  ok: boolean
  bars: number
  error: string | null
  requestPlan: Record<string, unknown> | null
}

function parseArgs(argv: string[]) {
  const args = {
    output: path.join(process.cwd(), "artifacts", "platform-data-validation", "provider-matrix.json"),
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

function createCases(): ValidationCase[] {
  return [
    { symbol: "CRM", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "MSFT", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "UNH", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "V", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "WMT", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "XOM", timeframe: "1m", provider: "schwab", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "CRM", timeframe: "1m", provider: "yahoo", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1m", provider: "yahoo", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "MSFT", timeframe: "1m", provider: "yahoo", lookbackSeconds: 7 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1h", provider: "schwab", lookbackSeconds: 35 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1w", provider: "schwab", lookbackSeconds: 4 * 365 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1h", provider: "yahoo", lookbackSeconds: 35 * 24 * 60 * 60 },
    { symbol: "AAPL", timeframe: "1w", provider: "yahoo", lookbackSeconds: 4 * 365 * 24 * 60 * 60 },
  ]
}

async function runCase(input: ValidationCase): Promise<ValidationResult> {
  const endTime = Math.floor(Date.now() / 1000)
  const startTime = endTime - input.lookbackSeconds
  const requestPlan =
    input.provider === "schwab"
      ? {
          range: buildSchwabHistoryParams(input.timeframe, startTime, endTime, "range"),
          fallback: input.timeframe === "1m" ? buildSchwabHistoryParams(input.timeframe, startTime, endTime, "period") : null,
        }
      : null

  try {
    const provider =
      input.provider === "schwab"
        ? new SchwabProvider()
        : new YahooProvider()
    const bars = await provider.getHistoricalData(input.symbol, input.timeframe, startTime, endTime)

    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      provider: input.provider,
      startTime,
      endTime,
      ok: true,
      bars: bars.length,
      error: null,
      requestPlan,
    }
  } catch (error) {
    return {
      symbol: input.symbol,
      timeframe: input.timeframe,
      provider: input.provider,
      startTime,
      endTime,
      ok: false,
      bars: 0,
      error: error instanceof Error ? error.message : String(error),
      requestPlan,
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const runtimeSchwabClient = await getRuntimeSchwabClientWithOptions({ silent: true })
  const cases = createCases().filter((item) => item.provider !== "schwab" || !!runtimeSchwabClient)
  const results: ValidationResult[] = []

  for (const item of cases) {
    results.push(await runCase(item))
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    runtime: {
      schwabAvailable: !!runtimeSchwabClient,
      yahooAvailable: true,
    },
    capabilities: {
      shortTermCanonicalStorage: ["1m", "1h", "1w"],
      derivedIntervals: ["30s", "3m", "5m", "10m", "15m", "30m", "2h", "3h", "4h"],
      notes: [
        "Schwab 1m validation uses the same 7-day lookback window the Stage 2 scheduler currently generates.",
        "Yahoo is treated as a reference provider with a conservative operational budget, not a trusted parity source.",
      ],
    },
    results,
  }

  await fs.mkdir(path.dirname(args.output), { recursive: true })
  await fs.writeFile(args.output, JSON.stringify(payload, null, 2))
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`)
}

main().catch((error) => {
  console.error("[validate-provider-matrix] Failed:", error)
  process.exitCode = 1
})
