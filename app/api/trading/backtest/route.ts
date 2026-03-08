import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BacktestEngine } from '@/app/services/trading-engine/backtester'
import { marketDataStore } from '@/app/services/market-data/store'
import { StrategyAST } from '@/app/services/trading-engine/types'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json()
        const { strategy, startTime, endTime, initialCapital } = body as {
            strategy: StrategyAST,
            startTime: number,
            endTime: number,
            initialCapital?: number
        }

        if (!strategy || !startTime || !endTime) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
        }

        const engine = new BacktestEngine(marketDataStore)

        // Run the backtest using our local chronological loop
        const results = await engine.run(strategy, startTime, endTime, initialCapital)

        return NextResponse.json(results)
    } catch (error: any) {
        console.error('Backtest error:', error)
        return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 })
    }
}
