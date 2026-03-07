'use client'

import { useState, useEffect, useRef } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import dynamic from 'next/dynamic'
import {
    Play,
    Save,
    Plus,
    Trash2,
    Edit,
    Settings,
    BarChart3,
    AlertCircle,
    CheckCircle,
    Maximize2,
    ChevronRight,
    ChevronLeft,
    ChevronUp,
    ChevronDown,
    MessageSquare,
    Zap,
    Layers,
    Type,
    History,
    MoreVertical
} from 'lucide-react'
import StrategyTester from '../components/StrategyTester'
import { clsx } from 'clsx'

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

const DEFAULT_SCRIPT = `// Pine Script Strategy
// @version=1

// This strategy uses EMA crossover for entry/exit signals
const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)
const rsi = ta.rsi(14)

if (ema_fast > ema_slow && rsi < 70) {
    strategy.entry("Long", "long")
}

if (ema_fast < ema_slow || rsi > 70) {
    strategy.close("Long")
}
`

export default function BacktestPage() {
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
    const [script, setScript] = useState(DEFAULT_SCRIPT)
    const [strategyName, setStrategyName] = useState('Untitled Strategy')
    const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
    const [selectedTimeframe, setSelectedTimeframe] = useState('1d')

    // UI States
    const [loading, setLoading] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [results, setResults] = useState<any>(null)
    const [data, setData] = useState<any[]>([])
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [isEditorOpen, setIsEditorOpen] = useState(true)
    const [isResultsOpen, setIsResultsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'editor' | 'ai' | 'history'>('editor')

    useEffect(() => {
        loadStrategies()
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe])

    const loadStrategies = async () => {
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
            description: '',
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
    }

    const runBacktest = async () => {
        setLoading(true)
        setIsResultsOpen(true)
        try {
            if (data.length === 0) return

            const startTime = Date.now() / 1000 - 365 * 24 * 60 * 60
            const endTime = Date.now() / 1000

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
                            positionSizingPercent: 100,
                            stopLossPercent: 2,
                            takeProfitPercent: 6
                        }
                    },
                    startTime,
                    endTime,
                    initialCapital: 100000
                })
            })

            const json = await response.json()
            if (json) {
                setResults(json)
            }
        } catch (error) {
            console.error('Backtest error:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <MainLayout showBottomPanel={false}>
            <div className="flex flex-col h-full bg-[#131722] text-white overflow-hidden relative">
                {/* Header / Toolbar */}
                <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-4 shrink-0 z-20">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                            <span className="font-bold text-sm tracking-tight">MAHITA ENGINE v6</span>
                        </div>
                        <div className="h-4 w-[1px] bg-[#2A2E39]"></div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Instrument</span>
                                <select
                                    className="bg-transparent text-[13px] font-bold outline-none cursor-pointer hover:text-blue-500 transition-colors"
                                    value={selectedSymbol}
                                    onChange={(e) => setSelectedSymbol(e.target.value)}
                                >
                                    <option value="AAPL">AAPL</option>
                                    <option value="TSLA">TSLA</option>
                                    <option value="MSFT">MSFT</option>
                                    <option value="BTCUSD">BTCUSD</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Timeframe</span>
                                <select
                                    className="bg-transparent text-[13px] font-bold outline-none cursor-pointer hover:text-blue-500 transition-colors"
                                    value={selectedTimeframe}
                                    onChange={(e) => setSelectedTimeframe(e.target.value)}
                                >
                                    <option value="1h">1h</option>
                                    <option value="1d">1d</option>
                                    <option value="15m">15m</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={runBacktest}
                            disabled={loading}
                            className="bg-blue-500 hover:bg-blue-600 px-4 py-1.5 rounded-md text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <Play className={`w-3 h-3 fill-current ${loading ? 'animate-pulse' : ''}`} />
                            {loading ? 'Executing...' : 'Run Strategy'}
                        </button>
                    </div>
                </div>

                {/* Main Split Layout */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Panel: Chart & Results */}
                    <div className="flex-1 flex flex-col min-w-0 relative">
                        {/* Chart Area */}
                        <div className="flex-1 relative bg-[#131722]">
                            {/* Chart Controls Overlay */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                                <div className="bg-[#1E222D]/80 backdrop-blur-md border border-[#2A2E39] rounded-lg p-1 shadow-2xl flex items-center gap-1">
                                    <button className="px-3 py-1.5 hover:bg-[#2A2E39] rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                                        <Layers className="w-3.5 h-3.5 text-blue-500" />
                                        Indicators
                                    </button>
                                    <button className="px-3 py-1.5 hover:bg-[#2A2E39] rounded-md text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center gap-2">
                                        <Zap className="w-3.5 h-3.5 text-orange-500" />
                                        Strategies
                                    </button>
                                </div>
                            </div>

                            <div className="w-full h-full">
                                {data.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            Awaiting Market Data
                                        </div>
                                    </div>
                                ) : (
                                    <Chart
                                        data={data}
                                        trades={results?.trades || []}
                                        chartType="Standard"
                                        indicators={['Volume']}
                                    />
                                )}
                            </div>
                        </div>

                        {/* Results Drawer (Sticky bottom) */}
                        <div
                            className={clsx(
                                "bg-[#1E222D] border-t border-[#2A2E39] transition-all duration-300 ease-in-out shrink-0",
                                isResultsOpen ? "h-[350px]" : "h-10"
                            )}
                        >
                            <div
                                className="h-10 px-6 flex items-center justify-between cursor-pointer hover:bg-[#2A2E39] transition-colors"
                                onClick={() => setIsResultsOpen(!isResultsOpen)}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Strategy Results</span>
                                    {results && (
                                        <div className="flex items-center gap-4">
                                            <span className={clsx("text-xs font-bold", results.metrics.netProfit >= 0 ? "text-emerald-500" : "text-rose-500")}>
                                                PNL: {results.metrics.netProfit >= 0 ? '+' : ''}{results.metrics.netProfitPercent.toFixed(2)}%
                                            </span>
                                            <span className="text-[10px] text-gray-500 font-mono">TRADES: {results.metrics.totalTrades}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-gray-500">
                                    <span className="text-[10px] font-mono hover:text-white transition-colors">Performance Summary</span>
                                    {isResultsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                </div>
                            </div>
                            <div className="h-[310px] overflow-auto px-6 pb-6">
                                <StrategyTester results={results} />
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Editor & AI */}
                    <div
                        className={clsx(
                            "bg-[#131722] border-l border-[#2A2E39] transition-all duration-300 ease-in-out flex flex-col shrink-0",
                            isEditorOpen ? "w-[450px]" : "w-10 overflow-hidden"
                        )}
                    >
                        {/* Editor Toggle Handle */}
                        {!isEditorOpen && (
                            <button
                                onClick={() => setIsEditorOpen(true)}
                                className="flex-1 flex flex-col items-center py-6 gap-6 hover:bg-[#1E222D] transition-colors"
                            >
                                <ChevronLeft className="w-4 h-4 text-gray-500" />
                                <span className="vertical-text text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Script Editor</span>
                                <Edit className="w-4 h-4 text-gray-500" />
                            </button>
                        )}

                        {isEditorOpen && (
                            <>
                                {/* Editor Header */}
                                <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-4 shrink-0">
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => setActiveTab('editor')}
                                            className={clsx("text-[10px] font-black uppercase tracking-widest pb-3 pt-3 transition-all relative",
                                                activeTab === 'editor' ? "text-blue-500" : "text-gray-500 hover:text-white"
                                            )}
                                        >
                                            Editor
                                            {activeTab === 'editor' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />}
                                        </button>
                                        <button
                                            onClick={() => setActiveTab('ai')}
                                            className={clsx("text-[10px] font-black uppercase tracking-widest pb-3 pt-3 transition-all relative flex items-center gap-2",
                                                activeTab === 'ai' ? "text-orange-500" : "text-gray-500 hover:text-white"
                                            )}
                                        >
                                            <MessageSquare className="w-3 h-3" />
                                            AI Chat
                                            {activeTab === 'ai' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setIsEditorOpen(false)}
                                        className="p-1.5 hover:bg-[#2A2E39] rounded-md transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4 text-gray-500" />
                                    </button>
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    {activeTab === 'editor' && (
                                        <>
                                            {/* Editor Toolbar */}
                                            <div className="p-3 bg-white/[0.02] border-b border-[#2A2E39] flex items-center justify-between shrink-0">
                                                <div className="flex items-center gap-1">
                                                    <button className="p-2 hover:bg-[#2A2E39] rounded-md transition-all group" title="Add to Chart">
                                                        <Plus className="w-4 h-4 text-emerald-500 group-hover:scale-110" />
                                                    </button>
                                                    <button onClick={() => setShowSaveDialog(true)} className="p-2 hover:bg-[#2A2E39] rounded-md transition-all group" title="Save Script">
                                                        <Save className="w-4 h-4 text-blue-500 group-hover:scale-110" />
                                                    </button>
                                                    <button className="p-2 hover:bg-[#2A2E39] rounded-md transition-all" title="Rename Script">
                                                        <Type className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button className="p-2 hover:bg-[#2A2E39] rounded-md" title="Previous Versions">
                                                        <History className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                    <button className="p-2 hover:bg-[#2A2E39] rounded-md">
                                                        <MoreVertical className="w-4 h-4 text-gray-500" />
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Monaco Editor */}
                                            <div className="flex-1 min-h-0 bg-[#0d0e12]">
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
                                                        padding: { top: 15 },
                                                        backgroundColor: '#0d0e12'
                                                    }}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {activeTab === 'ai' && (
                                        <div className="flex-1 flex flex-col p-6 bg-[#0d0e12]">
                                            <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30">
                                                <MessageSquare className="w-12 h-12 mb-4" />
                                                <p className="text-[10px] font-black uppercase tracking-widest">AI Strategy Architect</p>
                                                <p className="text-xs max-w-[200px] mt-2">Ask me to modify your script, add indicators, or explain the logic.</p>
                                            </div>
                                            <div className="mt-auto">
                                                <div className="relative">
                                                    <textarea
                                                        placeholder="Ask AI to modify script..."
                                                        className="w-full bg-[#1E222D] border border-[#2A2E39] rounded-xl p-4 pr-12 text-sm outline-none focus:border-orange-500 transition-all resize-none h-24"
                                                    />
                                                    <button className="absolute bottom-4 right-4 p-2 bg-orange-500 rounded-lg shadow-lg hover:bg-orange-600 transition-all">
                                                        <Zap className="w-4 h-4 text-white fill-current" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Save Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl p-8 w-full max-w-md shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
                            <h3 className="text-white font-black text-xl mb-6 uppercase tracking-tight">Save Strategy Archive</h3>
                            <div className="space-y-6">
                                <div>
                                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2 block">Archive Identifier</label>
                                    <input
                                        type="text"
                                        value={strategyName}
                                        onChange={(e) => setStrategyName(e.target.value)}
                                        className="w-full px-4 py-3 bg-[#131722] border border-[#2A2E39] rounded-xl text-white outline-none focus:border-blue-500 transition-all"
                                        placeholder="e.g. Trend Rider v2"
                                        autoFocus
                                    />
                                </div>
                                <div className="flex gap-4 pt-2">
                                    <button
                                        onClick={() => setShowSaveDialog(false)}
                                        className="flex-1 py-4 bg-[#131722] border border-[#2A2E39] text-gray-400 font-bold rounded-2xl hover:text-white transition-all uppercase text-[10px] tracking-widest"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={saveStrategy}
                                        className="flex-1 py-4 bg-blue-500 text-white font-bold rounded-2xl hover:bg-blue-600 shadow-xl shadow-blue-500/20 transition-all uppercase text-[10px] tracking-widest"
                                    >
                                        Confirm Save
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style jsx>{`
                .vertical-text {
                    writing-mode: vertical-rl;
                    text-orientation: mixed;
                }
            `}</style>
        </MainLayout>
    )
}
