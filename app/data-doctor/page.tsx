'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Activity,
    AlertCircle,
    ArrowLeft,
    BarChart3,
    Calendar,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock,
    Database,
    Filter,
    Play,
    Radio,
    RefreshCw,
    Search,
    ShieldCheck,
    Square,
    Table,
    Trash2,
    Zap,
    CloudLightning,
    Target as LucideTarget
} from 'lucide-react'
import { DataInventory, Vault } from '@prisma/client'
import Link from 'next/link'
import { HealthReport } from '../services/market-data/health'
import { Timeframe } from '../services/market-data/types'

interface ProviderEvent {
    id: string
    timestamp: string
    kind: 'request' | 'response' | 'error' | 'verification' | 'control'
    provider?: string
    symbol?: string
    timeframe?: string
    rangeStart?: number
    rangeEnd?: number
    message: string
    request?: Record<string, unknown>
    response?: Record<string, unknown>
}

interface ContinuousStatus {
    running: boolean
    startedAt: string | null
    lastCompletedAt: string | null
    cycleCount: number
    currentPhase: string
    providerOverride: string | null
    intervalMs: number
    lastError: string | null
}

interface VerificationResponse {
    symbol: string
    timeframe: Timeframe
    primaryProvider: string
    secondaryProvider: string
    rangeStart: number
    rangeEnd: number
    primaryCount: number
    secondaryCount: number
    comparison: {
        overlapCount: number
        missingFromPrimary: number
        missingFromSecondary: number
        mismatchCount: number
        maxCloseDiff: number
        avgCloseDiff: number
        accuracyScore: number
        samples: Array<{
            time: number
            primaryClose: number
            secondaryClose: number
            closeDiff: number
            primaryVolume: number
            secondaryVolume: number
            volumeDiff: number
        }>
    }
}

const DEFAULT_VERIFY_START = new Date(Date.now() - 90 * 86400000)
const DEFAULT_VERIFY_END = new Date()

function toDateTimeLocal(date: Date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    return local.toISOString().slice(0, 16)
}

function sortEvents(events: ProviderEvent[]) {
    return [...events].sort((left, right) => right.timestamp.localeCompare(left.timestamp))
}

function formatEventMeta(event: ProviderEvent) {
    const parts: string[] = []

    if (event.symbol) {
        parts.push(event.symbol)
    }

    if (event.timeframe) {
        parts.push(event.timeframe)
    }

    if (event.provider) {
        parts.push(event.provider)
    }

    if (event.rangeStart && event.rangeEnd) {
        parts.push(`${new Date(event.rangeStart * 1000).toLocaleString()} -> ${new Date(event.rangeEnd * 1000).toLocaleString()}`)
    }

    return parts.join(' | ')
}

export default function DataDoctorPage() {
    const [reports, setReports] = useState<HealthReport[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'summary' | 'roadmap' | 'traffic'>('summary')
    const [selectedAsset, setSelectedAsset] = useState<{ symbol: string, timeframe: string } | null>(null)
    const [inspectData, setInspectData] = useState<any>(null)
    const [inspectLoading, setInspectLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [refreshing, setRefreshing] = useState(false)
    const [syncing, setSyncing] = useState<string | null>(null)
    const [globalIngesting, setGlobalIngesting] = useState(false)
    const [detailProviderOverride, setDetailProviderOverride] = useState<string>('')
    const [ingestLogs, setIngestLogs] = useState<string[]>([])
    const [isIngestingProgress, setIsIngestingProgress] = useState(false)
    const [initialQuerySelection, setInitialQuerySelection] = useState<{ symbol: string, timeframe?: string } | null>(null)
    const [providers, setProviders] = useState<string[]>(['schwab', 'yahoo', 'alphavantage'])
    const [providerEvents, setProviderEvents] = useState<ProviderEvent[]>([])
    const [continuousStatus, setContinuousStatus] = useState<ContinuousStatus | null>(null)
    const [continuousProviderOverride, setContinuousProviderOverride] = useState('')
    const [continuousBusy, setContinuousBusy] = useState(false)
    const [resetting, setResetting] = useState(false)
    const [verifying, setVerifying] = useState(false)
    const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null)
    const [verificationError, setVerificationError] = useState<string | null>(null)

    // Vault & Health Heatmap State
    const [vaults, setVaults] = useState<any[]>([])
    const [selectedVault, setSelectedVault] = useState<string>('schwab')
    const [multiIntervalHealth, setMultiIntervalHealth] = useState<Record<string, any>>({})
    const [isConsolidating, setIsConsolidating] = useState(false)
    const [verifyForm, setVerifyForm] = useState({
        symbol: 'AAPL',
        timeframe: '1d' as Timeframe,
        primaryProvider: 'schwab',
        secondaryProvider: 'yahoo',
        startTime: toDateTimeLocal(DEFAULT_VERIFY_START),
        endTime: toDateTimeLocal(DEFAULT_VERIFY_END)
    })
    const terminalEndRef = React.useRef<HTMLDivElement>(null)
    const trafficEndRef = React.useRef<HTMLDivElement>(null)

    // Auto-scroll removed to prevent view-jumping as requested.

    // Auto-scroll removed to prevent view-jumping as requested.

    const fetchReports = useCallback(async (vault?: string) => {
        setLoading(true)
        try {
            const v = vault || selectedVault
            const res = await fetch(`/api/trading/data-health?vault=${v}`)
            const data = await res.json()
            if (Array.isArray(data)) setReports(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }, [selectedVault])

    const fetchVaults = useCallback(async () => {
        try {
            const res = await fetch('/api/trading/vaults')
            const data = await res.json()
            setVaults(data)
        } catch (e) {
            console.error(e)
        }
    }, [])

    const fetchMultiInterval = useCallback(async (symbol: string, vault: string) => {
        try {
            const res = await fetch(`/api/trading/data-health?symbol=${symbol}&vault=${vault}`)
            const data = await res.json()
            setMultiIntervalHealth(prev => ({ ...prev, [`${symbol}:${vault}`]: data }))
        } catch (e) {
            console.error(e)
        }
    }, [])

    const fetchTraffic = useCallback(async () => {
        try {
            const res = await fetch('/api/trading/provider-traffic')
            const data = await res.json()
            setProviders(Array.isArray(data.providers) && data.providers.length > 0 ? data.providers : ['schwab', 'yahoo', 'alphavantage'])
            setProviderEvents(Array.isArray(data.events) ? sortEvents(data.events) : [])
        } catch (error) {
            console.error('Failed to fetch provider traffic:', error)
        }
    }, [])

    const fetchContinuousStatus = useCallback(async () => {
        try {
            const res = await fetch('/api/trading/continuous-ingest')
            if (!res.ok) return
            const data = await res.json()
            setContinuousStatus(data)
            if (data?.providerOverride) {
                setContinuousProviderOverride(data.providerOverride)
            }
        } catch (error) {
            console.error('Failed to fetch continuous ingest status:', error)
        }
    }, [])

    const processStream = async (res: Response, successMsg: string) => {
        setIsIngestingProgress(true)
        setIngestLogs([])
        const reader = res.body?.getReader()
        const decoder = new TextDecoder()
        if (!reader) return

        let currentLogs: string[] = []
        const addLog = (msg: string) => {
            currentLogs = [msg, ...currentLogs]
            setIngestLogs(currentLogs)
        }

        const formatLog = (payload: any) => {
            if (typeof payload === 'string') {
                return payload
            }

            if (!payload || typeof payload !== 'object') {
                return String(payload)
            }

            const parts = [payload.message || 'Log event']

            if (payload.symbol) {
                parts.push(payload.symbol)
            }

            if (payload.timeframe) {
                parts.push(payload.timeframe)
            }

            if (payload.provider) {
                parts.push(`provider=${payload.provider}`)
            }

            if (payload.rangeStart && payload.rangeEnd) {
                parts.push(
                    `${new Date(payload.rangeStart * 1000).toISOString()} -> ${new Date(payload.rangeEnd * 1000).toISOString()}`
                )
            }

            if (typeof payload.fetchedBars === 'number') {
                parts.push(`fetched=${payload.fetchedBars}`)
            }

            if (typeof payload.persistedBars === 'number') {
                parts.push(`persisted=${payload.persistedBars}`)
            }

            if (typeof payload.dbTotalAfterChunk === 'number') {
                parts.push(`dbTotal=${payload.dbTotalAfterChunk}`)
            }

            if (Array.isArray(payload.warnings) && payload.warnings.length > 0) {
                parts.push(`warnings=${payload.warnings.join(' | ')}`)
            }

            return parts.join(' | ')
        }

        try {
            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                const chunk = decoder.decode(value)
                const lines = chunk.split('\n').filter(Boolean)
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line)
                        if (parsed.type === 'log') {
                            addLog(formatLog(parsed.data))
                        } else if (parsed.type === 'error') {
                            addLog(`[ERROR] ${formatLog(parsed.data)}`)
                        } else if (parsed.type === 'result') {
                            const persistedBars = typeof parsed.data?.persistedBars === 'number'
                                ? ` | Persisted: ${parsed.data.persistedBars}`
                                : ''
                            addLog(`[SUCCESS] ${successMsg} - Processed: ${parsed.data.processed}${persistedBars}`)
                        }
                    } catch {
                        // no-op
                    }
                }
            }
        } finally {
            setTimeout(() => {
                setIsIngestingProgress(false)
                setIngestLogs([])
            }, 10000)
            await Promise.all([fetchReports(), fetchTraffic(), fetchContinuousStatus()])
        }
    }

    const handleRefresh = useCallback(async () => {
        setRefreshing(true)
        try {
            const res = await fetch('/api/trading/data-health/refresh', { method: 'POST' })
            if (res.ok) {
                await fetchReports()
            }
        } catch (e) {
            console.error(e)
        } finally {
            setRefreshing(false)
        }
    }, [fetchReports])

    const handleGlobalIngest = useCallback(async () => {
        if (!confirm('Run a one-time ingestion sweep across the tracked universe? This can take several minutes.')) return

        setGlobalIngesting(true)
        try {
            const res = await fetch('/api/trading/ingest', { method: 'POST', body: JSON.stringify({}) })
            if (res.ok) {
                await processStream(res, 'Global Ingestion Sweep Complete.')
            } else {
                alert('Server returned an error for global ingestion.')
            }
        } catch (e: any) {
            console.error(e)
            alert(e.message || 'Failed to start global ingestion')
        } finally {
            setGlobalIngesting(false)
        }
    }, [fetchReports, fetchTraffic, fetchContinuousStatus])

    const handleSyncGaps = useCallback(async (symbol: string, timeframe: string, provider?: string) => {
        setSyncing(`${symbol}-${timeframe}`)
        try {
            const res = await fetch('/api/trading/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, overrideTimeframe: timeframe, provider })
            })

            if (res.ok) {
                await processStream(res, `Target ${symbol} Sync Complete.`)
                if (selectedAsset?.symbol === symbol) {
                    fetchInspect(symbol, timeframe)
                }
            } else {
                alert('Server returned an error for specific ingestion.')
            }
        } catch (e: any) {
            console.error(e)
            alert(e.message || 'Failed to sync gaps')
        } finally {
            setSyncing(null)
        }
    }, [selectedAsset])

    const fetchInspect = useCallback(async (symbol: string, timeframe: string, p: number = 1) => {
        setInspectLoading(true)
        try {
            const res = await fetch(`/api/trading/data-inspect?symbol=${symbol}&timeframe=${timeframe}&page=${p}`)
            const json = await res.json()

            setInspectData(json)
            setPage(p)
        } catch (e) {
            console.error(e)
        } finally {
            setInspectLoading(false)
        }
    }, [])

    const handleContinuousAction = useCallback(async (action: 'start' | 'stop') => {
        setContinuousBusy(true)
        try {
            const res = await fetch('/api/trading/continuous-ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action,
                    provider: continuousProviderOverride || undefined
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || `Failed to ${action} continuous ingestion`)
            }

            setContinuousStatus(data)
            await fetchTraffic()
        } catch (error: any) {
            alert(error.message || `Failed to ${action} continuous ingestion`)
        } finally {
            setContinuousBusy(false)
        }
    }, [continuousProviderOverride, fetchTraffic])

    const handleReset = useCallback(async (restartContinuous: boolean) => {
        const confirmMessage = restartContinuous
            ? 'This will delete all stored market data, clear inventory, and immediately restart continuous ingestion. Proceed?'
            : 'This will delete all stored market data and clear inventory. Proceed?'

        if (!confirm(confirmMessage)) return

        setResetting(true)
        try {
            const res = await fetch('/api/trading/data-reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    restartContinuous,
                    provider: selectedVault || continuousProviderOverride || undefined
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || 'Failed to reset data')
            }

            setSelectedAsset(null)
            setInspectData(null)
            setVerificationResult(null)
            setVerificationError(null)
            setContinuousStatus(data.continuousStatus)
            await Promise.all([fetchReports(), fetchTraffic()])
        } catch (error: any) {
            alert(error.message || 'Failed to reset data')
        } finally {
            setResetting(false)
        }
    }, [continuousProviderOverride, fetchReports, fetchTraffic])

    const handleVerify = useCallback(async () => {
        setVerifying(true)
        setVerificationError(null)
        setVerificationResult(null)

        try {
            const startTime = Math.floor(new Date(verifyForm.startTime).getTime() / 1000)
            const endTime = Math.floor(new Date(verifyForm.endTime).getTime() / 1000)

            const res = await fetch('/api/trading/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    symbol: verifyForm.symbol,
                    timeframe: verifyForm.timeframe,
                    primaryProvider: verifyForm.primaryProvider,
                    secondaryProvider: verifyForm.secondaryProvider,
                    startTime,
                    endTime
                })
            })

            const data = await res.json()
            if (!res.ok) {
                throw new Error(data.error || 'Verification failed')
            }

            setVerificationResult(data)
            await fetchTraffic()
        } catch (error: any) {
            setVerificationError(error.message || 'Verification failed')
        } finally {
            setVerifying(false)
        }
    }, [verifyForm, fetchTraffic])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        const symbol = params.get('symbol')
        const timeframe = params.get('timeframe') || undefined

        if (symbol) {
            const upper = symbol.toUpperCase()
            setSearch(upper)
            setInitialQuerySelection({ symbol: upper, timeframe })
            setVerifyForm((current) => ({ ...current, symbol: upper, timeframe: (timeframe as Timeframe) || current.timeframe }))
        }
    }, [])

    useEffect(() => {
        fetchVaults()
        fetchReports()
        fetchTraffic()
        fetchContinuousStatus()
    }, [fetchReports, fetchTraffic, fetchContinuousStatus, fetchVaults])

    useEffect(() => {
        if (!initialQuerySelection || reports.length === 0 || selectedAsset) return

        const target = reports.find((report) =>
            report.symbol === initialQuerySelection.symbol &&
            (!initialQuerySelection.timeframe || report.timeframe === initialQuerySelection.timeframe)
        )

        if (target) {
            setSelectedAsset({ symbol: target.symbol, timeframe: target.timeframe })
            fetchInspect(target.symbol, target.timeframe)
            setInitialQuerySelection(null)
        }
    }, [reports, initialQuerySelection, selectedAsset, fetchInspect])

    useEffect(() => {
        if (!selectedAsset) return
        setVerifyForm((current) => ({
            ...current,
            symbol: selectedAsset.symbol,
            timeframe: selectedAsset.timeframe as Timeframe
        }))
    }, [selectedAsset])

    useEffect(() => {
        const eventSource = new EventSource('/api/trading/provider-stream')

        eventSource.addEventListener('snapshot', (event) => {
            const payload = JSON.parse((event as MessageEvent).data)
            if (Array.isArray(payload.events)) {
                setProviderEvents(sortEvents(payload.events))
            }
        })

        eventSource.addEventListener('provider', (event) => {
            const payload = JSON.parse((event as MessageEvent).data) as ProviderEvent
            setProviderEvents((current) => sortEvents([...current, payload]).slice(-250))
        })

        eventSource.onerror = () => {
            eventSource.close()
        }

        return () => eventSource.close()
    }, [])

    useEffect(() => {
        const interval = window.setInterval(() => {
            fetchContinuousStatus()
        }, 10000)

        return () => window.clearInterval(interval)
    }, [fetchContinuousStatus])

    const filteredReports = reports.filter((report) =>
        report.symbol.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-white/40 text-xs uppercase tracking-widest animate-pulse">Scanning Data Subsystems...</p>
                </div>
            </div>
        )
    }

    const averageCoverage = reports.length > 0
        ? (reports.reduce((acc, report) => acc + (report.targetCoveragePercent || 0), 0) / reports.length).toFixed(1)
        : '0.0'

    return (
        <div className="min-h-screen bg-[#0d0e12] text-white flex flex-col">
            <header className="px-6 py-4 border-b border-white/5 bg-[#0d0e12]/80 backdrop-blur-xl sticky top-0 z-50">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <a href="/dashboard" className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </a>
                        <h1 className="text-xl font-bold tracking-tight">Data <span className="text-primary">Command</span></h1>
                        <div className="h-4 w-[1px] bg-white/10 mx-2" />
                        <p className="text-white/40 text-xs hidden md:block">Multi-Vault Data Architecture v2</p>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link
                            href="/data-doctor/logs"
                            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                        >
                            <div className={`w-2 h-2 rounded-full ${continuousStatus?.running ? 'bg-emerald-500 animate-pulse' : 'bg-white/20'}`} />
                            <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                                {continuousStatus?.running ? 'Live Ingestion active' : 'Continuous Idle'}
                            </span>
                        </Link>
                    </div>
                </div>
            </header>

            {!selectedAsset ? (
                <div className="flex-1 flex overflow-hidden">
                    {/* Vault Sidebar */}
                    <aside className="w-64 border-r border-white/5 flex flex-col bg-[#0b0c10]">
                        <div className="p-4 border-b border-white/5">
                            <h2 className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-4">Storage Vaults</h2>
                            <div className="flex flex-col gap-1">
                                {Array.isArray(vaults) && vaults.map(v => (
                                    <button
                                        key={v.id}
                                        onClick={() => {
                                            setSelectedVault(v.name)
                                            fetchReports(v.name)
                                        }}
                                        className={`flex items-center justify-between p-3 rounded-xl transition-all group ${selectedVault === v.name ? 'bg-primary/10 border border-primary/20 text-primary' : 'hover:bg-white/5 text-white/60 border border-transparent'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <Database className={`w-4 h-4 ${selectedVault === v.name ? 'text-primary' : 'text-white/20'}`} />
                                            <div className="flex flex-col items-start text-left">
                                                <span className="text-sm font-semibold capitalize">{v.name}</span>
                                                <span className="text-[10px] opacity-40 uppercase">{v.type}</span>
                                            </div>
                                        </div>
                                        {v._count?.inventories > 0 && (
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${selectedVault === v.name ? 'bg-primary/20 text-primary' : 'bg-white/5 text-white/40'}`}>
                                                {v._count.inventories}
                                            </span>
                                        )}
                                    </button>
                                ))}
                                {(!Array.isArray(vaults) || vaults.length === 0) && (
                                    <div className="p-4 text-center text-[10px] text-white/20 italic">No vaults available</div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 mt-auto">
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-white/40 mb-1">
                                    <Activity className="w-3.5 h-3.5 text-primary" />
                                    <span className="text-[10px] font-bold uppercase tracking-wider">Feed Status</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-xl font-bold">{providerEvents.length}</span>
                                    <span className="text-white/40 text-[10px]">LATEST</span>
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Main Work Area */}
                    <main className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
                        {/* Multi-Interval Heatmap Header */}
                        <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-6">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-bold mb-1">Global Health Heatmap</h3>
                                    <p className="text-white/40 text-xs">At-a-glance data coverage across all time intervals for current vault: <span className="text-primary font-bold uppercase">{selectedVault}</span></p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                                        <input
                                            type="text"
                                            placeholder="Filter assets..."
                                            value={search}
                                            onChange={(e) => setSearch(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-xs focus:outline-none focus:border-primary transition-colors"
                                        />
                                    </div>
                                    <button
                                        onClick={handleRefresh}
                                        disabled={refreshing}
                                        className={`p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all ${refreshing ? 'animate-spin opacity-50' : ''}`}
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {filteredReports.length === 0 ? (
                                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-2xl">
                                    <AlertCircle className="w-8 h-8 text-white/10 mb-3" />
                                    <p className="text-white/20 text-sm">No inventory found for this vault.</p>
                                    <p className="text-white/10 text-[10px] mt-2 italic">Run a scan or ingestion to populate.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filteredReports.map((report) => (
                                        <div key={`${report.symbol}-${report.timeframe}`} className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col gap-3 group hover:border-primary/20 transition-all">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-primary/10 rounded-lg group-hover:scale-110 transition-transform">
                                                        <Zap className="w-4 h-4 text-primary" />
                                                    </div>
                                                    <span className="font-bold text-lg">{report.symbol}</span>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <span className="text-[10px] text-white/40 uppercase font-bold tracking-wider">{report.timeframe}</span>
                                                    <div className="flex items-center gap-1.5">
                                                        <div className={`w-1.5 h-1.5 rounded-full ${report.healthScore > 90 ? 'bg-emerald-500' : report.healthScore > 70 ? 'bg-amber-500' : 'bg-rose-500'}`} />
                                                        <span className="text-sm font-mono font-bold">{report.healthScore}%</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Activity Bar Chart (Phase 12 Observability) */}
                                            <div className="flex flex-col gap-1.5 mt-2">
                                                <div className="flex justify-between items-center text-[9px] text-white/30 uppercase font-bold tracking-widest">
                                                    <span>{report.startIndex ? new Date(report.startIndex).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Genesis'}</span>
                                                    <span className={report.gaps?.length > 0 ? "text-rose-400" : "text-emerald-400"}>
                                                        {report.gaps?.length || 0} Gaps
                                                    </span>
                                                    <span>Present</span>
                                                </div>
                                                <div className="flex gap-0.5 h-4 items-end group-hover:gap-[1px] transition-all cursor-crosshair">
                                                    {Array.from({ length: 40 }).map((_, i) => {
                                                        const missingBlocks = 40 - Math.round((report.targetCoveragePercent / 100) * 40);
                                                        // We align identified gaps mathematically toward the left (older data) to represent the horizon
                                                        const isGap = i < missingBlocks;
                                                        return (
                                                            <div
                                                                key={i}
                                                                title={isGap ? 'Missing Telemetry Block' : 'Verified Yield'}
                                                                className={`flex-1 rounded-[1px] transition-all hover:bg-white ${isGap ? 'h-full bg-rose-500/80 shadow-[0_0_6px_rgba(244,63,94,0.4)]' : 'h-[60%] bg-emerald-500/30'}`}
                                                            />
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center mt-2 border-t border-white/5 pt-2">
                                                <span className="text-[10px] text-white/20 font-bold tracking-tighter uppercase">Pool: {report.count.toLocaleString()} BARS</span>
                                                <button
                                                    onClick={() => {
                                                        setSelectedAsset({ symbol: report.symbol, timeframe: report.timeframe })
                                                        setView('roadmap')
                                                    }}
                                                    className="text-[10px] font-bold text-primary hover:text-white transition-colors flex items-center gap-1"
                                                >
                                                    Inspection <ChevronRight className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* Provider Actions Panel */}
                        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                                    <CloudLightning className="w-4 h-4" /> Operations Control
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={handleGlobalIngest}
                                        disabled={globalIngesting}
                                        className="px-4 py-2 bg-primary/10 text-primary border border-primary/20 rounded-xl text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-2"
                                    >
                                        <RefreshCw className={`w-3.5 h-3.5 ${globalIngesting ? 'animate-spin' : ''}`} />
                                        Run Global Sync
                                    </button>
                                    <button
                                        disabled={continuousBusy}
                                        onClick={() => handleContinuousAction(continuousStatus?.running ? 'stop' : 'start')}
                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${continuousStatus?.running ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 hover:bg-emerald-500/20'}`}
                                    >
                                        {continuousStatus?.running ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                        {continuousStatus?.running ? 'Stop Continuous Ingest' : 'Start Continuous Ingest'}
                                    </button>
                                    <button
                                        onClick={() => setIsConsolidating(true)}
                                        className="px-4 py-2 bg-white/5 text-white/60 border border-white/10 rounded-xl text-xs font-bold hover:bg-white/10 transition-all flex items-center gap-2"
                                    >
                                        <Activity className="w-3.5 h-3.5 text-blue-400" />
                                        Consolidate & Verify
                                    </button>
                                </div>
                            </div>

                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4 flex items-center gap-2">
                                    <Trash2 className="w-4 h-4 text-rose-500" /> Danger Zone
                                </h3>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReset(false)}
                                        disabled={resetting}
                                        className="px-4 py-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-xl text-xs font-bold hover:bg-rose-500/20 transition-all"
                                    >
                                        Wipe Current Vault
                                    </button>
                                </div>
                            </div>
                        </section>

                        {/* Secondary Detail Views (Roadmap / Traffic) */}
                        <section className="flex flex-col gap-6">
                            <div className="flex items-center justify-between">
                                <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                                    <button
                                        onClick={() => { setView('traffic') }}
                                        className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'traffic' ? 'bg-white/10 text-white' : 'text-white/40'}`}
                                    >
                                        Live Traffic
                                    </button>
                                </div>
                            </div>

                            {view === 'traffic' && (
                                <div className="p-6 bg-white/5 border border-white/10 rounded-3xl flex flex-col gap-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-lg font-bold">Provider Live Traffic</h3>
                                        <div className="text-[10px] text-white/20 font-bold uppercase tracking-widest">
                                            Latest 250 Events
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                                        {providerEvents.map((event) => (
                                            <div key={event.id} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex flex-col gap-1.5 hover:bg-white/5 transition-colors">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-1.5 h-1.5 rounded-full ${event.kind === 'error' ? 'bg-rose-500' : event.kind === 'response' ? 'bg-emerald-500' : 'bg-primary'}`} />
                                                        <span className="text-[10px] font-bold uppercase text-white/60 tracking-tighter">{event.kind}</span>
                                                        <span className="text-[10px] text-white/20">|</span>
                                                        <span className="text-[10px] text-white/40 font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                                    </div>
                                                    <span className="text-[10px] font-bold uppercase text-primary/60">{event.provider}</span>
                                                </div>
                                                <p className="text-xs text-white/80 leading-relaxed">{event.message}</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    </main>
                </div>
            ) : (
                <main className="flex-1 overflow-y-auto p-8 flex flex-col gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedAsset(null)}
                            className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back to Command Center
                        </button>
                        <h2 className="text-2xl font-bold">{selectedAsset.symbol} <span className="text-white/20">/</span> {selectedAsset.timeframe}</h2>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <div className="lg:col-span-1 space-y-6">
                            <div className="glass-panel p-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-6 font-mono">Status</h3>
                                <div className="space-y-6">
                                    <StatItem icon={<Calendar className="w-4 h-4" />} label="Anchor Date" value={inspectData?.health.startIndex ? new Date(inspectData.health.startIndex).toLocaleDateString() : 'N/A'} />
                                    <StatItem icon={<Clock className="w-4 h-4" />} label="Latest Sync" value={inspectData?.health.endIndex ? new Date(inspectData.health.endIndex).toLocaleDateString() : 'N/A'} />
                                    <StatItem icon={<BarChart3 className="w-4 h-4" />} label="Bar Count" value={inspectData?.health.count?.toLocaleString() || '0'} />
                                    <StatItem icon={<Filter className="w-4 h-4" />} label="Missing Gaps" value={`${inspectData?.health.gaps.length || 0}`} />
                                </div>
                            </div>

                            <div className="glass-panel p-6 border-blue-500/20 bg-blue-500/5">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-blue-500/60 mb-4 flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4" /> Doctor Diagnostic
                                </h3>
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {inspectData?.health.gaps.map((gap: any, i: number) => (
                                        <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 text-[10px]">
                                            <div className="flex justify-between mb-1">
                                                <span className="text-white/40 font-mono">GAP: {gap.missingBars} BARS</span>
                                            </div>
                                            <div className="text-white/60">{new Date(gap.start).toLocaleString()} → {new Date(gap.end).toLocaleString()}</div>
                                        </div>
                                    ))}
                                    {(!inspectData?.health.gaps || inspectData.health.gaps.length === 0) && (
                                        <p className="text-xs text-emerald-400/60 text-center py-4 italic">No gaps detected. Data integrity is solid.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-3 flex flex-col gap-4">
                            <div className="glass-panel p-0 overflow-hidden flex flex-col min-h-[600px]">
                                <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center flex-wrap gap-4">
                                    <div className="flex items-center gap-4">
                                        <Table className="w-4 h-4 text-primary" />
                                        <span className="text-sm font-bold">Raw Market Candles</span>
                                    </div>

                                    <div className="flex items-center gap-2 flex-wrap">
                                        <select
                                            value={detailProviderOverride}
                                            onChange={(e) => setDetailProviderOverride(e.target.value)}
                                            className="bg-white/5 border border-white/10 rounded-lg text-xs py-1.5 px-3 text-white/60 focus:outline-none focus:border-primary"
                                        >
                                            <option value="">Auto Fallback (Best)</option>
                                            {providers.map((provider) => (
                                                <option key={`detail-${provider}`} value={provider}>{provider}</option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={() => handleSyncGaps(selectedAsset.symbol, selectedAsset.timeframe, detailProviderOverride || undefined)}
                                            disabled={!!syncing}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${syncing ? 'bg-white/5 text-white/20 border border-white/10' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20'}`}
                                        >
                                            <RefreshCw className={`w-3 h-3 ${syncing === `${selectedAsset.symbol}-${selectedAsset.timeframe}` ? 'animate-spin' : ''}`} />
                                            {syncing === `${selectedAsset.symbol}-${selectedAsset.timeframe}` ? 'Healing Gaps...' : 'Force Ingest'}
                                        </button>

                                        <button
                                            disabled={page === 1}
                                            onClick={() => fetchInspect(selectedAsset.symbol, selectedAsset.timeframe, page - 1)}
                                            className="p-1 hover:bg-white/10 disabled:opacity-20 rounded ml-2"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <span className="text-xs font-mono text-white/40">PAGE {page} / {inspectData?.pagination.totalPages || 1}</span>
                                        <button
                                            disabled={page === inspectData?.pagination.totalPages}
                                            onClick={() => fetchInspect(selectedAsset.symbol, selectedAsset.timeframe, page + 1)}
                                            className="p-1 hover:bg-white/10 disabled:opacity-20 rounded"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-x-auto">
                                    {inspectLoading ? (
                                        <div className="h-full flex items-center justify-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-8 h-8 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                <span className="text-[10px] text-white/20 uppercase tracking-widest font-bold">Loading Bars...</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <table className="w-full text-left text-xs">
                                            <thead className="sticky top-0 bg-[#16171d] text-white/40 uppercase font-mono text-[10px] border-b border-white/5">
                                                <tr>
                                                    <th className="px-6 py-4 font-bold">Timestamp</th>
                                                    <th className="px-6 py-4 font-bold">Open</th>
                                                    <th className="px-6 py-4 font-bold text-success/60">High</th>
                                                    <th className="px-6 py-4 font-bold text-destructive/60">Low</th>
                                                    <th className="px-6 py-4 font-bold">Close</th>
                                                    <th className="px-6 py-4 font-bold">Volume</th>
                                                    <th className="px-6 py-4 font-bold">Source</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {inspectData?.data.map((row: any) => (
                                                    <tr key={row.time} className="hover:bg-white/[0.02] transition-colors group">
                                                        <td className="px-6 py-4 font-mono text-white/40 group-hover:text-white transition-colors">{new Date(row.time * 1000).toLocaleString()}</td>
                                                        <td className="px-6 py-4 font-medium">${row.open.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-emerald-400">${row.high.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-rose-400">${row.low.toFixed(2)}</td>
                                                        <td className="px-6 py-4 font-bold">${row.close.toFixed(2)}</td>
                                                        <td className="px-6 py-4 text-white/20 group-hover:text-white/60">{row.volume.toLocaleString()}</td>
                                                        <td className="px-6 py-4 text-primary/70 uppercase">{row.source}</td>
                                                    </tr>
                                                ))}
                                                {(!inspectData?.data || inspectData.data.length === 0) && (
                                                    <tr>
                                                        <td colSpan={7} className="text-center py-24 text-white/20 italic font-mono uppercase">No data available for this range.</td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {isIngestingProgress && (
                <div className="fixed bottom-6 right-6 w-[460px] h-[320px] bg-black/95 border border-primary/30 rounded-lg p-4 font-mono text-[10px] text-primary/80 overflow-y-auto flex flex-col gap-1 z-[100] shadow-2xl shadow-primary/20 backdrop-blur-sm">
                    <div className="text-white font-bold mb-3 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary animate-pulse" /> Live Ingestion Feed
                    </div>
                    {ingestLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed opacity-80 break-words">&gt; {log}</div>
                    ))}
                </div>
            )}
        </div>
    )
}

function AcquisitionRoadmap({ reports, providers, onSync, syncing }: { reports: HealthReport[], providers: string[], onSync: (symbol: string, timeframe: string, provider?: string) => void, syncing: string | null }) {
    const targetSymbols = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'META', 'GOOGL', 'BTC-USD', 'ETH-USD', 'EURUSD=X', 'USDJPY=X', 'JPM', 'V', 'WMT', 'JNJ', 'TSLA', 'PG', 'HD', 'CVX', 'MRK', 'KO']
    const [providerOverrides, setProviderOverrides] = React.useState<Record<string, string>>({})

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <LucideTarget className="w-5 h-5 text-primary" /> Target Universe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in fade-in zoom-in-95 duration-500">
                {targetSymbols.map((symbol) => {
                    const has1d = reports.some((report) => report.symbol === symbol && report.timeframe === '1d')
                    const has1h = reports.some((report) => report.symbol === symbol && report.timeframe === '1h')
                    const hasData = has1d || has1h
                    const qualityReport = reports.find((report) => report.symbol === symbol && report.timeframe === '1d')
                    const isSyncing = syncing === `${symbol}-1d`

                    return (
                        <div key={symbol} className={`glass-panel p-4 flex flex-col gap-3 ${hasData ? 'border-primary/20' : 'border-dashed opacity-50'}`}>
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">{symbol}</span>
                                {hasData ? (
                                    <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 uppercase">
                                        <CheckCircle2 className="w-3 h-3" /> {qualityReport?.source || 'cached'}
                                    </div>
                                ) : (
                                    <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Awaiting Sync</div>
                                )}
                            </div>

                            {hasData ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-white/20">1D Quality</span>
                                        <span className={qualityReport && qualityReport.healthScore > 90 ? 'text-emerald-400' : 'text-amber-400'}>{qualityReport ? `${qualityReport.healthScore}%` : 'N/A'}</span>
                                    </div>
                                    <div className="text-[9px] text-white/40 truncate">{qualityReport?.startIndex ? new Date(qualityReport.startIndex).getFullYear() : 'N/A'} - {qualityReport?.endIndex ? new Date(qualityReport.endIndex).getFullYear() : 'N/A'}</div>
                                </div>
                            ) : (
                                <div className="text-[9px] text-white/20 italic">Not indexed across any intervals.</div>
                            )}

                            <div className="flex flex-col gap-2 mt-2">
                                <select
                                    value={providerOverrides[symbol] || ''}
                                    onChange={(e) => setProviderOverrides((current) => ({ ...current, [symbol]: e.target.value }))}
                                    className="bg-white/5 border border-white/10 rounded-md text-[9px] py-1 px-2 text-white/60 focus:outline-none w-full"
                                >
                                    <option value="">Auto Fallback</option>
                                    {providers.map((provider) => (
                                        <option key={`${symbol}-${provider}`} value={provider}>{provider}</option>
                                    ))}
                                </select>
                                <button
                                    onClick={() => onSync(symbol, '1d', providerOverrides[symbol] || undefined)}
                                    disabled={!!syncing}
                                    className={`w-full py-1.5 border border-white/5 rounded text-[10px] font-bold transition-colors uppercase tracking-widest flex items-center justify-center gap-2 ${syncing ? 'opacity-50' : 'hover:bg-primary/20 hover:text-primary'}`}
                                >
                                    {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
                                    {isSyncing ? 'Syncing...' : 'Bootstrap Data'}
                                </button>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function StatusCard({ icon, title, value, subtitle, accent }: { icon: React.ReactNode, title: string, value: string, subtitle: string, accent: 'primary' | 'emerald' | 'blue' | 'fuchsia' | 'slate' }) {
    const accentClasses = {
        primary: 'border-primary/20 bg-primary/5',
        emerald: 'border-emerald-500/20 bg-emerald-500/5',
        blue: 'border-blue-500/20 bg-blue-500/5',
        fuchsia: 'border-fuchsia-500/20 bg-fuchsia-500/5',
        slate: 'border-white/10 bg-white/5'
    }

    return (
        <div className={`glass-panel p-6 ${accentClasses[accent]}`}>
            <div className="flex items-center justify-between mb-4">
                <div className="text-sm font-bold uppercase tracking-widest text-white/40">{title}</div>
                {icon}
            </div>
            <div className="text-3xl font-bold text-white">{value}</div>
            <div className="text-xs text-white/40 mt-2">{subtitle}</div>
        </div>
    )
}

function Metric({ label, value }: { label: string, value: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">{label}</div>
            <div className="text-lg font-mono text-white/90">{value}</div>
        </div>
    )
}

function StatItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">{icon}</div>
            <div>
                <div className="text-[10px] font-bold text-white/20 uppercase tracking-widest">{label}</div>
                <div className="text-sm font-mono text-white/80">{value}</div>
            </div>
        </div>
    )
}


// End of file
