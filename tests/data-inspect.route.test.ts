import { beforeEach, describe, expect, it, vi } from "vitest"
import type { NextRequest } from "next/server"

const { requireRouteAccessMock, readVaultBarsPageMock, getHealthMock } = vi.hoisted(() => ({
  requireRouteAccessMock: vi.fn(),
  readVaultBarsPageMock: vi.fn(),
  getHealthMock: vi.fn(),
}))

vi.mock("@/lib/security/platform-security", () => ({
  requireRouteAccess: requireRouteAccessMock,
}))

vi.mock("@/app/services/market-data/read-service", () => ({
  readVaultBarsPage: readVaultBarsPageMock,
}))

vi.mock("@/app/services/market-data/health", () => ({
  DataHealthManager: {
    getHealth: getHealthMock,
  },
}))

import { GET } from "@/app/api/trading/data-inspect/route"

describe("/api/trading/data-inspect", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireRouteAccessMock.mockResolvedValue({ ok: true })
    readVaultBarsPageMock.mockResolvedValue({
      bars: [
        {
          id: "bar-1",
          time: 1710000000,
          open: 1,
          high: 2,
          low: 0.5,
          close: 1.5,
          volume: 100,
          source: "schwab",
        },
      ],
      totalCount: 1,
    })
    getHealthMock.mockResolvedValue({
      symbol: "AAPL",
      timeframe: "1d",
      count: 1,
      healthScore: 100,
      targetCoveragePercent: 100,
      gaps: [],
      gapCount: 0,
      vaultName: "schwab",
    })
  })

  it("reads paginated bars from the selected vault", async () => {
    const response = await GET(
      new Request("http://localhost/api/trading/data-inspect?symbol=AAPL&timeframe=1d&vault=master") as unknown as NextRequest
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(readVaultBarsPageMock).toHaveBeenCalledWith({
      symbol: "AAPL",
      timeframe: "1d",
      page: 1,
      pageSize: 100,
      vaultName: "master",
    })
    expect(getHealthMock).toHaveBeenCalledWith("AAPL", "1d", "master")
    expect(payload.vaultName).toBe("master")
    expect(payload.data[0]).toMatchObject({
      id: "bar-1",
      source: "schwab",
    })
  })
})
