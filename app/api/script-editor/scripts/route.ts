import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDefaultPineTemplate, listScriptDrafts, saveScriptDraft } from '@/lib/script-drafts'
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const drafts = await listScriptDrafts(session.user.id)

    return NextResponse.json({
        drafts,
        defaultTemplate: getDefaultPineTemplate(),
    })
}

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const draft = await saveScriptDraft(session.user.id, {
            id: body.id,
            name: body.name,
            description: body.description ?? null,
            symbol: body.symbol ?? 'AAPL',
            timeframe: body.timeframe ?? '1d',
            source: body.source ?? '',
            engineMode: body.engineMode ?? 'pinets',
            lastParityStatus: body.lastParityStatus ?? null,
            linkedFixtureId: body.linkedFixtureId ?? null,
            runSettings: (body.runSettings ?? null) as StrategyRunSettings | null,
        })

        return NextResponse.json({ draft })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to save script.' },
            { status: 400 }
        )
    }
}
