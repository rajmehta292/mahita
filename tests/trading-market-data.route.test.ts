import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const {
  getServerSessionMock,
  getHistoricalDataWithReportMock,
  getInventoryProvenanceMock,
  listDistinctVaultSourcesMock,
} = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  getHistoricalDataWithReportMock: vi.fn(),
  getInventoryProvenanceMock: vi.fn(),
  listDistinctVaultSourcesMock: vi.fn(),
}))

vi.mock("next-auth/next", () => ({
  getServerSession: getServerSessionMock,
}))

vi.mock("@/lib/auth", () => ({
  authOptions: {},
}))

vi.mock("@/app/services/market-data/store", () => ({
  marketDataStore: {
    getHistoricalDataWithReport: getHistoricalDataWithReportMock,
  },
}))

vi.mock("@/app/services/market-data/read-service", async () => {
  const actual = await vi.importActual<typeof import("@/app/services/market-data/read-service")>(
    "@/app/services/market-data/read-service"
  )
  return {
    ...actual,
    getInventoryProvenance: getInventoryProvenanceMock,
    listDistinctVaultSources: listDistinctVaultSourcesMock,
  }
})

import { GET } from "@/app/api/trading/market-data/route"

describe("/api/trading/market-data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getServerSessionMock.mockResolvedValue({ user: { email: "raj@example.com" } })
    getHistoricalDataWithReportMock.mockResolvedValue({
      data: [
        { time: 1710000000, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
      ],
      report: {
        symbol: "AAPL",
        timeframe: "5m",
        rangeStart: 1700000000,
        rangeEnd: 1710000000,
        cacheBars: 10,
        fetchedBars: 5,
        persistedBars: 5,
        dbTotalAfterFetch: 15,
        chunkReports: [{ provider: "schwab" }],
        warnings: [],
      },
    })
    listDistinctVaultSourcesMock.mockResolvedValue(["schwab"])
    getInventoryProvenanceMock.mockResolvedValue({
      verificationStatus: "single-source-unverified",
      verificationMethod: null,
      lastVerifiedAt: null,
      canonicalInterval: "1m",
      storageClass: "derived",
    })
  })

  it("returns vault-backed provenance metadata", async () => {
    const response = await GET(
      new Request("http://localhost/api/trading/market-data?symbol=AAPL&timeframe=5m") as unknown as NextRequest
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metadata.provenance).toMatchObject({
      sourceOfTruth: "vault-sqlite",
      vaultName: "schwab",
      requestedTimeframe: "5m",
      storageTimeframe: "1m",
      storageClass: "derived",
      verificationStatus: "single-source-unverified",
      sources: ["schwab"],
    })
  })
})
