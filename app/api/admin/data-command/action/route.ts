import { NextRequest, NextResponse } from "next/server"
import { continuousIngestController } from "@/app/services/market-data/continuous-ingest"
import { DataHealthManager } from "@/app/services/market-data/health"
import { ingestionService } from "@/app/services/market-data/ingestion"
import { providerTelemetryBus } from "@/app/services/market-data/provider-telemetry"
import { vaultManager } from "@/app/services/market-data/vault-manager"
import prisma from "@/lib/prisma"
import { requireRouteAccess, writeAdminAuditEvent } from "@/lib/security/platform-security"
import type { Timeframe } from "@/app/services/market-data/types"

export async function POST(request: NextRequest) {
  const access = await requireRouteAccess({ policy: "superuser" })
  if (!access.ok) {
    return access.response
  }

  const body = await request.json().catch(() => ({}))
  const action = body.action

  if (action === "refresh-health") {
    await DataHealthManager.refreshInventory()
    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "DATA_HEALTH_REFRESH",
      metadata: JSON.stringify({ route: "/api/admin/data-command/action", action }),
    })
    return NextResponse.json({ success: true })
  }

  if (action === "start-continuous") {
    const status = await continuousIngestController.start({
      provider: typeof body.provider === "string" ? body.provider : undefined,
      intervalMs: typeof body.intervalMs === "number" ? body.intervalMs : undefined,
    })
    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "CONTINUOUS_INGEST_START",
      metadata: JSON.stringify({
        provider: body.provider ?? "auto",
        intervalMs: body.intervalMs ?? null,
      }),
    })
    return NextResponse.json({ success: true, status })
  }

  if (action === "stop-continuous") {
    const status = await continuousIngestController.stop()
    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "CONTINUOUS_INGEST_STOP",
      metadata: JSON.stringify({ route: "/api/admin/data-command/action", action }),
    })
    return NextResponse.json({ success: true, status })
  }

  if (action === "sync-gaps") {
    if (typeof body.symbol !== "string" || typeof body.timeframe !== "string") {
      return NextResponse.json({ error: "symbol and timeframe are required" }, { status: 400 })
    }

    const result = await DataHealthManager.syncGaps(body.symbol, body.timeframe as Timeframe, typeof body.provider === "string" ? body.provider : undefined)
    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "DATA_GAP_SYNC",
      metadata: JSON.stringify({
        symbol: body.symbol,
        timeframe: body.timeframe,
        provider: body.provider ?? null,
      }),
    })
    return NextResponse.json({ success: true, result })
  }

  if (action === "reset-market-data") {
    if (ingestionService.isRunning()) {
      return NextResponse.json({ error: "Cannot reset while an ingestion sweep is running." }, { status: 409 })
    }

    const restartContinuous = body.restartContinuous === true
    const providerOverride = typeof body.provider === "string" ? body.provider : "schwab"

    await continuousIngestController.stop()

    try {
      const vaultClient = await vaultManager.getClient(providerOverride)
      await vaultClient.marketData.deleteMany({})

      const vault = await prisma.vault.findUnique({ where: { name: providerOverride } })
      await prisma.dataInventory.deleteMany({
        where: { vaultId: vault?.id },
      })
    } catch (error) {
      console.error("[AdminDataCommand] Market data reset failed:", error)
    }

    await providerTelemetryBus.clear()

    const status = restartContinuous
      ? await continuousIngestController.start({ provider: providerOverride })
      : continuousIngestController.getStatus()

    await writeAdminAuditEvent({
      actorUserId: access.userId,
      action: "MARKET_DATA_RESET",
      metadata: JSON.stringify({
        provider: providerOverride,
        restartContinuous,
      }),
    })

    return NextResponse.json({ success: true, status })
  }

  return NextResponse.json({ error: "Unsupported admin data command action" }, { status: 400 })
}
