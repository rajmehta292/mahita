'use client'

import { useState, useEffect } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import dynamic from 'next/dynamic'
import {
    Play,
    Save,
    FolderOpen,
    Plus,
    Trash2,
    Edit,
    ExternalLink,
    Settings,
    BarChart3,
    TrendingUp,
    AlertCircle,
    CheckCircle,
    Maximize2
} from 'lucide-react'
import StrategyTester from '../components/StrategyTester'

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false })
const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

interface Strategy {
    id: string
    name: string
    description: string
    script: string
    symbol: string
    timeframe: string
    createdAt: string
    updatedAt: string
}

interface BacktestConfig {
    initialCapital: number
    startDate: string
    endDate: string
}

export default function BacktestPage() {
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
    const [script, setScript] = useState(DEFAULT_SCRIPT)
    const [strategyName, setStrategyName] = useState('Untitled Strategy')
    const [strategyDescription, setStrategyDescription] = useState('')
    const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
    const [selectedTimeframe, setSelectedTimeframe] = useState('1d')

    // Backtest config
    const [initialCapital, setInitialCapital] = useState(100000)
    const [startDate, setStartDate] = useState('2024-01-01')
    const [endDate, setEndDate] = useState('2024-12-31')
    const [stopLoss, setStopLoss] = useState(2.0)
    const [takeProfit, setTakeProfit] = useState(6.0)
    const [positionSize, setPositionSize] = useState(100)

    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [results, setResults] = useState<any>(null)
    const [data, setData] = useState<any[]>([])
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [editorDetached, setEditorDetached] = useState(false)
    const [detachedWindow, setDetachedWindow] = useState<Window | null>(null)

    useEffect(() => {
        loadStrategies()
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe])

    const loadStrategies = async () => {
        // TODO: Load from API
        const saved = localStorage.getItem('strategies')
        if (saved) {
            setStrategies(JSON.parse(saved))
        }
    }

    const fetchMarketData = async () => {
        try {
            const response = await fetch(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)
            const json = await response.json()
            if (json) setData(json)
        } catch (error) {
            console.error('Failed to fetch market data:', error)
        }
    }

    const saveStrategy = () => {
        const strategy: Strategy = {
            id: selectedStrategy?.id || Date.now().toString(),
            name: strategyName,
            description: strategyDescription,
            script,
            symbol: selectedSymbol,
            timeframe: selectedTimeframe,
            createdAt: selectedStrategy?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        const updated = selectedStrategy
            ? strategies.map(s => s.id === strategy.id ? strategy : s)
            : [...strategies, strategy]

        setStrategies(updated)
        localStorage.setItem('strategies', JSON.stringify(updated))
        setSelectedStrategy(strategy)
        setShowSaveDialog(false)
        alert('Strategy saved successfully!')
    }

    const loadStrategy = (strategy: Strategy) => {
        setSelectedStrategy(strategy)
        setStrategyName(strategy.name)
        setStrategyDescription(strategy.description)
        setScript(strategy.script)
        setSelectedSymbol(strategy.symbol)
        setSelectedTimeframe(strategy.timeframe)
    }

    const deleteStrategy = (id: string) => {
        if (!confirm('Are you sure you want to delete this strategy?')) return
        const updated = strategies.filter(s => s.id !== id)
        setStrategies(updated)
        localStorage.setItem('strategies', JSON.stringify(updated))
        if (selectedStrategy?.id === id) {
            setSelectedStrategy(null)
            setStrategyName('Untitled Strategy')
            setScript(DEFAULT_SCRIPT)
        }
    }

    const newStrategy = () => {
        setSelectedStrategy(null)
        setStrategyName('Untitled Strategy')
        setStrategyDescription('')
        setScript(DEFAULT_SCRIPT)
        setResults(null)
    }

    const verifyScript = async () => {
        setVerifying(true)
        try {
            const response = await fetch('/api/trading/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ script })
            })
            const json = await response.json()
            if (json.success) {
                alert('Verification successful! No syntax errors found.')
            } else {
                alert(`Verification failed:\n${json.error}`)
            }
        } catch (error) {
            console.error('Verification error:', error)
            alert('Failed to connect to verification service')
        } finally {
            setVerifying(false)
        }
    }

    const runBacktest = async () => {
        setLoading(true)
        try {
            if (data.length === 0) {
                alert('No data available for this symbol/timeframe')
                return
            }

            const startTime = new Date(startDate).getTime() / 1000
            const endTime = new Date(endDate).getTime() / 1000

            const response = await fetch('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: {
                        id: selectedStrategy?.id || 'temp',
                        name: strategyName,
                        asset: selectedSymbol,
                        timeframe: selectedTimeframe,
                        script: script,
                        riskManagement: {
                            positionSizingPercent: positionSize,
                            stopLossPercent: stopLoss,
                            takeProfitPercent: takeProfit
                        }
                    },
                    startTime,
                    endTime,
                    initialCapital
                })
            })

            const json = await response.json()
            if (json) {
                setResults(json)
            }
        } catch (error) {
            console.error('Backtest error:', error)
            alert('Failed to run backtest')
        } finally {
            setLoading(false)
        }
    }

    const detachEditor = () => {
        const newWindow = window.open('', 'Pine Script Editor', 'width=800,height=600')
        if (newWindow) {
            newWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Pine Script Editor - ${strategyName}</title>
                    <style>
                        body { margin: 0; padding: 0; background: #1e1e1e; }
                        #editor { width: 100vw; height: 100vh; }
                    </style>
                </head>
                <body>
                    <div id="editor"></div>
                </body>
                </html>
            `)
            setDetachedWindow(newWindow)
            setEditorDetached(true)
        }
    }

    return (
        <MainLayout>
            <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <BarChart3 className="w-6 h-6 text-blue-500" />
                        <h1 className="text-white font-semibold text-lg">Strategy Backtester</h1>
                        <span className="text-xs text-gray-400">Pine Script Engine</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={newStrategy}
                            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            New Strategy
                        </button>
                        <button
                            onClick={() => setShowSaveDialog(true)}
                            className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg transition-colors flex items-center gap-2 text-sm"
                        >
                            <Save className="w-4 h-4" />
                            Save
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar - Strategies */}
                    <div className="w-64 bg-[#1E222D] border-r border-[#2A2E39] flex flex-col">
                        <div className="p-4 border-b border-[#2A2E39]">
                            <h3 className="text-white font-semibold flex items-center gap-2">
                                <FolderOpen className="w-4 h-4" />
                                My Strategies
                            </h3>
                        </div>
                        <div className="flex-1 overflow-auto p-2">
                            {strategies.length === 0 ? (
                                <div className="text-center py-8 text-gray-400 text-sm">
                                    No saved strategies
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {strategies.map((strategy) => (
                                        <div
                                            key={strategy.id}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedStrategy?.id === strategy.id
                                                ? 'bg-blue-500/20 border-blue-500'
                                                : 'bg-[#131722] border-[#2A2E39] hover:border-blue-500/30'
                                                }`}
                                            onClick={() => loadStrategy(strategy)}
                                        >
                                            <div className="flex items-start justify-between mb-1">
                                                <span className="text-white text-sm font-medium">{strategy.name}</span>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteStrategy(strategy.id)
                                                    }}
                                                    className="p-1 hover:bg-red-500/20 rounded"
                                                >
                                                    <Trash2 className="w-3 h-3 text-red-500" />
                                                </button>
                                            </div>
                                            <div className="text-xs text-gray-400">{strategy.symbol} • {strategy.timeframe}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Configuration Bar */}
                        <div className="bg-[#1E222D] border-b border-[#2A2E39] p-4">
                            <div className="grid grid-cols-5 gap-4">
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Symbol</label>
                                    <select
                                        value={selectedSymbol}
                                        onChange={(e) => setSelectedSymbol(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    >
                                        <option value="AAPL">AAPL</option>
                                        <option value="MSFT">MSFT</option>
                                        <option value="GOOGL">GOOGL</option>
                                        <option value="TSLA">TSLA</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Timeframe</label>
                                    <select
                                        value={selectedTimeframe}
                                        onChange={(e) => setSelectedTimeframe(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    >
                                        <option value="1m">1 minute</option>
                                        <option value="5m">5 minutes</option>
                                        <option value="15m">15 minutes</option>
                                        <option value="1h">1 hour</option>
                                        <option value="1d">1 day</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Initial Capital</label>
                                    <input
                                        type="number"
                                        value={initialCapital}
                                        onChange={(e) => setInitialCapital(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Start Date</label>
                                    <input
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">End Date</label>
                                    <input
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-5 gap-4 mt-4">
                                <div>
                                    <label className="text-xs text-amber-500/60 mb-1 block font-bold uppercase tracking-widest">Stop Loss (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={stopLoss}
                                        onChange={(e) => setStopLoss(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-[#131722] border border-amber-500/20 rounded text-amber-500 text-sm focus:border-amber-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-emerald-500/60 mb-1 block font-bold uppercase tracking-widest">Take Profit (%)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        value={takeProfit}
                                        onChange={(e) => setTakeProfit(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-[#131722] border border-emerald-500/20 rounded text-emerald-500 text-sm focus:border-emerald-500/50 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-400 mb-1 block">Pos Sizing (%)</label>
                                    <input
                                        type="number"
                                        value={positionSize}
                                        onChange={(e) => setPositionSize(Number(e.target.value))}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white text-sm"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Editor and Chart */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* Pine Script Editor */}
                            {!editorDetached && (
                                <div className="w-1/2 border-r border-[#2A2E39] flex flex-col">
                                    <div className="bg-[#1E222D] border-b border-[#2A2E39] px-4 py-2 flex items-center justify-between">
                                        <span className="text-white text-sm font-medium">Pine Script Editor</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={detachEditor}
                                                className="p-1 hover:bg-[#2A2E39] rounded"
                                                title="Detach editor"
                                            >
                                                <Maximize2 className="w-4 h-4 text-gray-400" />
                                            </button>
                                            <a
                                                href="/learn"
                                                target="_blank"
                                                className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1"
                                            >
                                                Learn Pine Script
                                                <ExternalLink className="w-3 h-3" />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <Editor
                                            height="100%"
                                            defaultLanguage="javascript"
                                            theme="vs-dark"
                                            value={script}
                                            onChange={(value) => setScript(value || '')}
                                            options={{
                                                minimap: { enabled: false },
                                                fontSize: 13,
                                                lineNumbers: 'on',
                                                scrollBeyondLastLine: false,
                                                automaticLayout: true,
                                                padding: { top: 10 }
                                            }}
                                        />
                                    </div>
                                    <div className="bg-[#1E222D] border-t border-[#2A2E39] p-4 flex gap-3">
                                        <button
                                            onClick={verifyScript}
                                            disabled={verifying || loading}
                                            className="flex-1 py-3 bg-[#131722] hover:bg-[#2A2E39] text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-[#2A2E39] disabled:opacity-50"
                                        >
                                            <CheckCircle className={`w-4 h-4 ${verifying ? 'animate-pulse' : ''}`} />
                                            {verifying ? 'Verifying...' : 'Verify'}
                                        </button>
                                        <button
                                            onClick={runBacktest}
                                            disabled={loading || data.length === 0}
                                            className="flex-[2] py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Play className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                            {loading ? 'Running...' : 'Run Backtest'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Chart */}
                            <div className={`${editorDetached ? 'w-full' : 'w-1/2'} flex flex-col`}>
                                <div className="bg-[#1E222D] border-b border-[#2A2E39] px-4 py-2">
                                    <span className="text-white text-sm font-medium">Chart Visualization</span>
                                </div>
                                <div className="flex-1 bg-[#131722]">
                                    {data.length === 0 ? (
                                        <div className="h-full flex items-center justify-center text-gray-400">
                                            Loading market data...
                                        </div>
                                    ) : (
                                        <Chart
                                            data={data}
                                            trades={results?.trades}
                                            chartType="Standard"
                                            indicators={[]}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Results */}
                        {results && (
                            <div className="h-64 border-t border-[#2A2E39] overflow-auto">
                                <StrategyTester results={results} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Save Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-6 w-full max-w-md">
                            <h3 className="text-white font-semibold text-lg mb-4">Save Strategy</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">Strategy Name</label>
                                    <input
                                        type="text"
                                        value={strategyName}
                                        onChange={(e) => setStrategyName(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white"
                                        placeholder="My Strategy"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 mb-1 block">Description (optional)</label>
                                    <textarea
                                        value={strategyDescription}
                                        onChange={(e) => setStrategyDescription(e.target.value)}
                                        className="w-full px-3 py-2 bg-[#131722] border border-[#2A2E39] rounded text-white h-20 resize-none"
                                        placeholder="Describe your strategy..."
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowSaveDialog(false)}
                                        className="flex-1 py-2 bg-[#131722] hover:bg-[#2A2E39] text-white rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveStrategy}
                                        className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}

const DEFAULT_SCRIPT = `// Pine Script Strategy
// @version=1

// This strategy uses EMA crossover for entry/exit signals
// Risk management is handled separately in the backtest configuration

const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)
const rsi = ta.rsi(14)

// Entry: Fast EMA crosses above slow EMA and RSI is not overbought
if (ema_fast > ema_slow && rsi < 70) {
    strategy.entry("Long", "long")
}

// Exit: Fast EMA crosses below slow EMA or RSI is overbought
if (ema_fast < ema_slow || rsi > 70) {
    strategy.close("Long")
}

// Note: Stop-loss and take-profit are configured in the backtest settings
// This keeps your strategy logic clean and reusable
`
