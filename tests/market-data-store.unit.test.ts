import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  schwabGetHistoricalDataMock,
  yahooGetHistoricalDataMock,
  telemetryLogMock,
  getClientMock,
  withVaultQueryRetryMock,
  checkSchwabTokenHealthMock,
} = vi.hoisted(() => ({
  schwabGetHistoricalDataMock: vi.fn(),
  yahooGetHistoricalDataMock: vi.fn(),
  telemetryLogMock: vi.fn(async () => undefined),
  getClientMock: vi.fn(),
  withVaultQueryRetryMock: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  checkSchwabTokenHealthMock: vi.fn(async () => ({ isValid: true })),
}))

vi.mock("@/app/services/market-data/providers/schwab", () => ({
  SchwabProvider: class {
    getHistoricalData = schwabGetHistoricalDataMock
  },
}))

vi.mock("@/app/services/market-data/providers/yahoo", () => ({
  YahooProvider: class {
    getHistoricalData = yahooGetHistoricalDataMock
  },
}))

vi.mock("@/app/services/market-data/providers/google", () => ({
  GoogleProvider: class {
    getHistoricalData = vi.fn(async () => [])
  },
}))

vi.mock("@/app/services/market-data/providers/alphavantage", () => ({
  AlphaVantageProvider: class {
    getHistoricalData = vi.fn(async () => [])
  },
}))

vi.mock("@/app/services/market-data/provider-telemetry", () => ({
  providerTelemetryBus: {
    log: telemetryLogMock,
  },
}))

vi.mock("@/app/services/market-data/vault-manager", () => ({
  vaultManager: {
    getClient: getClientMock,
  },
  withVaultQueryRetry: withVaultQueryRetryMock,
}))

vi.mock("@/app/services/schwab/runtime", () => ({
  checkSchwabTokenHealth: checkSchwabTokenHealthMock,
}))

process.env.MAHITA_MARKET_DATA_PROVIDER_TIMEOUT_MS = "20"

import { MarketDataStore } from "@/app/services/market-data/store"

describe("MarketDataStore provider fallback", () => {
  const rows: Array<{
    symbol: string
    timeframe: string
    time: Date
    open: number
    high: number
    low: number
    close: number
    volume: number
    source: string
  }> = []

  beforeEach(() => {
    vi.clearAllMocks()
    rows.splice(0, rows.length)
    checkSchwabTokenHealthMock.mockResolvedValue({ isValid: true })

    getClientMock.mockResolvedValue({
      marketData: {
        findMany: vi.fn(async ({ where }: { where: { symbol: string; timeframe: string; time: { gte: Date; lte: Date } } }) =>
          rows
            .filter((row) =>
              row.symbol === where.symbol
              && row.timeframe === where.timeframe
              && row.time >= where.time.gte
              && row.time <= where.time.lte
            )
            .sort((left, right) => left.time.getTime() - right.time.getTime())
        ),
        count: vi.fn(async ({ where }: { where: { symbol: string; timeframe: string } }) =>
          rows.filter((row) => row.symbol === where.symbol && row.timeframe === where.timeframe).length
        ),
        createMany: vi.fn(async ({ data }: { data: typeof rows }) => {
          rows.push(...data)
        }),
        upsert: vi.fn(async ({ create, update, where }: {
          create: (typeof rows)[number]
          update: Partial<(typeof rows)[number]>
          where: { symbol_timeframe_time: { symbol: string; timeframe: string; time: Date } }
        }) => {
          const existing = rows.find((row) =>
            row.symbol === where.symbol_timeframe_time.symbol
            && row.timeframe === where.symbol_timeframe_time.timeframe
            && row.time.getTime() === where.symbol_timeframe_time.time.getTime()
          )
          if (existing) {
            Object.assign(existing, update)
          } else {
            rows.push(create)
          }
        }),
        deleteMany: vi.fn(async ({ where }: { where: { symbol: string; timeframe: string; time: { gte: Date; lte: Date } } }) => {
          for (let index = rows.length - 1; index >= 0; index -= 1) {
            const row = rows[index]
            if (
              row.symbol === where.symbol
              && row.timeframe === where.timeframe
              && row.time >= where.time.gte
              && row.time <= where.time.lte
            ) {
              rows.splice(index, 1)
            }
          }
        }),
      },
    })
  })

  it("falls back to yahoo when schwab hangs", async () => {
    schwabGetHistoricalDataMock.mockImplementation(() => new Promise(() => undefined))
    yahooGetHistoricalDataMock.mockResolvedValue([
      {
        time: 1710000000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
      },
    ])

    const store = new MarketDataStore()
    const result = await store.getHistoricalDataWithReport("AAPL", "1d", 1709990000, 1710003600, {
      providerTimeoutMs: 20,
    })

    expect(result.data).toHaveLength(1)
    expect(yahooGetHistoricalDataMock).toHaveBeenCalledOnce()
    expect(result.report.chunkReports[0]?.provider).toBe("yahoo")
    expect(result.report.chunkReports[0]?.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("schwab timed out")])
    )
  })

  it("coalesces fragmented interactive gaps into a bounded refresh plan", async () => {
    const startTime = 1710000000
    const endTime = startTime + (6 * 3600)

    for (let time = startTime; time <= endTime; time += 600) {
      rows.push({
        symbol: "AAPL",
        timeframe: "1m",
        time: new Date(time * 1000),
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
        source: "schwab",
      })
    }

    schwabGetHistoricalDataMock.mockResolvedValue([
      {
        time: endTime,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
      },
    ])

    const store = new MarketDataStore()
    const result = await store.getHistoricalDataWithReport("AAPL", "1m", startTime, endTime, {
      fetchMode: "interactive",
    })

    expect(schwabGetHistoricalDataMock).toHaveBeenCalledTimes(1)
    expect(result.report.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("fragmented missing ranges during interactive load")])
    )
  })

  it("deduplicates concurrent identical range fetches", async () => {
    schwabGetHistoricalDataMock.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 25))
      return [
        {
          time: 1710000000,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 100,
        },
      ]
    })

    const store = new MarketDataStore()
    await Promise.all([
      store.getHistoricalDataWithReport("AAPL", "1d", 1709990000, 1710003600, { fetchMode: "interactive" }),
      store.getHistoricalDataWithReport("AAPL", "1d", 1709990000, 1710003600, { fetchMode: "interactive" }),
    ])

    expect(schwabGetHistoricalDataMock).toHaveBeenCalledTimes(1)
  })

  it("skips schwab auto-selection when no runtime token is available", async () => {
    checkSchwabTokenHealthMock.mockResolvedValue({ isValid: false })
    yahooGetHistoricalDataMock.mockResolvedValue([
      {
        time: 1710000000,
        open: 1,
        high: 2,
        low: 0.5,
        close: 1.5,
        volume: 100,
      },
    ])

    const store = new MarketDataStore()
    const result = await store.getHistoricalDataWithReport("AAPL", "1d", 1709990000, 1710003600, {
      fetchMode: "interactive",
    })

    expect(schwabGetHistoricalDataMock).not.toHaveBeenCalled()
    expect(yahooGetHistoricalDataMock).toHaveBeenCalledOnce()
    expect(result.report.chunkReports[0]?.provider).toBe("yahoo")
  })
})
