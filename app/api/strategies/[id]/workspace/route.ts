import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getStrategyById, saveStrategyWorkspaceSession } from '@/lib/strategy-library'
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const strategy = await getStrategyById(session.user.id, id)

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found.' }, { status: 404 })
    }

    return NextResponse.json({
        workspaceSession: strategy.workspaceSession,
        latestVersionId: strategy.latestVersionId,
    })
}

export async function PATCH(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { id } = await context.params
        const strategy = await saveStrategyWorkspaceSession(session.user.id, {
            strategyId: id,
            name: body.name,
            description: body.description ?? null,
            symbol: body.symbol ?? 'AAPL',
            timeframe: body.timeframe ?? '1d',
            source: body.source ?? '',
            language: body.language ?? 'pine-v6',
            engineMode: body.engineMode ?? 'pinets',
            linkedFixtureId: body.linkedFixtureId ?? null,
            runSettings: (body.runSettings ?? null) as StrategyRunSettings | null,
            favorite: body.favorite,
            pinned: body.pinned,
            tags: Array.isArray(body.tags) ? body.tags : undefined,
            createInitialVersion: true,
        })

        return NextResponse.json({ strategy })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to autosave strategy workspace.' },
            { status: 400 }
        )
    }
}
