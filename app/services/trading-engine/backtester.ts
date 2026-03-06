import { MarketDataStore } from '../market-data/store'
import { Timeframe } from '../market-data/types'
import { StrategyEvaluator } from './evaluator'
import { PaperBrokerProvider } from './paper-broker'
import { BacktestResult, StrategyAST, EquityPoint } from './types'
import { ScriptCompiler, ScriptContext } from './script-engine'

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
        let scriptFn: Function | null = null
        let scriptIndicators: Record<string, number[]> = {}

        if (strategy.script) {
            scriptFn = ScriptCompiler.compile(strategy.script)
            scriptIndicators = ScriptCompiler.prepareIndicators(history, strategy.script)
        }

        const evaluator = !strategy.script ? new StrategyEvaluator(strategy) : null
        const broker = new PaperBrokerProvider(initialCapital)
        const equityCurve: EquityPoint[] = []

        // 3. Heartbeat loop (Pine Script style execution)
        history.forEach((bar, i) => {
            const isWarmup = (bar.time as number) < startTime
            let signal: 'Buy' | 'Sell' | 'Hold' = 'Hold'

            if (strategy.script && scriptFn) {
                // Execute Script
                const context: ScriptContext = {
                    index: i,
                    data: history,
                    indicators: scriptIndicators,
                    vars: {}, // Needs to be persistent across calls for 'var' keyword emulation
                    strategy: {
                        entry: (id, dir) => { signal = dir === 'long' ? 'Buy' : 'Sell' },
                        close: (id) => { signal = 'Hold' } // Simplification: strategy.close sends Hold which triggers exit check
                    }
                }
                try {
                    scriptFn(context)
                } catch (e) {
                    if (!isWarmup) console.error("Script Runtime Error at bar", i, e)
                }
            } else if (evaluator) {
                // Legacy AST Evaluation
                signal = evaluator.evaluate(bar, isWarmup)
            }

            // Route to broker if NOT in warmup
            if (!isWarmup) {
                broker.processSignal(signal, bar, strategy.riskManagement)
                equityCurve.push({
                    time: bar.time as number,
                    value: broker.tradeHistory.reduce((sum, t) => sum + t.pnl, initialCapital)
                })
            }
        })

        // Default close at end of testing period if a position is open
        if (broker.tradeHistory.length > 0 && history.length > 0) {
            const lastBar = history[history.length - 1]
            broker.processSignal('Hold', lastBar, strategy.riskManagement) // Trigger checkExits/final cleanup
        }

        return this.compileStatistics(broker, initialCapital, equityCurve, history.filter(b => (b.time as number) >= startTime))
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

    private compileStatistics(
        broker: PaperBrokerProvider,
        initial: number,
        equityCurve: EquityPoint[],
        data: any[]
    ): BacktestResult {
        const trades = broker.tradeHistory
        const netProfit = trades.reduce((sum, t) => sum + t.pnl, 0)
        const winRate = trades.length > 0 ? (trades.filter(t => t.pnl > 0).length / trades.length) * 100 : 0

        // Calculate Max Drawdown
        let peak = initial
        let maxDD = 0
        if (equityCurve.length > 0) {
            equityCurve.forEach(p => {
                if (p.value > peak) peak = p.value
                const dd = peak === 0 ? 0 : (peak - p.value) / peak * 100
                if (dd > maxDD) maxDD = dd
            })
        }

        // Benchmark (Buy & Hold)
        let benchmarkReturn = 0
        if (data.length > 0) {
            const startPrice = data[0].close
            const endPrice = data[data.length - 1].close
            benchmarkReturn = startPrice === 0 ? 0 : ((endPrice - startPrice) / startPrice) * 100
        }

        // Simple Sharpe (assuming 0 risk free rate for MVP)
        const returns = trades.map(t => t.pnlPercent)
        let sharpeRatio = 0
        if (returns.length > 1) {
            const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
            const stdDev = Math.sqrt(returns.map(r => Math.pow(r - avgReturn, 2)).reduce((a, b) => a + b, 0) / returns.length)
            sharpeRatio = stdDev === 0 ? 0 : (avgReturn / stdDev)
        }

        return {
            trades,
            equityCurve,
            metrics: {
                netProfit,
                netProfitPercent: (netProfit / initial) * 100,
                winRate,
                totalTrades: trades.length,
                maxDrawdown: maxDD,
                profitFactor: trades.length > 0 ? 1.5 : 0, // Placeholder
                sharpeRatio,
                benchmarkReturnPercent: benchmarkReturn
            }
        }
    }
}
