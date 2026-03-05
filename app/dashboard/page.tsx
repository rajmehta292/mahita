'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { StrategyAST, BacktestResult } from '../services/trading-engine/types'
import { MarketDataPoint } from '../services/market-data/types'

// Dynamic import for Chart because lightweight-charts uses browser/window APIs
const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

export default function Dashboard() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [results, setResults] = useState<BacktestResult | null>(null)

    // Dummy Strategy for MVP 
    // In a full build, this comes from the StrategyBuilder component
    const defaultStrategy: StrategyAST = {
        id: "test-1",
        name: "RSI Oversold Bounce",
        asset: "AAPL",
        timeframe: "1d",
        riskManagement: { positionSizingPercent: 100 },
        entryConditions: {
            logic: 'AND',
            rules: [
                { indicator: 'RSI', parameter: 14, operator: '<', value: 30 }
            ]
        },
        exitConditions: {
            logic: 'OR',
            rules: [
                { indicator: 'RSI', parameter: 14, operator: '>', value: 60 }
            ]
        }
    }

    const runBacktest = async () => {
        setLoading(true)
        try {
            // Create arbitrary historical window
            const now = Math.floor(Date.now() / 1000)
            const oneYearAgo = now - (365 * 24 * 60 * 60)

            const res = await fetch('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: defaultStrategy,
                    startTime: oneYearAgo,
                    endTime: now,
                    initialCapital: 100000
                })
            })

            const json = await res.json()
            if (res.ok) {
                setResults(json)

                // In a real app, the backend would also return the marketdata array it generated
                // For right now, let's fetch it from a separate generic endpoint
                // To save time, we'll just mock it on frontend too for chart display wrapper
                const dummyChartData = generateDummyChartData(oneYearAgo, now)
                setData(dummyChartData)
            } else {
                alert("Error: " + json.error)
            }

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    // Temporary function to display pretty chart data in the MVP layout
    const generateDummyChartData = (start: number, end: number) => {
        let p = 150; const arr = []
        for (let t = start; t <= end; t += 86400) {
            p = p + (Math.random() - 0.5) * 5;
            arr.push({ time: t, open: p, high: p + 2, low: p - 2, close: p + (Math.random() - 0.5), volume: 1000 })
        }
        return arr
    }

    return (
        <div className="p-6 h-screen flex flex-col gap-6">

            <header className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <img src="/vectorized.svg" alt="Mahita" className="w-8 h-8 invert opacity-80" />
                    <h1 className="text-2xl font-bold tracking-wider text-accent">MAHITA <span className="text-white">TERMINAL</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm px-3 py-1 bg-white/5 rounded-full border border-white/10">Connected to Mock Broker</div>
                </div>
            </header>

            <div className="flex gap-6 h-full min-h-0">
                {/* Left Sidebar - Strategy Settings */}
                <div className="w-1/4 glass-panel p-5 flex flex-col gap-4 overflow-y-auto">
                    <h2 className="text-lg font-semibold text-white">Strategy Configuration</h2>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Asset</label>
                        <input type="text" value={defaultStrategy.asset} readOnly className="glass-panel px-3 py-2 text-white bg-black/20" />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs text-gray-400 uppercase tracking-wider">Timeframe</label>
                        <input type="text" value={defaultStrategy.timeframe} readOnly className="glass-panel px-3 py-2 text-white bg-black/20" />
                    </div>

                    <div className="border-t border-white/10 my-2"></div>

                    <button
                        onClick={runBacktest}
                        disabled={loading}
                        className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded shadow-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                        {loading ? 'Running Engine...' : 'Run Backtest'}
                    </button>

                    {/* Metrics Panel */}
                    {results && (
                        <div className="mt-4 flex flex-col gap-4">
                            <div className="p-4 bg-black/30 rounded border border-white/5 flex flex-col items-center">
                                <span className="text-xs text-gray-400 uppercase">Net Profit</span>
                                <span className={`text-2xl font-bold ${results.metrics.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
                                    ${results.metrics.netProfit.toFixed(2)}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="p-3 bg-black/30 rounded text-center">
                                    <div className="text-[10px] text-gray-400 uppercase">Win Rate</div>
                                    <div className="text-lg font-bold">{results.metrics.winRate.toFixed(1)}%</div>
                                </div>
                                <div className="p-3 bg-black/30 rounded text-center">
                                    <div className="text-[10px] text-gray-400 uppercase">Max DD</div>
                                    <div className="text-lg font-bold text-danger">{results.metrics.maxDrawdown.toFixed(2)}%</div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Chart Area */}
                <div className="w-3/4 flex flex-col gap-6">
                    <div className="glass-panel p-1 flex-1 min-h-0 overflow-hidden relative">
                        {data.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                Run backtest to visualize historical execution
                            </div>
                        ) : (
                            <Chart data={data} trades={results?.trades} />
                        )}
                    </div>

                    {/* Trades Grid View */}
                    <div className="glass-panel h-1/3 p-4 flex flex-col gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Execution Log</h3>
                        <div className="flex-1 overflow-y-auto w-full">
                            {results?.trades.length === 0 && <div className="text-gray-500 text-sm">No trades generated.</div>}
                            {results?.trades && results.trades.length > 0 && (
                                <table className="w-full text-left text-sm text-gray-300">
                                    <thead className="bg-white/5 border-b border-white/10">
                                        <tr>
                                            <th className="p-2">Side</th>
                                            <th className="p-2">Entry Price</th>
                                            <th className="p-2">Exit Price</th>
                                            <th className="p-2">Quantity</th>
                                            <th className="p-2">PnL</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.trades.map((t, i) => (
                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                <td className={`p-2 font-bold ${t.side === 'Long' ? 'text-success' : 'text-danger'}`}>{t.side}</td>
                                                <td className="p-2">${t.entryPrice.toFixed(2)}</td>
                                                <td className="p-2">{t.exitPrice ? `$${t.exitPrice.toFixed(2)}` : 'Open'}</td>
                                                <td className="p-2">{t.quantity.toFixed(2)}</td>
                                                <td className={`p-2 font-bold ${t.pnl >= 0 ? 'text-success' : 'text-danger'}`}>{t.pnl.toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
