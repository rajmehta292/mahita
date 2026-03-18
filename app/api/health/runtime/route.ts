import { NextResponse } from "next/server"
import { getRuntimeHealthSnapshot } from "@/lib/runtime-health"
import { toErrorResponse } from "@/lib/route-errors"
import { getSchedulerSnapshot, reconcileDefaultSchedulerRuntime } from "@/app/services/market-data/scheduler"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await reconcileDefaultSchedulerRuntime()
    const [health, scheduler] = await Promise.all([
      getRuntimeHealthSnapshot(),
      getSchedulerSnapshot().catch(() => null),
    ])
    return NextResponse.json({
      ...health,
      schedulerRuntime: scheduler
        ? {
            desiredState: scheduler.runtime.desiredState,
            actualRuntimeState: scheduler.runtime.actualRuntimeState,
            providerReadiness: scheduler.providerReadiness,
            inventoryParity: scheduler.inventoryParity.summary,
          }
        : null,
    }, {
      status: health.ok ? 200 : 503,
    })
  } catch (error) {
    return toErrorResponse(error, "Mahita could not determine runtime health.")
  }
}
