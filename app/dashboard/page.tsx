'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { StrategyAST, BacktestResult } from '../services/trading-engine/types'
import { MarketDataPoint } from '../services/market-data/types'

// Dynamic import for Chart because lightweight-charts uses browser/window APIs
const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

export default function Dashboard() {
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [results, setResults] = useState<BacktestResult | null>(null)
    const [inventory, setInventory] = useState<any[]>([])
    const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
    const [selectedTimeframe, setSelectedTimeframe] = useState("1d")
    const [chartType, setChartType] = useState<'Standard' | 'HeikinAshi'>('Standard')
    const [activeIndicators, setActiveIndicators] = useState<string[]>(['Volume', 'MACD'])

    // Fetch Inventory and initial Market Data
    useEffect(() => {
        const fetchInventory = async () => {
            const res = await fetch('/api/trading/inventory')
            if (res.ok) {
                const json = await res.json()
                setInventory(json)
            }
        }
        fetchInventory()
    }, [])

    useEffect(() => {
        const fetchMarketData = async () => {
            if (!selectedSymbol) return
            const res = await fetch(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)
            if (res.ok) {
                const json = await res.json()
                setData(json)
            }
        }
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe])

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
            if (data.length === 0) {
                alert("No data available for this symbol/timeframe. Please run the sync script.")
                return
            }

            const startTime = data[0].time as number
            const endTime = data[data.length - 1].time as number

            const res = await fetch('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: {
                        ...defaultStrategy,
                        asset: selectedSymbol,
                        timeframe: selectedTimeframe
                    },
                    startTime,
                    endTime,
                    initialCapital: 100000
                })
            })

            const json = await res.json()
            if (res.ok) {
                setResults(json)
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
                <div className="w-1/4 flex flex-col gap-6 overflow-hidden">
                    <div className="glass-panel p-5 flex flex-col gap-4">
                        <h2 className="text-lg font-semibold text-white">Market Data</h2>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Asset</label>
                            <select
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                className="glass-panel px-3 py-2 text-white bg-black/40 border border-white/10 outline-none focus:border-primary transition-colors"
                            >
                                {inventory.length === 0 && <option value="">Loading symbols...</option>}
                                {inventory.map((item) => (
                                    <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
                                ))}
                            </select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Timeframe</label>
                            <div className="flex gap-2">
                                {['1d', '1w', '1m'].map((tf) => (
                                    <button
                                        key={tf}
                                        onClick={() => setSelectedTimeframe(tf)}
                                        className={`flex-1 py-1 rounded text-xs font-bold border transition-all ${selectedTimeframe === tf
                                            ? 'bg-primary border-primary text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        {tf.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Chart View</label>
                            <div className="flex gap-2">
                                {['Standard', 'HeikinAshi'].map((type) => (
                                    <button
                                        key={type}
                                        onClick={() => setChartType(type as any)}
                                        className={`flex-1 py-1 rounded text-[10px] font-bold border transition-all ${chartType === type
                                            ? 'bg-accent border-accent text-white'
                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            }`}
                                    >
                                        {type === 'Standard' ? 'CANDLES' : 'HEIKIN ASHI'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/5 pt-4">
                            <label className="text-xs text-gray-400 uppercase tracking-wider">Indicators</label>
                            <div className="flex flex-wrap gap-2">
                                {['Volume', 'MACD'].map((ind) => (
                                    <button
                                        key={ind}
                                        onClick={() => setActiveIndicators(prev =>
                                            prev.includes(ind) ? prev.filter(i => i !== ind) : [...prev, ind]
                                        )}
                                        className={`px-3 py-1 rounded text-[10px] font-bold border transition-all ${activeIndicators.includes(ind)
                                            ? 'bg-success/20 border-success text-success'
                                            : 'bg-white/5 border-white/10 text-gray-400'
                                            }`}
                                    >
                                        {ind}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="glass-panel p-5 flex flex-col gap-4 flex-1 overflow-hidden">
                        <h2 className="text-lg font-semibold text-white">Strategy Engine</h2>

                        <div className="flex flex-col gap-1 text-sm bg-black/20 p-3 rounded border border-white/5">
                            <div className="flex justify-between">
                                <span className="text-gray-400">Name:</span>
                                <span className="text-white">{defaultStrategy.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Rules:</span>
                                <span className="text-white">RSI(14) &lt; 30</span>
                            </div>
                        </div>

                        <button
                            onClick={runBacktest}
                            disabled={loading || data.length === 0}
                            className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-bold rounded shadow-lg transition-colors cursor-pointer disabled:opacity-30 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    Running...
                                </>
                            ) : 'Run Backtest'}
                        </button>
                    </div>

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
                    <div className="glass-panel p-1 min-h-[700px] overflow-hidden relative">
                        {data.length === 0 ? (
                            <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                                Run backtest to visualize historical execution
                            </div>
                        ) : (
                            <Chart
                                data={data}
                                trades={results?.trades}
                                chartType={chartType}
                                indicators={activeIndicators}
                            />
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
