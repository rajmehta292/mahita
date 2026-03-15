'use client'

import { useCallback, useEffect, useState } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import dynamic from 'next/dynamic'
import { normalizeUnknownError, parseResponseError, readJsonResponse } from '@/lib/app-errors'
import {
    Play,
    Save,
    Plus,
    Edit,
    BarChart3,
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
import { MahitaCodeEditor } from '../components/Backtest/MahitaCodeEditor'
import { ClientPaneErrorBoundary } from '../components/Error/ClientPaneErrorBoundary'
import type { BacktestResult, ParityBatchFixtureResult, ParityFixtureStatus } from '../services/trading-engine/types'
import type { MarketDataPoint } from '../services/market-data/types'
import type { ParityFixtureManifest, StrategyRunSettings } from '../services/trading-engine/types'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { useViewDemand } from '../hooks/use-view-demand'

const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

interface Strategy {
    id: string
    name: string
    description: string
    script: string
    symbol: string
    timeframe: string
    engineMode?: string
    lastParityStatus?: string | null
    linkedFixtureId?: string | null
    runSettings?: StrategyRunSettings | null
    createdAt: string
    updatedAt: string
}

interface ParityFixtureDocument {
    id: string
    fixtureKey: string
    name: string
    symbol: string
    timeframe: string
    status: ParityFixtureStatus
    barCount: number
    tradeCount: number
    candles: MarketDataPoint[]
    manifest?: ParityFixtureManifest | null
    lastParityReport?: ParityBatchFixtureResult | null
}

const DEFAULT_SCRIPT = `//@version=5
strategy("EMA Crossover Prototype", overlay=true)

fastEma = ta.ema(close, 9)
slowEma = ta.ema(close, 21)
rsiValue = ta.rsi(close, 14)

longEntry = ta.crossover(fastEma, slowEma) and rsiValue < 70
longExit = ta.crossunder(fastEma, slowEma) or rsiValue > 70

if longEntry
    strategy.entry("Long", strategy.long)

if longExit
    strategy.close("Long")

plot(fastEma, "Fast EMA", color=color.green)
plot(slowEma, "Slow EMA", color=color.red)
`

export default function BacktestPage() {
    const { preferences } = useUserPreferences()
    const [requestedScriptId, setRequestedScriptId] = useState<string | null>(null)
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null)
    const [script, setScript] = useState(DEFAULT_SCRIPT)
    const [strategyName, setStrategyName] = useState('Untitled Strategy')
    const [selectedSymbol, setSelectedSymbol] = useState('AAPL')
    const [selectedTimeframe, setSelectedTimeframe] = useState('1d')
    const [fixtures, setFixtures] = useState<ParityFixtureDocument[]>([])
    const [selectedFixtureId, setSelectedFixtureId] = useState('')

    // UI States
    const [loading, setLoading] = useState(false)
    const [results, setResults] = useState<BacktestResult | null>(null)
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [marketDataError, setMarketDataError] = useState<string | null>(null)
    const [backtestError, setBacktestError] = useState<string | null>(null)
    const [showSaveDialog, setShowSaveDialog] = useState(false)
    const [isEditorOpen, setIsEditorOpen] = useState(true)
    const [isResultsOpen, setIsResultsOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'editor' | 'ai' | 'history'>('editor')

    useViewDemand({
        enabled: true,
        surface: 'backtest',
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        providerPreference: 'schwab',
        priorityScore: 1.75,
        refreshIntervalSeconds: preferences?.viewRefreshIntervalSeconds ?? 13,
    })

    const linkedFixture = selectedFixtureId
        ? fixtures.find((fixture) => fixture.id === selectedFixtureId) ?? null
        : null
    const activeRunSettings = linkedFixture?.manifest?.runSettings ?? selectedStrategy?.runSettings ?? null

    const fetchMarketData = useCallback(async () => {
        try {
            setMarketDataError(null)

            if (selectedFixtureId) {
                const fixture = fixtures.find((candidate) => candidate.id === selectedFixtureId)
                if (fixture) {
                    setData(fixture.candles)
                    setSelectedSymbol(fixture.symbol)
                    setSelectedTimeframe(fixture.timeframe)
                    return
                }
            }

            const response = await fetch(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)
            const json = await readJsonResponse<{ data?: MarketDataPoint[] }>(
                response,
                'Mahita could not load market data for the backtest workspace.'
            )
            if (json && json.data) setData(json.data)
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Mahita could not load market data.', {
                code: 'UPSTREAM_FETCH_FAILED',
                hint: 'Retry once the market-data route is healthy. The editor remains available while market data is unavailable.',
            })
            console.warn('Failed to fetch market data:', normalized)
            setMarketDataError(normalized.message)
        }
    }, [fixtures, selectedFixtureId, selectedSymbol, selectedTimeframe])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        const params = new URLSearchParams(window.location.search)
        setRequestedScriptId(params.get('script'))
    }, [])

    useEffect(() => {
        void loadStrategies(requestedScriptId)
    }, [requestedScriptId])

    useEffect(() => {
        void loadFixtures()
    }, [loadFixtures])

    useEffect(() => {
        void fetchMarketData()
    }, [fetchMarketData])

    const applySavedStrategy = useCallback((strategy: Strategy) => {
        setSelectedStrategy(strategy)
        setStrategyName(strategy.name)
        setScript(strategy.script)
        setSelectedSymbol(strategy.symbol)
        setSelectedTimeframe(strategy.timeframe)
        setSelectedFixtureId(strategy.linkedFixtureId ?? '')
    }, [])

    async function loadFixtures() {
        try {
            const response = await fetch('/api/script-editor/fixtures', { cache: 'no-store' })
            if (!response.ok) {
                return
            }

            const json = await response.json()
            const nextFixtures: ParityFixtureDocument[] = json.fixtures ?? []
            setFixtures(nextFixtures)
        } catch (error) {
            console.warn('Failed to load parity fixtures for backtest workspace:', error)
        }
    }

    const loadStrategies = async (targetId: string | null) => {
        try {
            const response = await fetch('/api/script-editor/scripts', { cache: 'no-store' })
            if (!response.ok) {
                return
            }

            const json = await response.json()
            const savedStrategies: Strategy[] = (json.drafts ?? []).map((draft: any) => ({
                id: draft.id,
                name: draft.name,
                description: draft.description ?? '',
                script: draft.source,
                symbol: draft.symbol,
                timeframe: draft.timeframe,
                engineMode: draft.engineMode ?? 'pinets',
                lastParityStatus: draft.lastParityStatus ?? null,
                linkedFixtureId: draft.linkedFixtureId ?? null,
                runSettings: draft.runSettings ?? null,
                createdAt: draft.createdAt,
                updatedAt: draft.updatedAt,
            }))

            setStrategies(savedStrategies)

            const matched = targetId
                ? savedStrategies.find((strategy) => strategy.id === targetId)
                : savedStrategies[0]

            if (matched) {
                applySavedStrategy(matched)
            }
        } catch (error) {
            console.warn('Failed to load saved scripts for backtest workspace:', error)
        }
    }

    const saveStrategy = async () => {
        try {
            const response = await fetch('/api/script-editor/scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedStrategy?.id,
                    name: strategyName,
                    description: selectedStrategy?.description ?? '',
                    source: script,
                    symbol: selectedSymbol,
                    timeframe: selectedTimeframe,
                    engineMode: 'pinets',
                    linkedFixtureId: selectedFixtureId || null,
                    runSettings: activeRunSettings,
                }),
            })

            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to save script.')
            }

            const savedStrategy: Strategy = {
                id: json.draft.id,
                name: json.draft.name,
                description: json.draft.description ?? '',
                script: json.draft.source,
                symbol: json.draft.symbol,
                timeframe: json.draft.timeframe,
                engineMode: json.draft.engineMode ?? 'pinets',
                lastParityStatus: json.draft.lastParityStatus ?? null,
                linkedFixtureId: json.draft.linkedFixtureId ?? null,
                runSettings: json.draft.runSettings ?? null,
                createdAt: json.draft.createdAt,
                updatedAt: json.draft.updatedAt,
            }

            setStrategies((current) => {
                const withoutSaved = current.filter((strategy) => strategy.id !== savedStrategy.id)
                return [savedStrategy, ...withoutSaved]
            })
            applySavedStrategy(savedStrategy)
            setShowSaveDialog(false)
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Mahita could not save this script.', {
                code: 'UNKNOWN_ERROR',
            })
            setBacktestError(normalized.message)
        }
    }

    const runBacktest = async () => {
        setLoading(true)
        setIsResultsOpen(true)
        setBacktestError(null)
        try {
            if (data.length === 0) return

            const startTime = linkedFixture?.candles[0]?.time ?? (Date.now() / 1000 - 365 * 24 * 60 * 60)
            const endTime = linkedFixture?.candles[linkedFixture.candles.length - 1]?.time ?? (Date.now() / 1000)

            const response = await fetch('/api/trading/backtest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    strategy: {
                        id: selectedStrategy?.id || 'temp',
                        name: strategyName,
                        asset: linkedFixture?.symbol ?? selectedSymbol,
                        timeframe: linkedFixture?.timeframe ?? selectedTimeframe,
                        script: script,
                        riskManagement: {
                            positionSizingPercent: 100,
                            stopLossPercent: 2,
                            takeProfitPercent: 6
                        }
                    },
                    startTime,
                    endTime,
                    initialCapital: linkedFixture ? undefined : 100000,
                    fixtureId: linkedFixture?.id,
                    runSettings: activeRunSettings,
                })
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not complete this prototype backtest run.')
            }

            const json = await response.json()
            if (json) {
                setResults(json)

                if (selectedStrategy?.id) {
                    const nextParityStatus = json.parityComparison
                        ? (json.parityComparison.exactMatch
                            ? 'exact-match'
                            : json.parityComparison.expectedTradeCount === 0
                                ? 'no-overlap'
                                : 'diverged')
                        : null

                    void fetch('/api/script-editor/scripts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            id: selectedStrategy.id,
                            name: strategyName,
                            description: selectedStrategy.description ?? '',
                            source: script,
                            symbol: linkedFixture?.symbol ?? selectedSymbol,
                            timeframe: linkedFixture?.timeframe ?? selectedTimeframe,
                            engineMode: 'pinets',
                            linkedFixtureId: selectedFixtureId || null,
                            lastParityStatus: nextParityStatus,
                            runSettings: activeRunSettings,
                        }),
                    }).catch((saveError) => {
                        console.warn('Failed to persist script parity status:', saveError)
                    })

                    setSelectedStrategy((current) => current
                        ? {
                            ...current,
                            lastParityStatus: nextParityStatus,
                            linkedFixtureId: selectedFixtureId || null,
                            runSettings: activeRunSettings,
                        }
                        : current)
                }
            }
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Mahita could not complete this prototype backtest run.', {
                code: 'UNKNOWN_ERROR',
                hint: 'Save your script, confirm the fixture or market data is loaded, then retry.',
            })
            console.warn('Backtest error:', normalized)
            setBacktestError(normalized.message)
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
                            <span className="rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">
                                PineTS Primary
                            </span>
                        </div>
                        <div className="h-4 w-[1px] bg-[#2A2E39]"></div>
                        <div className="flex items-center gap-3">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Instrument</span>
                                <select
                                    className="bg-transparent text-[13px] font-bold outline-none cursor-pointer hover:text-blue-500 transition-colors"
                                    value={selectedSymbol}
                                    onChange={(e) => setSelectedSymbol(e.target.value)}
                                    disabled={Boolean(selectedFixtureId)}
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
                                    disabled={Boolean(selectedFixtureId)}
                                >
                                    <option value="1m">1m</option>
                                    <option value="1h">1h</option>
                                    <option value="1d">1d</option>
                                    <option value="15m">15m</option>
                                </select>
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none">Dataset</span>
                                <select
                                    className="bg-transparent text-[13px] font-bold outline-none cursor-pointer hover:text-blue-500 transition-colors"
                                    value={selectedFixtureId}
                                    onChange={(e) => setSelectedFixtureId(e.target.value)}
                                >
                                    <option value="">Live market data</option>
                                    {fixtures.map((fixture) => (
                                        <option key={fixture.id} value={fixture.id}>
                                            {fixture.name} [{fixture.status}]
                                        </option>
                                    ))}
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
                                {marketDataError ? (
                                    <div className="h-full flex items-center justify-center px-6 text-center">
                                        <div className="max-w-md rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-5">
                                            <p className="text-sm font-medium text-white">Market data unavailable</p>
                                            <p className="mt-2 text-sm text-rose-100/80">{marketDataError}</p>
                                        </div>
                                    </div>
                                ) : data.length === 0 ? (
                                    <div className="h-full flex items-center justify-center text-gray-500 font-mono text-[10px] uppercase tracking-[0.3em]">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                            Awaiting Market Data
                                        </div>
                                    </div>
                                ) : (
                                    <ClientPaneErrorBoundary title="Chart unavailable">
                                        <Chart
                                            data={data}
                                            trades={results?.trades || []}
                                            chartType="Standard"
                                            indicators={['Volume']}
                                        />
                                    </ClientPaneErrorBoundary>
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
                                {backtestError && (
                                    <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                                        {backtestError}
                                    </div>
                                )}
                                {results?.diagnostics && (
                                    <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Engine</p>
                                            <p className="mt-2 text-sm font-semibold text-white">{results.diagnostics.engineMode.toUpperCase()}</p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {results.diagnostics.dataSource === 'tradingview-fixture' ? 'Fixture-backed parity run' : 'Live-provider run'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Dataset</p>
                                            <p className="mt-2 text-sm font-semibold text-white">
                                                {selectedFixtureId
                                                    ? linkedFixture?.name ?? 'Fixture'
                                                    : `${selectedSymbol} ${selectedTimeframe}`}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {selectedFixtureId
                                                    ? `${linkedFixture?.barCount ?? data.length} imported bars • ${linkedFixture?.status ?? 'staged'}`
                                                    : `${data.length} fetched bars`}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Run settings</p>
                                            <p className="mt-2 text-sm font-semibold text-white">
                                                {activeRunSettings
                                                    ? `$${activeRunSettings.defaultQtyValue} ${activeRunSettings.defaultQtyType}`
                                                    : 'Script defaults'}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {activeRunSettings
                                                    ? `${activeRunSettings.pyramiding} pyramids • ${activeRunSettings.source ?? 'active'}`
                                                    : 'No override manifest linked'}
                                            </p>
                                        </div>
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Parity</p>
                                            <p className={clsx('mt-2 text-sm font-semibold', results.parityComparison?.exactMatch ? 'text-emerald-300' : 'text-amber-200')}>
                                                {results.parityComparison
                                                    ? (results.parityComparison.exactMatch ? 'Exact match' : 'Divergence detected')
                                                    : 'No fixture comparison'}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-400">
                                                {results.parityComparison
                                                    ? `${results.parityComparison.matchingTradeCount}/${results.parityComparison.expectedTradeCount} trades matched`
                                                    : 'Select a TradingView fixture to compare trades.'}
                                            </p>
                                            {linkedFixture?.lastParityReport && (
                                                <p className="mt-2 text-[11px] text-gray-500">
                                                    Batch status: {linkedFixture.lastParityReport.status} • replay {linkedFixture.lastParityReport.replayComparison?.exactMatch ? 'exact' : 'diff'} • engine {linkedFixture.lastParityReport.engineComparison?.exactMatch ? 'exact' : 'diff'}
                                                </p>
                                            )}
                                        </div>
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Warnings</p>
                                            <p className="mt-2 text-sm font-semibold text-white">{results.diagnostics.warnings?.length ?? 0}</p>
                                            <p className="mt-1 text-xs text-gray-400">{results.diagnostics.warnings?.[0] ?? 'No runtime warnings recorded.'}</p>
                                        </div>
                                    </div>
                                )}
                                {results?.parityComparison && !results.parityComparison.exactMatch && (
                                    <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                                        <p className="font-semibold">First divergence</p>
                                        <p className="mt-1">
                                            {results.parityComparison.firstDivergenceMessage ?? 'Mahita detected a trade mismatch against the selected TradingView fixture.'}
                                        </p>
                                        {(results.parityComparison.firstDivergenceBarLabel || results.parityComparison.firstDivergenceRuntimeVariable) && (
                                            <p className="mt-2 text-xs text-amber-100/80">
                                                {results.parityComparison.firstDivergenceBarLabel
                                                    ? `Bar ${results.parityComparison.firstDivergenceBarLabel}`
                                                    : 'Bar unavailable'}
                                                {results.parityComparison.firstDivergenceRuntimeVariable
                                                    ? ` • ${results.parityComparison.firstDivergenceRuntimeVariable}=${String(results.parityComparison.firstDivergenceRuntimeValue)}`
                                                    : ''}
                                            </p>
                                        )}
                                    </div>
                                )}
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
                                                <ClientPaneErrorBoundary title="Editor unavailable">
                                                    <MahitaCodeEditor
                                                        value={script}
                                                        onChange={setScript}
                                                    />
                                                </ClientPaneErrorBoundary>
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
