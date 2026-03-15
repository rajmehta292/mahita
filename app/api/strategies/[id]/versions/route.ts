import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createStrategyVersion, getStrategyById } from '@/lib/strategy-library'
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
        versions: strategy.versions,
        latestVersionId: strategy.latestVersionId,
    })
}

export async function POST(request: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const { id } = await context.params
        const strategy = await createStrategyVersion(session.user.id, {
            strategyId: id,
            label: body.label ?? null,
            description: body.description ?? null,
            source: body.source,
            symbol: body.symbol,
            timeframe: body.timeframe,
            language: body.language,
            engineMode: body.engineMode,
            linkedFixtureId: body.linkedFixtureId ?? null,
            runSettings: (body.runSettings ?? null) as StrategyRunSettings | null,
            diagnostics: body.diagnostics ?? null,
            updateWorkspace: body.updateWorkspace ?? true,
        })

        return NextResponse.json({ strategy })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save immutable strategy version.' },
            { status: 400 }
        )
    }
}
