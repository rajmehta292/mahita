import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { continuousIngestController } from '@/app/services/market-data/continuous-ingest'
import { ingestionService } from '@/app/services/market-data/ingestion'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const restartContinuous = body.restartContinuous === true
    const providerOverride = typeof body.provider === 'string' ? body.provider : undefined

    if (ingestionService.isRunning()) {
        return NextResponse.json({ error: 'Cannot reset while an ingestion sweep is running.' }, { status: 409 })
    }

    await continuousIngestController.stop()

    await prisma.$transaction([
        prisma.ingestionEvent.deleteMany({}),
        prisma.ingestionJob.deleteMany({}),
        prisma.dataSpan.deleteMany({}),
        prisma.dataPartition.deleteMany({}),
        prisma.symbolRegistry.deleteMany({}),
        prisma.dataInventory.deleteMany({}),
        prisma.marketData.deleteMany({})
    ])

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

    return NextResponse.json({
        success: true,
        message: 'Market data cleared successfully.',
        continuousStatus
    })
}
