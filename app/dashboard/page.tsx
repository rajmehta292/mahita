'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { StrategyAST, BacktestResult } from '../services/trading-engine/types'
import { MarketDataPoint } from '../services/market-data/types'
import StrategyTester from '../components/StrategyTester'
import { LayoutGrid, TrendingUp, History, Activity, Settings, Sliders, Play, Plus, Trash2, ShieldCheck, Target } from 'lucide-react'

// Dynamic imports for Chart and Editor
const Chart = dynamic(() => import('../components/Chart'), { ssr: false })
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function Dashboard() {
    const { data: session, status } = useSession()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [results, setResults] = useState<BacktestResult | null>(null)
    const [inventory, setInventory] = useState<any[]>([])
    const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
    const [selectedTimeframe, setSelectedTimeframe] = useState("1d")
    const [chartType, setChartType] = useState<'Standard' | 'HeikinAshi'>('Standard')
    const [activeIndicators, setActiveIndicators] = useState<string[]>(['Volume', 'MACD'])

    // Strategy Parameters
    const [stopLoss, setStopLoss] = useState(2.0)
    const [takeProfit, setTakeProfit] = useState(5.0)
    const [script, setScript] = useState(`// Professional Scalping Strategy
// @version=1

const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)
const rsi = ta.rsi(14)

// Entry Conditions
if (ema_fast > ema_slow && rsi < 70) {
    strategy.entry("Long", "long")
}

// Exit Logic
if (ema_fast < ema_slow || rsi > 70) {
    strategy.entry("Short", "short")
}
`)

    const safeFetchJson = useCallback(async (url: string, options?: RequestInit) => {
        try {
            const res = await fetch(url, options)

            // Handle redirects (NextAuth middleware often redirects to signin)
            if (res.redirected) {
                window.location.href = res.url
                return null
            }

            if (!res.ok) {
                const text = await res.text()
                // Check if it's HTML (likely a 404 or error page)
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    throw new Error(`Server returned HTML instead of JSON (Status ${res.status}).`)
                }
                const errorData = JSON.parse(text)
                throw new Error(errorData.error || `Request failed with status ${res.status}`)
            }

            const contentType = res.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return a JSON response.')
            }

            return await res.json()
        } catch (error: any) {
            console.error(`[API Error] ${url}:`, error)
            alert(`API Error: ${error.message}`)
            return null
        }
    }, [])

    // Fetch Inventory and initial Market Data
    useEffect(() => {
        if (status !== 'authenticated') return

        const fetchInventory = async () => {
            const json = await safeFetchJson('/api/trading/inventory')
            if (json) setInventory(json)
        }
        fetchInventory()
    }, [status, safeFetchJson])

    useEffect(() => {
        if (status !== 'authenticated' || !selectedSymbol) return

        const fetchMarketData = async () => {
            const json = await safeFetchJson(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)
            if (json) setData(json)
        }
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe, status, safeFetchJson])

    // Dummy Strategy for MVP 
    // In a full build, this comes from the StrategyBuilder component
    const defaultStrategy: StrategyAST = {
        id: "test-1",
        name: "RSI Oversold Bounce",
        asset: selectedSymbol,
        timeframe: selectedTimeframe,
        riskManagement: {
            positionSizingPercent: 100,
            stopLossPercent: stopLoss,
            takeProfitPercent: takeProfit
        },
        entryConditions: {
            logic: 'AND',
            rules: [
                { indicator: 'RSI', parameter: 14, operator: 'crosses_below', value: 30 }
            ]
        },
        exitConditions: {
            logic: 'AND',
            rules: [
                { indicator: 'RSI', parameter: 14, operator: 'crosses_above', value: 70 }
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

            const json = await safeFetchJson('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: {
                        id: "script-1",
                        name: "Custom Script Strategy",
                        asset: selectedSymbol,
                        timeframe: selectedTimeframe,
                        script: script,
                        riskManagement: {
                            positionSizingPercent: 100,
                            stopLossPercent: stopLoss,
                            takeProfitPercent: takeProfit
                        }
                    },
                    startTime,
                    endTime,
                    initialCapital: 100000
                })
            })

            if (json) {
                setResults(json)
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

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center p-6">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-white/40 text-sm font-medium animate-pulse uppercase tracking-widest">Warming Engine...</p>
                </div>
            </div>
        )
    }

    if (status === 'unauthenticated') {
        return (
            <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center p-6 text-center">
                <div className="glass-panel p-12 max-w-sm">
                    <History className="w-12 h-12 text-white/10 mx-auto mb-6" />
                    <h2 className="text-2xl font-bold text-white mb-4">Session Required</h2>
                    <p className="text-white/40 text-sm mb-8">Your session has expired or you are not authorized to view this terminal.</p>
                    <button
                        onClick={() => signIn()}
                        className="w-full py-4 bg-white text-black font-bold rounded-xl hover:bg-white/90 transition-all"
                    >
                        Sign In to Mahita
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0d0e12] text-white p-4 md:p-6 flex flex-col gap-6">

            <header className="flex justify-between items-center pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <img src="/vectorized.svg" alt="Mahita" className="w-8 h-8 invert opacity-80" />
                    <h1 className="text-2xl font-bold tracking-wider text-accent">MAHITA <span className="text-white">TERMINAL</span></h1>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-sm px-3 py-1 bg-white/5 rounded-full border border-white/10">Connected to Mock Broker</div>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-0">
                <div className="lg:col-span-1 flex flex-col gap-6 overflow-visible lg:overflow-hidden">
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

                    <div className="glass-panel p-0 flex flex-col flex-1 overflow-hidden min-h-[500px]">
                        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                            <h2 className="text-lg font-semibold text-white">Pine Editor</h2>
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">v1.0</span>
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <Editor
                                height="100%"
                                defaultLanguage="javascript"
                                theme="vs-dark"
                                value={script}
                                onChange={(value) => setScript(value || '')}
                                options={{
                                    minimap: { enabled: false },
                                    fontSize: 12,
                                    lineNumbers: 'on',
                                    roundedSelection: false,
                                    scrollBeyondLastLine: false,
                                    readOnly: false,
                                    automaticLayout: true,
                                    padding: { top: 20 }
                                }}
                            />
                        </div>

                        <div className="p-5 bg-black/40 border-t border-white/5">
                            <div className="grid grid-cols-2 gap-4 mb-6">
                                <div>
                                    <label className="text-[10px] text-white/40 uppercase mb-1.5 block">Stop Loss %</label>
                                    <input
                                        type="number"
                                        value={stopLoss}
                                        onChange={(e) => setStopLoss(parseFloat(e.target.value))}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] text-white/40 uppercase mb-1.5 block">Take Profit %</label>
                                    <input
                                        type="number"
                                        value={takeProfit}
                                        onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
                                        className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-colors"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={runBacktest}
                                disabled={loading || data.length === 0}
                                className={`w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase transition-all duration-300 flex items-center justify-center space-x-2 ${loading || data.length === 0
                                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-500/20'
                                    }`}
                            >
                                <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                <span>{loading ? 'Running Engine...' : 'Add to Chart'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="lg:col-span-3 flex flex-col gap-6">
                    <div className="glass-panel p-1 min-h-[400px] lg:min-h-[600px] flex-grow overflow-hidden relative">
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

                    {/* Professional Strategy Tester Area */}
                    <div className="w-full">
                        <StrategyTester results={results} />
                        {!results && !loading && (
                            <div className="mt-8 p-12 glass-panel border-dashed border-white/10 flex flex-col items-center justify-center text-center">
                                <Activity className="w-12 h-12 text-white/10 mb-4" />
                                <h3 className="text-lg font-medium text-white/40">No Simulation Data</h3>
                                <p className="text-sm text-white/20 max-w-xs mt-2">
                                    Configure your strategy and execute a backtest to view performance metrics and equity curves.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
