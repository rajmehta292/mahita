import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  prismaMock,
  getClientMock,
  marketDataCountMock,
  marketDataFindManyMock,
  marketDataGroupByMock,
} = vi.hoisted(() => ({
  prismaMock: {
    vault: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    dataInventory: {
      findMany: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
  getClientMock: vi.fn(),
  marketDataCountMock: vi.fn(),
  marketDataFindManyMock: vi.fn(),
  marketDataGroupByMock: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}))

vi.mock("@/app/services/market-data/vault-manager", () => ({
  vaultManager: {
    getClient: getClientMock,
  },
  withVaultQueryRetry: async <T>(query: () => Promise<T>) => query(),
}))

vi.mock("@/app/services/market-data/utils", () => ({
  getMissingRanges: vi.fn(() => []),
  timeframeToSeconds: vi.fn(() => 60),
}))

import { DataHealthManager } from "@/app/services/market-data/health"

describe("market-data inventory reconciliation", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    prismaMock.vault.findUnique.mockResolvedValue({ id: "vault-schwab", name: "schwab" })
    prismaMock.vault.findMany.mockResolvedValue([{ name: "schwab" }])
    prismaMock.dataInventory.upsert.mockResolvedValue(undefined)
    prismaMock.dataInventory.deleteMany.mockResolvedValue({ count: 0 })

    getClientMock.mockResolvedValue({
      marketData: {
        count: marketDataCountMock,
        findMany: marketDataFindManyMock,
        groupBy: marketDataGroupByMock,
      },
    })

    marketDataCountMock.mockResolvedValue(2)
    marketDataFindManyMock.mockImplementation(async () => [
      { time: new Date("2026-03-17T20:00:00.000Z"), source: "schwab" },
      { time: new Date("2026-03-17T20:01:00.000Z"), source: "schwab" },
    ])
    marketDataGroupByMock.mockResolvedValue([
      { symbol: "AAPL", timeframe: "1m" },
      { symbol: "MSFT", timeframe: "1m" },
    ])
  })

  it("does not delete unrelated inventory rows during targeted refresh", async () => {
    prismaMock.dataInventory.findMany.mockResolvedValue([
      { id: "row-aapl", symbol: "AAPL", timeframe: "1m" },
      { id: "row-msft", symbol: "MSFT", timeframe: "1m" },
    ])

    await DataHealthManager.refreshInventorySelection("AAPL", "1m", "schwab")

    expect(prismaMock.dataInventory.upsert).toHaveBeenCalledTimes(1)
    expect(prismaMock.dataInventory.deleteMany).not.toHaveBeenCalled()
  })

  it("still prunes stale inventory rows during a full vault refresh", async () => {
    prismaMock.dataInventory.findMany.mockResolvedValue([
      { id: "row-aapl", symbol: "AAPL", timeframe: "1m" },
      { id: "row-goog", symbol: "GOOG", timeframe: "1m" },
    ])

    await DataHealthManager.refreshInventory("schwab")

    expect(prismaMock.dataInventory.upsert).toHaveBeenCalledTimes(2)
    expect(prismaMock.dataInventory.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["row-goog"] } },
    })
  })
})
