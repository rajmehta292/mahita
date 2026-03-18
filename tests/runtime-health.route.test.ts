import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getRuntimeHealthSnapshotMock,
  getSchedulerSnapshotMock,
  reconcileDefaultSchedulerRuntimeMock,
} = vi.hoisted(() => ({
  getRuntimeHealthSnapshotMock: vi.fn(),
  getSchedulerSnapshotMock: vi.fn(),
  reconcileDefaultSchedulerRuntimeMock: vi.fn(),
}))

vi.mock("@/lib/runtime-health", () => ({
  getRuntimeHealthSnapshot: getRuntimeHealthSnapshotMock,
}))

vi.mock("@/app/services/market-data/scheduler", () => ({
  getSchedulerSnapshot: getSchedulerSnapshotMock,
  reconcileDefaultSchedulerRuntime: reconcileDefaultSchedulerRuntimeMock,
}))

import { GET } from "@/app/api/health/runtime/route"

describe("/api/health/runtime", () => {
  beforeEach(() => {
    vi.clearAllMocks()

    reconcileDefaultSchedulerRuntimeMock.mockResolvedValue(undefined)
    getRuntimeHealthSnapshotMock.mockResolvedValue({
      ok: true,
      runtime: {
        prismaClientReady: true,
        missingPrismaModels: [],
        diUiPrismaClientReady: true,
        missingDiUiPrismaModels: [],
      },
      providerPool: {
        marketDataMemberCount: 1,
        superuserBridgeCandidates: 0,
      },
    })
    getSchedulerSnapshotMock.mockResolvedValue({
      runtime: {
        desiredState: { shouldRun: true, profileStatus: "ACTIVE", isDefault: true },
        actualRuntimeState: {
          running: true,
          currentPhase: "running cycle 3",
          intervalMs: 60000,
          providerOverride: null,
          schedulerEnabled: true,
          lastError: null,
          cycleCount: 3,
        },
      },
      providerReadiness: {
        allowedRuntimeProviders: ["schwab", "yahoo"],
        experimentalProviders: ["google", "alphavantage"],
        availability: { schwab: true, yahoo: true },
        tokenHealth: { isValid: true },
      },
      inventoryParity: {
        summary: {
          totalVaultKeys: 120,
          totalInventoryKeys: 118,
          missingInventoryRows: 2,
          staleInventoryRows: 0,
        },
      },
    })
  })

  it("includes scheduler runtime diagnostics in the health payload", async () => {
    const response = await GET()
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(reconcileDefaultSchedulerRuntimeMock).toHaveBeenCalledTimes(1)
    expect(payload.schedulerRuntime).toMatchObject({
      desiredState: { shouldRun: true, profileStatus: "ACTIVE", isDefault: true },
      actualRuntimeState: { running: true, currentPhase: "running cycle 3", cycleCount: 3 },
      providerReadiness: {
        allowedRuntimeProviders: ["schwab", "yahoo"],
        availability: { schwab: true, yahoo: true },
      },
      inventoryParity: {
        totalVaultKeys: 120,
        totalInventoryKeys: 118,
        missingInventoryRows: 2,
        staleInventoryRows: 0,
      },
    })
  })
})
