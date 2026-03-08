import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { continuousIngestController } from '@/app/services/market-data/continuous-ingest'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json(continuousIngestController.getStatus())
}

export async function POST(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const action = body.action

    if (action === 'start') {
        const status = await continuousIngestController.start({
            provider: body.provider,
            intervalMs: typeof body.intervalMs === 'number' ? body.intervalMs : undefined
        })
        return NextResponse.json(status)
    }

    if (action === 'stop') {
        const status = await continuousIngestController.stop()
        return NextResponse.json(status)
    }

    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })
}
