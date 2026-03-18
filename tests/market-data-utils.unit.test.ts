import { describe, expect, it } from "vitest"

import { getMissingRanges } from "@/app/services/market-data/utils"

describe("market-data gap detection", () => {
  it("ignores sparse provider-native 1m gaps that should not trigger repair", () => {
    const ranges = getMissingRanges(
      "AAPL",
      "1m",
      [
        { time: 1710000000, open: 1, high: 1, low: 1, close: 1, volume: 100 },
        { time: 1710000120, open: 1, high: 1, low: 1, close: 1, volume: 100 },
        { time: 1710000240, open: 1, high: 1, low: 1, close: 1, volume: 100 },
        { time: 1710000480, open: 1, high: 1, low: 1, close: 1, volume: 100 },
      ],
      1710000000,
      1710000480
    )

    expect(ranges).toEqual([])
  })

  it("ignores after-hours trailing gaps for intraday data", () => {
    const ranges = getMissingRanges(
      "AAPL",
      "1m",
      [
        { time: 1710000000, open: 1, high: 1, low: 1, close: 1, volume: 100 },
        { time: 1710000060, open: 1, high: 1, low: 1, close: 1, volume: 100 },
      ],
      1710000000,
      1710021660
    )

    expect(ranges).toEqual([])
  })
})
