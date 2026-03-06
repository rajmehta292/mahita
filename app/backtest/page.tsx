'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { StrategyAST, BacktestResult } from '../services/trading-engine/types'
import { MarketDataPoint } from '../services/market-data/types'
import StrategyTester from '../components/StrategyTester'
import { MainLayout } from '../components/Layout/MainLayout'
import { Play, Settings, Calendar, DollarSign, TrendingUp, Activity } from 'lucide-react'

const Chart = dynamic(() => import('../components/Chart'), { ssr: false })
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false })

export default function BacktestPage() {
    const { data: session, status } = useSession()
    const [loading, setLoading] = useState(false)
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [results, setResults] = useState<BacktestResult | null>(null)
    const [inventory, setInventory] = useState<any[]>([])
    const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
    const [selectedTimeframe, setSelectedTimeframe] = useState("1d")
    const [chartType, setChartType] = useState<'Standard' | 'HeikinAshi'>('Standard')
    const [activeIndicators, setActiveIndicators] = useState<string[]>(['Volume', 'MACD'])
    const [stopLoss, setStopLoss] = useState(2.0)
    const [takeProfit, setTakeProfit] = useState(5.0)
    const [initialCapital, setInitialCapital] = useState(10000)
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
            if (res.redirected) {
                window.location.href = res.url
                return null
            }
            if (!res.ok) {
                const text = await res.text()
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

    const runBacktest = async () => {
        if (!data || data.length === 0) {
            alert('No market data available')
            return
        }
        setLoading(true)
        try {
            const strategy: StrategyAST = {
                id: 'backtest-' + Date.now(),
                name: 'Custom Strategy',
                asset: selectedSymbol,
                timeframe: selectedTimeframe,
                script: script,
                riskManagement: { 
                    stopLossPercent: stopLoss, 
                    takeProfitPercent: takeProfit, 
                    positionSizingPercent: 100 
                }
            }
            const startTime = data[0].time
            const endTime = data[data.length - 1].time
            const json = await safeFetchJson('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ strategy, startTime, endTime, initialCapital })
            })
            if (json) setResults(json)
        } catch (error: any) {
            console.error('Backtest error:', error)
            alert(`Backtest failed: ${error.message}`)
        } finally {
            setLoading(false)
        }
    }

    if (status === 'loading') {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white">Loading...</div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex items-center justify-center h-full">
                    <button
                        onClick={() => signIn('google')}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        Sign in with Google
                    </button>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <div className="flex h-full bg-[#131722]">
                {/* Left Panel - Strategy Configuration */}
                <div className="w-96 bg-[#1E222D] border-r border-[#2A2E39] flex flex-col overflow-hidden">
                    <div className="h-14 flex items-center justify-between px-6 border-b border-[#2A2E39]">
                        <h2 className="text-white font-semibold">Strategy Builder</h2>
                        <button className="p-2 hover:bg-[#2A2E39] rounded transition-colors">
                            <Settings className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-6 space-y-6">
                        {/* Market Selection */}
                        <div className="space-y-3">
                            <h3 className="text-white text-sm font-medium flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-blue-500" />
                                Market Selection
                            </h3>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Symbol</label>
                                <select
                                    value={selectedSymbol}
                                    onChange={(e) => setSelectedSymbol(e.target.value)}
                                    className="w-full bg-[#131722] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-[#2A2E39]"
                                >
                                    {inventory.map((item: any) => (
                                        <option key={item.symbol} value={item.symbol}>{item.symbol}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Timeframe</label>
                                <select
                                    value={selectedTimeframe}
                                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                                    className="w-full bg-[#131722] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-[#2A2E39]"
                                >
                                    <option value="1m">1 Minute</option>
                                    <option value="5m">5 Minutes</option>
                                    <option value="15m">15 Minutes</option>
                                    <option value="1h">1 Hour</option>
                                    <option value="4h">4 Hours</option>
                                    <option value="1d">1 Day</option>
                                </select>
                            </div>
                        </div>

                        {/* Capital Settings */}
                        <div className="space-y-3">
                            <h3 className="text-white text-sm font-medium flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-500" />
                                Capital Settings
                            </h3>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Initial Capital ($)</label>
                                <input
                                    type="number"
                                    value={initialCapital}
                                    onChange={(e) => setInitialCapital(parseFloat(e.target.value))}
                                    className="w-full bg-[#131722] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-[#2A2E39]"
                                    step="1000"
                                />
                            </div>
                        </div>

                        {/* Risk Management */}
                        <div className="space-y-3">
                            <h3 className="text-white text-sm font-medium flex items-center gap-2">
                                <Activity className="w-4 h-4 text-yellow-500" />
                                Risk Management
                            </h3>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Stop Loss (%)</label>
                                <input
                                    type="number"
                                    value={stopLoss}
                                    onChange={(e) => setStopLoss(parseFloat(e.target.value))}
                                    className="w-full bg-[#131722] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-[#2A2E39]"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="text-xs text-gray-400 mb-1.5 block">Take Profit (%)</label>
                                <input
                                    type="number"
                                    value={takeProfit}
                                    onChange={(e) => setTakeProfit(parseFloat(e.target.value))}
                                    className="w-full bg-[#131722] text-white px-3 py-2.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 border border-[#2A2E39]"
                                    step="0.1"
                                />
                            </div>
                        </div>

                        {/* Pine Script Editor */}
                        <div className="space-y-3">
                            <h3 className="text-white text-sm font-medium">Pine Script Strategy</h3>
                            <div className="h-80 border border-[#2A2E39] rounded overflow-hidden">
                                <Editor
                                    height="100%"
                                    defaultLanguage="javascript"
                                    theme="vs-dark"
                                    value={script}
                                    onChange={(value: string | undefined) => setScript(value || '')}
                                    options={{
                                        minimap: { enabled: false },
                                        fontSize: 12,
                                        lineNumbers: 'on',
                                        scrollBeyondLastLine: false,
                                        padding: { top: 10, bottom: 10 }
                                    }}
                                />
                            </div>
                        </div>

                        {/* Run Button */}
                        <button
                            onClick={runBacktest}
                            disabled={loading}
                            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-3 rounded font-medium transition-colors flex items-center justify-center gap-2 shadow-lg"
                        >
                            <Play className="w-5 h-5" />
                            {loading ? 'Running Backtest...' : 'Run Backtest'}
                        </button>
                    </div>
                </div>

                {/* Right Panel - Results */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Chart Area */}
                    <div className="flex-1 bg-[#131722] border-b border-[#2A2E39]">
                        {data.length > 0 ? (
                            <Chart
                                data={data}
                                trades={results?.trades}
                                chartType={chartType}
                                indicators={activeIndicators}
                            />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="text-center">
                                    <Calendar className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                                    <p>No market data available</p>
                                    <p className="text-sm text-gray-500 mt-2">Select a symbol and timeframe to begin</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Results Area */}
                    <div className="h-80 overflow-auto bg-[#1E222D]">
                        {results ? (
                            <StrategyTester results={results} />
                        ) : (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="text-center">
                                    <Activity className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p>No backtest results yet</p>
                                    <p className="text-sm text-gray-500 mt-2">Configure your strategy and click "Run Backtest"</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
