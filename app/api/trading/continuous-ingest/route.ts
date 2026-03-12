import { NextRequest, NextResponse } from 'next/server'
import { continuousIngestController } from '@/app/services/market-data/continuous-ingest'
import { requireRouteAccess, writeAdminAuditEvent } from '@/lib/security/platform-security'

export async function GET() {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    return NextResponse.json(continuousIngestController.getStatus())
}

export async function POST(request: NextRequest) {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'start') {
        const status = await continuousIngestController.start({
            provider: body.provider,
            intervalMs: typeof body.intervalMs === 'number' ? body.intervalMs : undefined
        })
        await writeAdminAuditEvent({
            actorUserId: access.userId,
            action: 'CONTINUOUS_INGEST_START',
            metadata: JSON.stringify({
                provider: body.provider ?? 'auto',
                intervalMs: typeof body.intervalMs === 'number' ? body.intervalMs : null,
            }),
        })
        return NextResponse.json(status)
    }

    if (action === 'stop') {
        const status = await continuousIngestController.stop()
        await writeAdminAuditEvent({
            actorUserId: access.userId,
            action: 'CONTINUOUS_INGEST_STOP',
            metadata: JSON.stringify({ route: '/api/trading/continuous-ingest' }),
        })
        return NextResponse.json(status)
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
