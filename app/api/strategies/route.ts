import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { listStrategies, saveStrategyWorkspaceSession } from '@/lib/strategy-library'
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const strategies = await listStrategies(session.user.id)
    return NextResponse.json({ strategies })
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const strategy = await saveStrategyWorkspaceSession(session.user.id, {
            strategyId: body.strategyId ?? null,
            name: body.name,
            description: body.description ?? null,
            symbol: body.symbol ?? 'AAPL',
            timeframe: body.timeframe ?? '1d',
            source: body.source ?? '',
            language: body.language ?? 'pine-v6',
            engineMode: body.engineMode ?? 'pinets',
            linkedFixtureId: body.linkedFixtureId ?? null,
            runSettings: (body.runSettings ?? null) as StrategyRunSettings | null,
            favorite: body.favorite ?? false,
            pinned: body.pinned ?? false,
            tags: Array.isArray(body.tags) ? body.tags : null,
            createInitialVersion: body.createInitialVersion ?? true,
        })

        return NextResponse.json({ strategy })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save strategy workspace.' },
            { status: 400 }
        )
    }
}
