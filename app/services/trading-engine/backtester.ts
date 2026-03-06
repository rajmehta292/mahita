import { MarketDataStore } from '../market-data/store'
import { Timeframe } from '../market-data/types'
import { StrategyEvaluator } from './evaluator'
import { PaperBrokerProvider } from './paper-broker'
import { StrategyAST, BacktestResult } from './types'

export class BacktestEngine {
    private dataStore: MarketDataStore

    constructor(dataStore: MarketDataStore) {
        this.dataStore = dataStore
    }

    public async run(
        strategy: StrategyAST,
        startTime: number,
        endTime: number,
        initialCapital: number = 10000
    ): Promise<BacktestResult> {

        // 1. Fetch historical data with warmup buffer (200 bars)
        // Approximate 200 bars in seconds based on timeframe
        const bufferSeconds = this.getBufferSeconds(strategy.timeframe, 200)
        const history = await this.dataStore.getHistoricalData(
            strategy.asset,
            strategy.timeframe as Timeframe,
            startTime - bufferSeconds,
            endTime
        )

        if (history.length === 0) {
            throw new Error(`No data found for ${strategy.asset} in the given range.`)
        }

        // 2. Initialize components
        const evaluator = new StrategyEvaluator(strategy)
        const broker = new PaperBrokerProvider(initialCapital)

        // 3. Heartbeat loop (Pine Script style execution)
        for (const bar of history) {
            const isWarmup = (bar.time as number) < startTime

            // Evaluate conditions
            const signal = evaluator.evaluate(bar, isWarmup)

            // Route to broker if NOT in warmup
            if (!isWarmup) {
                broker.processSignal(signal, bar, strategy.riskManagement.positionSizingPercent)
            }
        }

        // Default close at end of testing period if a position is open
        // (A realistic engine would force-close or use last price)
        broker.processSignal('Sell', history[history.length - 1], 100)
        // Buy back short if it was open
        broker.processSignal('Buy', history[history.length - 1], 100)

        return this.compileStatistics(broker, initialCapital)
    }

    private getBufferSeconds(timeframe: string, bars: number): number {
        const tfSeconds: Record<string, number> = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400,
            '1w': 604800
        }
        return (tfSeconds[timeframe] || 86400) * bars
    }

    private compileStatistics(broker: PaperBrokerProvider, initial: number): BacktestResult {
        const trades = broker.tradeHistory

        let netProfit = 0
        let winningTrades = 0
        let maxDrawdown = 0
        let peakEquity = initial
        let currentEquity = initial

        let grossProfit = 0
        let grossLoss = 0

        for (const trade of trades) {
            netProfit += trade.pnl
            currentEquity += trade.pnl

            if (trade.pnl > 0) {
                winningTrades++
                grossProfit += trade.pnl
            } else {
                grossLoss += Math.abs(trade.pnl)
            }

            if (currentEquity > peakEquity) {
                peakEquity = currentEquity
            }

            const drawdown = (peakEquity - currentEquity) / peakEquity
            if (drawdown > maxDrawdown) {
                maxDrawdown = drawdown
            }
        }

        const winRate = trades.length > 0 ? (winningTrades / trades.length) * 100 : 0
        const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 999 : 0) : grossProfit / grossLoss

        return {
            trades,
            metrics: {
                netProfit,
                winRate,
                totalTrades: trades.length,
                maxDrawdown: maxDrawdown * 100, // percentage
                profitFactor
            }
        }
    }
}
