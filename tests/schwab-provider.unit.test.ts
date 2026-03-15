import { describe, expect, it, vi } from "vitest"
import {
  SCHWAB_MINUTE_CHUNK_SIZE_MS,
  SchwabProvider,
  buildSchwabHistoryParams,
  getSupportedMinutePeriod,
} from "@/app/services/market-data/providers/schwab"

describe("SchwabProvider", () => {
  it("uses explicit minute range params for canonical 1m requests", () => {
    const now = Math.floor(Date.now() / 1000)
    const sevenDaysAgo = now - 7 * 24 * 60 * 60
    expect(buildSchwabHistoryParams("1m", sevenDaysAgo, now, "range")).toEqual({
      frequencyType: "minute",
      frequency: 1,
      startDate: sevenDaysAgo * 1000,
      endDate: now * 1000,
    })
  })

  it("snaps period fallback params to a Schwab-supported day period", () => {
    const now = Math.floor(Date.now() / 1000)
    const threeDaysAgo = now - 3 * 24 * 60 * 60
    expect(getSupportedMinutePeriod(7)).toBe(10)
    expect(buildSchwabHistoryParams("1m", threeDaysAgo, now, "period")).toEqual({
      periodType: "day",
      period: 3,
      frequencyType: "minute",
      frequency: 1,
    })
  })

  it("chunks minute requests by explicit date windows", async () => {
    const provider = new SchwabProvider()
    const getPriceHistory = vi.fn().mockResolvedValue({ data: { candles: [] } })
    const now = Math.floor(Date.now() / 1000)
    const eightDaysAgo = now - 8 * 24 * 60 * 60

    await provider.getHistoricalData("MSFT", "1m", eightDaysAgo, now, {
      providerClient: {
        getPriceHistory,
      } as never,
    })

    expect(getPriceHistory).toHaveBeenCalledTimes(2)
    expect(getPriceHistory).toHaveBeenNthCalledWith(
      1,
      "MSFT",
      expect.objectContaining({
        frequencyType: "minute",
        frequency: 1,
        startDate: eightDaysAgo * 1000,
        endDate: Math.min(eightDaysAgo * 1000 + SCHWAB_MINUTE_CHUNK_SIZE_MS, now * 1000),
      })
    )
  })

  it("falls back to a period-based minute request when the final chunk gets a 400", async () => {
    const provider = new SchwabProvider()
    const error = new Error("Schwab API Error 400: Bad Request")
    const getPriceHistory = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ data: { candles: [] } })
    const now = Math.floor(Date.now() / 1000)
    const threeDaysAgo = now - 3 * 24 * 60 * 60

    await provider.getHistoricalData("CRM", "1m", threeDaysAgo, now, {
      providerClient: {
        getPriceHistory,
      } as never,
    })

    expect(getPriceHistory).toHaveBeenCalledTimes(2)
    expect(getPriceHistory).toHaveBeenNthCalledWith(
      2,
      "CRM",
      expect.objectContaining({
        periodType: "day",
        period: 3,
        frequencyType: "minute",
        frequency: 1,
      })
    )
  })

  it("falls back to a period-based weekly request when the range form gets a 400", async () => {
    const provider = new SchwabProvider()
    const error = new Error("Schwab API Error 400: Bad Request")
    const getPriceHistory = vi
      .fn()
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ data: { candles: [] } })
    const now = Math.floor(Date.now() / 1000)
    const fourYearsAgo = now - 4 * 365 * 24 * 60 * 60

    await provider.getHistoricalData("AAPL", "1w", fourYearsAgo, now, {
      providerClient: {
        getPriceHistory,
      } as never,
    })

    expect(getPriceHistory).toHaveBeenCalledTimes(2)
    expect(getPriceHistory).toHaveBeenNthCalledWith(
      2,
      "AAPL",
      expect.objectContaining({
        periodType: "year",
        period: 5,
        frequencyType: "weekly",
        frequency: 1,
      })
    )
  })
})
