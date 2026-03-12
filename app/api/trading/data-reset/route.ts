import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { continuousIngestController } from '@/app/services/market-data/continuous-ingest'
import { ingestionService } from '@/app/services/market-data/ingestion'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'
import { vaultManager } from '@/app/services/market-data/vault-manager'
import { requireRouteAccess, writeAdminAuditEvent } from '@/lib/security/platform-security'

export async function POST(request: NextRequest) {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    const body = await request.json().catch(() => ({}))
    const restartContinuous = body.restartContinuous === true
    const providerOverride = typeof body.provider === 'string' ? body.provider : undefined

    if (ingestionService.isRunning()) {
        return NextResponse.json({ error: 'Cannot reset while an ingestion sweep is running.' }, { status: 409 })
    }

    await continuousIngestController.stop()

    try {
        const vaultClient = await vaultManager.getClient(providerOverride || 'schwab')
        await vaultClient.marketData.deleteMany({})

        // Clear associated telemetry locally
        await prisma.dataInventory.deleteMany({
            where: { vaultId: (await prisma.vault.findUnique({ where: { name: providerOverride || 'schwab' } }))?.id }
        })
    } catch (e) {
        console.error('Vault purge error:', e)
    }

    await providerTelemetryBus.clear()
    await providerTelemetryBus.log({
        kind: 'control',
        message: 'Market data reset completed.',
        response: {
            restartContinuous,
            providerOverride: providerOverride || 'auto'
        }
    })

    const continuousStatus = restartContinuous
        ? await continuousIngestController.start({ provider: providerOverride })
        : continuousIngestController.getStatus()

    await writeAdminAuditEvent({
        actorUserId: access.userId,
        action: 'MARKET_DATA_RESET',
        metadata: JSON.stringify({
            restartContinuous,
            providerOverride: providerOverride || 'auto',
        }),
    })

    return NextResponse.json({
        success: true,
        message: 'Market data cleared successfully.',
        continuousStatus
    })
}
