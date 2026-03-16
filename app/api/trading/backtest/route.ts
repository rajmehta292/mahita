import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BacktestEngine } from '@/app/services/trading-engine/backtester'
import { marketDataStore } from '@/app/services/market-data/store'
import { BacktestDataSource, EngineComparisonMode, StrategyAST, StrategyRunSettings } from '@/app/services/trading-engine/types'
import { getParityFixture } from '@/lib/parity-fixtures'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { strategy, startTime, endTime, initialCapital, fixtureId, snapshotFixtureId, runSettings, strictParity, comparisonMode, providerOverride, marketDataSource, comparisonReferenceId } = body as {
            strategy: StrategyAST,
            startTime: number,
            endTime: number,
            initialCapital?: number
            fixtureId?: string
            snapshotFixtureId?: string
            runSettings?: Partial<StrategyRunSettings>
            strictParity?: boolean
            comparisonMode?: EngineComparisonMode
            providerOverride?: string
            marketDataSource?: BacktestDataSource
            comparisonReferenceId?: string | null
        }

        if (!strategy || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
        }

        const engine = new BacktestEngine(marketDataStore)
        const resolvedFixtureId = snapshotFixtureId || fixtureId
        const fixture = resolvedFixtureId && session.user?.id
            ? await getParityFixture(session.user.id, resolvedFixtureId)
            : null

        const results = await engine.run(
            strategy,
            startTime,
            endTime,
            initialCapital,
            fixture
                ? {
                    fixture: {
                        id: fixture.id,
                        name: fixture.name,
                        symbol: fixture.symbol,
                        timeframe: fixture.timeframe,
                        manifest: fixture.manifest,
                        candles: fixture.candles,
                        trades: fixture.trades,
                    },
                    runSettings,
                    strictParity: Boolean(strictParity),
                    comparisonMode,
                    providerOverride,
                    marketDataSource,
                    comparisonReferenceId,
                }
                : {
                    runSettings,
                    strictParity: Boolean(strictParity),
                    comparisonMode,
                    providerOverride,
                    marketDataSource,
                    comparisonReferenceId,
                }
        )

        if (strictParity && fixture && !results.parityComparison?.exactMatch) {
            return NextResponse.json(
                {
                    error: 'Strict parity failed for the selected TradingView fixture.',
                    results,
                },
                { status: 409 }
            )
        }

        return NextResponse.json(results)
    } catch (error) {
        console.error('Backtest error:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Internal Server Error',
        }, { status: 500 })
    }
}
