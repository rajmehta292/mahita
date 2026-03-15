import { beforeEach, describe, expect, it, vi } from "vitest"

const { getAppServerSessionMock, getCanonicalChartCatalogRowsMock } = vi.hoisted(() => ({
  getAppServerSessionMock: vi.fn(),
  getCanonicalChartCatalogRowsMock: vi.fn(),
}))

vi.mock("@/lib/server-session", () => ({
  getAppServerSession: getAppServerSessionMock,
}))

vi.mock("@/app/services/market-data/read-service", () => ({
  getCanonicalChartCatalogRows: getCanonicalChartCatalogRowsMock,
}))

import { GET } from "@/app/api/platform/chart-catalog/route"

describe("/api/platform/chart-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAppServerSessionMock.mockResolvedValue({ user: { email: "raj@example.com" } })
    getCanonicalChartCatalogRowsMock.mockResolvedValue([
      {
        symbol: "AAPL",
        timeframe: "1d",
        lastSynced: new Date("2026-03-11T15:01:31.000Z"),
        lastBar: new Date("2026-03-11T15:00:00.000Z"),
        barCount: 120,
      },
    ])
  })

  it("returns canonical vault-backed metadata", async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload.metadata).toMatchObject({
      sourceOfTruth: "vault-sqlite",
      canonicalVault: "schwab",
      parquetStatus: "experimental",
    })
    expect(payload.catalog[0]).toMatchObject({
      symbol: "AAPL",
      timeframes: ["1d"],
      barCount: 120,
    })
  })
})
