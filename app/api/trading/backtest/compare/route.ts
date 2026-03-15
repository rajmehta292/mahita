import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { compareCompletedTradesToFixture } from '@/app/services/trading-engine/parity'
import { getParityFixture } from '@/lib/parity-fixtures'
import type { CompletedTrade, StrategyRuntimeSnapshot } from '@/app/services/trading-engine/types'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const fixtureId = typeof body.fixtureId === 'string' ? body.fixtureId : ''
        const trades = Array.isArray(body.trades) ? (body.trades as CompletedTrade[]) : []
        const runtimeSnapshots = Array.isArray(body.runtimeSnapshots) ? (body.runtimeSnapshots as StrategyRuntimeSnapshot[]) : []
        const strictParity = Boolean(body.strictParity)

        if (!fixtureId) {
            return NextResponse.json({ error: 'Fixture id is required.' }, { status: 400 })
        }

        const fixture = await getParityFixture(session.user.id, fixtureId)
        if (!fixture) {
            return NextResponse.json({ error: 'Fixture not found.' }, { status: 404 })
        }

        const comparison = compareCompletedTradesToFixture(trades, fixture.trades, fixture.id, undefined, runtimeSnapshots)

        return NextResponse.json(
            { comparison },
            strictParity && !comparison.exactMatch
                ? { status: 409 }
                : undefined
        )
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to compare backtest results.' },
            { status: 400 }
        )
    }
}
