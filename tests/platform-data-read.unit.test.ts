import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock, vaultManagerMock } = vi.hoisted(() => ({
  prismaMock: {
    vault: {
      findUnique: vi.fn(),
    },
    dataInventory: {
      findMany: vi.fn(),
    },
  },
  vaultManagerMock: {
    getClient: vi.fn(),
    seedVaults: vi.fn(),
    withVaultQueryRetry: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  },
}))

vi.mock("@/lib/prisma", () => ({
  default: prismaMock,
}))

vi.mock("@/app/services/market-data/vault-manager", () => ({
  vaultManager: vaultManagerMock,
  withVaultQueryRetry: vaultManagerMock.withVaultQueryRetry,
}))

import {
  classifyPlatformDataProvenance,
  getCanonicalChartCatalogRows,
} from "@/app/services/market-data/read-service"

describe("platform-data read service", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("classifies derived bars as vault-backed derived data", () => {
    expect(
      classifyPlatformDataProvenance({
        requestedTimeframe: "5m",
        vaultName: "schwab",
        sources: ["schwab"],
      })
    ).toEqual({
      requestedTimeframe: "5m",
      storageTimeframe: "1m",
      storageClass: "derived",
      verificationStatus: "single-source-unverified",
      verificationMethod: null,
      lastVerifiedAt: null,
      vaultName: "schwab",
      sourceOfTruth: "vault-sqlite",
      sources: ["schwab"],
    })
  })

  it("classifies master vault rows as cross-source verified", () => {
    expect(
      classifyPlatformDataProvenance({
        requestedTimeframe: "1d",
        vaultName: "master",
        sources: ["consolidator-verified"],
      }).verificationStatus
    ).toBe("cross-source-verified")
  })

  it("prefers canonical inventory rows when available", async () => {
    prismaMock.vault.findUnique.mockResolvedValue({ id: "vault-1" })
    prismaMock.dataInventory.findMany.mockResolvedValue([
      {
        symbol: "AAPL",
        timeframe: "1d",
        lastSynced: new Date("2026-03-11T15:00:00.000Z"),
        lastBar: new Date("2026-03-11T14:30:00.000Z"),
        barCount: 100,
      },
    ])

    const rows = await getCanonicalChartCatalogRows()

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      symbol: "AAPL",
      timeframe: "1d",
      barCount: 100,
    })
    expect(vaultManagerMock.getClient).not.toHaveBeenCalled()
  })

  it("falls back to the vault DB when inventory is empty", async () => {
    prismaMock.vault.findUnique.mockResolvedValue({ id: "vault-1" })
    prismaMock.dataInventory.findMany.mockResolvedValue([])
    vaultManagerMock.getClient.mockResolvedValue({
      marketData: {
        findMany: vi.fn().mockResolvedValue([
          {
            symbol: "MSFT",
            timeframe: "1h",
            time: new Date("2026-03-11T16:00:00.000Z"),
          },
        ]),
      },
    })

    const rows = await getCanonicalChartCatalogRows()

    expect(rows).toEqual([
      {
        symbol: "MSFT",
        timeframe: "1h",
        lastSynced: new Date("2026-03-11T16:00:00.000Z"),
        lastBar: new Date("2026-03-11T16:00:00.000Z"),
        barCount: 0,
      },
    ])
  })

  it("seeds default vaults if the canonical vault registry entry is missing", async () => {
    prismaMock.vault.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "vault-seeded" })
    prismaMock.dataInventory.findMany.mockResolvedValue([])
    vaultManagerMock.seedVaults.mockResolvedValue(undefined)
    vaultManagerMock.getClient.mockResolvedValue({
      marketData: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    })

    await getCanonicalChartCatalogRows()

    expect(vaultManagerMock.seedVaults).toHaveBeenCalled()
  })
})
