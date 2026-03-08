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
    Zap
} from 'lucide-react'
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
    return [...events].sort((left, right) => left.timestamp.localeCompare(right.timestamp))
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

    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [ingestLogs])

    useEffect(() => {
        if (trafficEndRef.current) {
            trafficEndRef.current.scrollIntoView({ behavior: 'smooth' })
        }
    }, [providerEvents])

    const fetchReports = useCallback(async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/trading/data-health')
            const data = await res.json()
            if (Array.isArray(data)) setReports(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
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
            currentLogs = [...currentLogs, msg]
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
                    provider: continuousProviderOverride || undefined
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
        fetchReports()
        fetchTraffic()
        fetchContinuousStatus()
    }, [fetchReports, fetchTraffic, fetchContinuousStatus])

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
        <div className="min-h-screen bg-[#0d0e12] text-white p-6 md:p-10">
            <header className="flex flex-col gap-6 mb-10">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-3">
                            <a href="/dashboard" className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                                <ArrowLeft className="w-4 h-4" />
                            </a>
                            <h1 className="text-3xl font-bold tracking-tight">Data <span className="text-primary">Command</span></h1>
                        </div>
                        <p className="text-white/40 text-sm max-w-3xl">Reset market data, run one-off or continuous ingestion, inspect persisted bars, and watch live provider traffic and verification checks from the same console.</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleGlobalIngest}
                            disabled={globalIngesting || continuousBusy}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${globalIngesting ? 'bg-white/5 text-white/20 border-white/10' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                        >
                            <Zap className={`w-4 h-4 ${globalIngesting ? 'animate-pulse' : ''}`} />
                            {globalIngesting ? 'Running Sweep...' : 'Run One Sweep'}
                        </button>
                        <button
                            onClick={() => handleContinuousAction('start')}
                            disabled={continuousBusy || continuousStatus?.running}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${continuousStatus?.running ? 'bg-white/5 text-white/20 border-white/10' : 'bg-blue-500/10 text-blue-400 border-blue-500/20 hover:bg-blue-500/20'}`}
                        >
                            <Play className="w-4 h-4" />
                            Start Continuous
                        </button>
                        <button
                            onClick={() => handleContinuousAction('stop')}
                            disabled={continuousBusy || !continuousStatus?.running}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${!continuousStatus?.running ? 'bg-white/5 text-white/20 border-white/10' : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'}`}
                        >
                            <Square className="w-4 h-4" />
                            Stop Continuous
                        </button>
                        <button
                            onClick={() => handleReset(false)}
                            disabled={resetting}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${resetting ? 'bg-white/5 text-white/20 border-white/10' : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'}`}
                        >
                            <Trash2 className="w-4 h-4" />
                            Clear Data
                        </button>
                        <button
                            onClick={() => handleReset(true)}
                            disabled={resetting}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${resetting ? 'bg-white/5 text-white/20 border-white/10' : 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20 hover:bg-fuchsia-500/20'}`}
                        >
                            <Radio className="w-4 h-4" />
                            Reset + Restart
                        </button>
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${refreshing ? 'bg-white/5 text-white/20 border-white/10' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'}`}
                        >
                            <Clock className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                            {refreshing ? 'Scanning...' : 'Scan Inventory'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col xl:flex-row xl:items-center gap-4 xl:justify-between">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
                        <button
                            onClick={() => { setView('summary') }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'summary' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Health Monitor
                        </button>
                        <button
                            onClick={() => { setView('roadmap'); setSelectedAsset(null) }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'roadmap' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Ingestion Targets
                        </button>
                        <button
                            onClick={() => { setView('traffic'); setSelectedAsset(null) }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'traffic' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Provider Traffic
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <select
                            value={continuousProviderOverride}
                            onChange={(e) => setContinuousProviderOverride(e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 text-sm text-white/70 focus:outline-none focus:border-primary"
                        >
                            <option value="">Continuous Provider: Auto</option>
                            {providers.map((provider) => (
                                <option key={provider} value={provider}>{provider}</option>
                            ))}
                        </select>
                        <div className="relative w-full md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                            <input
                                type="text"
                                placeholder="Search assets..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-primary transition-colors"
                            />
                        </div>
                    </div>
                </div>
            </header>

            {view === 'traffic' ? (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                        <StatusCard
                            icon={<Database className="w-5 h-5 text-primary" />}
                            title="Stored Records"
                            value={reports.reduce((acc, report) => acc + report.count, 0).toLocaleString()}
                            subtitle={`${reports.length} symbol/timeframe datasets`}
                            accent="primary"
                        />
                        <StatusCard
                            icon={<Radio className={`w-5 h-5 ${continuousStatus?.running ? 'text-emerald-400' : 'text-white/40'}`} />}
                            title="Continuous Engine"
                            value={continuousStatus?.running ? 'Running' : 'Stopped'}
                            subtitle={continuousStatus?.currentPhase || 'idle'}
                            accent={continuousStatus?.running ? 'emerald' : 'slate'}
                        />
                        <StatusCard
                            icon={<Activity className="w-5 h-5 text-blue-400" />}
                            title="Provider Events"
                            value={providerEvents.length.toLocaleString()}
                            subtitle={providerEvents.length > 0 ? `Latest: ${new Date(providerEvents[providerEvents.length - 1].timestamp).toLocaleTimeString()}` : 'No provider traffic yet'}
                            accent="blue"
                        />
                        <StatusCard
                            icon={<ShieldCheck className="w-5 h-5 text-fuchsia-400" />}
                            title="Verification"
                            value={verificationResult ? `${verificationResult.comparison.accuracyScore.toFixed(1)}%` : 'Idle'}
                            subtitle={verificationResult ? `${verificationResult.symbol} ${verificationResult.timeframe}` : 'Run a cross-provider check'}
                            accent="fuchsia"
                        />
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                        <div className="xl:col-span-1 space-y-6">
                            <div className="glass-panel p-6">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-4">Engine Status</h3>
                                <div className="space-y-4 text-sm">
                                    <div className="flex justify-between gap-4">
                                        <span className="text-white/40">Started</span>
                                        <span className="font-mono text-white/80">{continuousStatus?.startedAt ? new Date(continuousStatus.startedAt).toLocaleString() : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-white/40">Last Completed</span>
                                        <span className="font-mono text-white/80">{continuousStatus?.lastCompletedAt ? new Date(continuousStatus.lastCompletedAt).toLocaleString() : 'N/A'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-white/40">Cycles</span>
                                        <span className="font-mono text-white/80">{continuousStatus?.cycleCount ?? 0}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-white/40">Provider Override</span>
                                        <span className="font-mono text-white/80 uppercase">{continuousStatus?.providerOverride || 'auto'}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                        <span className="text-white/40">Interval</span>
                                        <span className="font-mono text-white/80">{Math.round((continuousStatus?.intervalMs || 0) / 1000)}s</span>
                                    </div>
                                    <div className="pt-3 border-t border-white/10">
                                        <div className="text-[10px] uppercase tracking-widest text-white/30 mb-2">Last Error</div>
                                        <div className="text-xs text-rose-300/80 min-h-[40px]">{continuousStatus?.lastError || 'None'}</div>
                                    </div>
                                </div>
                            </div>

                            <div className="glass-panel p-6 border-fuchsia-500/20 bg-fuchsia-500/5">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-fuchsia-400/70 mb-4">Verification</h3>
                                <div className="space-y-3">
                                    <input
                                        value={verifyForm.symbol}
                                        onChange={(e) => setVerifyForm((current) => ({ ...current, symbol: e.target.value.toUpperCase() }))}
                                        placeholder="Symbol"
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                    />
                                    <select
                                        value={verifyForm.timeframe}
                                        onChange={(e) => setVerifyForm((current) => ({ ...current, timeframe: e.target.value as Timeframe }))}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                    >
                                        {['1m', '5m', '15m', '30m', '1h', '1d', '1w', '1M'].map((timeframe) => (
                                            <option key={timeframe} value={timeframe}>{timeframe}</option>
                                        ))}
                                    </select>
                                    <div className="grid grid-cols-2 gap-3">
                                        <select
                                            value={verifyForm.primaryProvider}
                                            onChange={(e) => setVerifyForm((current) => ({ ...current, primaryProvider: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                        >
                                            {providers.map((provider) => (
                                                <option key={`primary-${provider}`} value={provider}>{provider}</option>
                                            ))}
                                        </select>
                                        <select
                                            value={verifyForm.secondaryProvider}
                                            onChange={(e) => setVerifyForm((current) => ({ ...current, secondaryProvider: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                        >
                                            {providers.map((provider) => (
                                                <option key={`secondary-${provider}`} value={provider}>{provider}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="grid grid-cols-1 gap-3">
                                        <input
                                            type="datetime-local"
                                            value={verifyForm.startTime}
                                            onChange={(e) => setVerifyForm((current) => ({ ...current, startTime: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                        />
                                        <input
                                            type="datetime-local"
                                            value={verifyForm.endTime}
                                            onChange={(e) => setVerifyForm((current) => ({ ...current, endTime: e.target.value }))}
                                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-fuchsia-400"
                                        />
                                    </div>
                                    <button
                                        onClick={handleVerify}
                                        disabled={verifying || providers.length < 2}
                                        className={`w-full py-2.5 rounded-lg text-sm font-bold border transition-all flex items-center justify-center gap-2 ${verifying ? 'bg-white/5 text-white/20 border-white/10' : 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/20 hover:bg-fuchsia-500/20'}`}
                                    >
                                        <ShieldCheck className={`w-4 h-4 ${verifying ? 'animate-pulse' : ''}`} />
                                        {verifying ? 'Verifying...' : 'Run Verification'}
                                    </button>
                                    {verificationError && (
                                        <div className="text-xs text-rose-300/80">{verificationError}</div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="xl:col-span-2 space-y-6">
                            <div className="glass-panel p-0 overflow-hidden min-h-[420px] flex flex-col">
                                <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center justify-between gap-4">
                                    <div>
                                        <div className="text-sm font-bold flex items-center gap-2"><Radio className="w-4 h-4 text-primary" /> Live Provider Traffic</div>
                                        <div className="text-[11px] text-white/40 mt-1">Request/response/error events streamed from Schwab, Yahoo, Alpha Vantage, and verification jobs.</div>
                                    </div>
                                    <div className="text-[10px] uppercase tracking-widest text-white/30">{providerEvents.length} events</div>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px]">
                                    {providerEvents.slice().reverse().map((event) => (
                                        <div key={event.id} className={`rounded-lg border p-3 ${event.kind === 'error' ? 'border-rose-500/20 bg-rose-500/5' : event.kind === 'verification' ? 'border-fuchsia-500/20 bg-fuchsia-500/5' : event.kind === 'control' ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/10 bg-white/[0.03]'}`}>
                                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                                                <div className="text-white/90">{event.message}</div>
                                                <div className="text-white/30">{new Date(event.timestamp).toLocaleString()}</div>
                                            </div>
                                            <div className="text-white/40 mb-2">{formatEventMeta(event)}</div>
                                            {event.request && (
                                                <pre className="text-white/30 whitespace-pre-wrap break-words">request: {JSON.stringify(event.request, null, 2)}</pre>
                                            )}
                                            {event.response && (
                                                <pre className="text-white/30 whitespace-pre-wrap break-words">response: {JSON.stringify(event.response, null, 2)}</pre>
                                            )}
                                        </div>
                                    ))}
                                    {providerEvents.length === 0 && (
                                        <div className="h-full flex items-center justify-center text-white/20 uppercase tracking-widest">No provider traffic captured yet.</div>
                                    )}
                                    <div ref={trafficEndRef} />
                                </div>
                            </div>

                            <div className="glass-panel p-6 border-fuchsia-500/20 bg-fuchsia-500/5">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-fuchsia-400/70 mb-4">Latest Verification Result</h3>
                                {verificationResult ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            <Metric label="Primary Bars" value={verificationResult.primaryCount.toLocaleString()} />
                                            <Metric label="Secondary Bars" value={verificationResult.secondaryCount.toLocaleString()} />
                                            <Metric label="Overlap" value={verificationResult.comparison.overlapCount.toLocaleString()} />
                                            <Metric label="Accuracy" value={`${verificationResult.comparison.accuracyScore.toFixed(1)}%`} />
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Metric label="Missing From Primary" value={verificationResult.comparison.missingFromPrimary.toLocaleString()} />
                                            <Metric label="Missing From Secondary" value={verificationResult.comparison.missingFromSecondary.toLocaleString()} />
                                            <Metric label="Max Close Diff" value={verificationResult.comparison.maxCloseDiff.toFixed(4)} />
                                        </div>
                                        <div className="border border-white/10 rounded-xl overflow-hidden">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-white/5 text-white/40 uppercase text-[10px]">
                                                    <tr>
                                                        <th className="px-4 py-3">Time</th>
                                                        <th className="px-4 py-3">Primary Close</th>
                                                        <th className="px-4 py-3">Secondary Close</th>
                                                        <th className="px-4 py-3">Close Diff</th>
                                                        <th className="px-4 py-3">Volume Diff</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {verificationResult.comparison.samples.map((sample) => (
                                                        <tr key={sample.time}>
                                                            <td className="px-4 py-3 font-mono text-white/50">{new Date(sample.time * 1000).toLocaleString()}</td>
                                                            <td className="px-4 py-3">{sample.primaryClose.toFixed(4)}</td>
                                                            <td className="px-4 py-3">{sample.secondaryClose.toFixed(4)}</td>
                                                            <td className="px-4 py-3 text-amber-300">{sample.closeDiff.toFixed(4)}</td>
                                                            <td className="px-4 py-3 text-amber-300">{sample.volumeDiff.toFixed(2)}</td>
                                                        </tr>
                                                    ))}
                                                    {verificationResult.comparison.samples.length === 0 && (
                                                        <tr>
                                                            <td colSpan={5} className="px-4 py-8 text-center text-white/30 uppercase tracking-widest">No mismatches sampled.</td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-sm text-white/40">No verification run yet.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ) : view === 'roadmap' ? (
                <div className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-2">
                        <div className="glass-panel p-6 border-primary/20 bg-primary/5 relative overflow-hidden">
                            <Activity className="absolute -right-4 -bottom-4 w-24 h-24 text-primary opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary/60 mb-2 relative z-10">Global Readiness</h3>
                            <div className="text-4xl font-bold text-white relative z-10">{averageCoverage}%</div>
                            <p className="text-xs text-white/40 mt-2 relative z-10 mb-2">Average horizon target coverage across {reports.length} tracked records.</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Total Records: {reports.reduce((acc, report) => acc + report.count, 0).toLocaleString()}</p>
                        </div>
                        <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
                            <CheckCircle2 className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500 opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500/60 mb-2 relative z-10">Fully Indexed</h3>
                            <div className="text-4xl font-bold text-emerald-400 relative z-10">
                                {reports.filter((report) => (report.targetCoveragePercent || 0) === 100).length} <span className="text-lg text-emerald-500/40">/ {reports.length}</span>
                            </div>
                            <p className="text-xs text-emerald-400/60 mt-2 relative z-10">Datasets meeting their configured history targets.</p>
                        </div>
                        <div className="glass-panel p-6 border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
                            <Radio className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-500/60 mb-2 relative z-10">Aggregator Engine</h3>
                            <div className="text-4xl font-bold text-blue-400 relative z-10">{continuousStatus?.running ? 'Active' : 'Stopped'}</div>
                            <p className="text-xs text-blue-400/60 mt-2 relative z-10">{continuousStatus?.currentPhase || 'Continuous ingestion not running.'}</p>
                        </div>
                    </div>
                    <AcquisitionRoadmap reports={reports} providers={providers} onSync={handleSyncGaps} syncing={syncing} />
                </div>
            ) : !selectedAsset ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="glass-panel p-6 border-primary/20 bg-primary/5 relative overflow-hidden">
                            <Activity className="absolute -right-4 -bottom-4 w-24 h-24 text-primary opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-primary/60 mb-2 relative z-10">Global Readiness</h3>
                            <div className="text-4xl font-bold text-white relative z-10">{averageCoverage}%</div>
                            <p className="text-xs text-white/40 mt-2 relative z-10 mb-2">Average horizon target coverage across {reports.length} tracked records.</p>
                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Total Records: {reports.reduce((acc, report) => acc + report.count, 0).toLocaleString()}</p>
                        </div>
                        <div className="glass-panel p-6 border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
                            <CheckCircle2 className="absolute -right-4 -bottom-4 w-24 h-24 text-emerald-500 opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-emerald-500/60 mb-2 relative z-10">Fully Indexed</h3>
                            <div className="text-4xl font-bold text-emerald-400 relative z-10">
                                {reports.filter((report) => (report.targetCoveragePercent || 0) === 100).length} <span className="text-lg text-emerald-500/40">/ {reports.length}</span>
                            </div>
                            <p className="text-xs text-emerald-400/60 mt-2 relative z-10">Tracking timelines meeting 100% of their historical targets.</p>
                        </div>
                        <div className="glass-panel p-6 border-blue-500/20 bg-blue-500/5 relative overflow-hidden">
                            <Radio className="absolute -right-4 -bottom-4 w-24 h-24 text-blue-500 opacity-10" />
                            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-500/60 mb-2 relative z-10">Aggregator Engine</h3>
                            <div className="text-4xl font-bold text-blue-400 relative z-10">{continuousStatus?.running ? 'Active' : 'Stopped'}</div>
                            <p className="text-xs text-blue-400/60 mt-2 relative z-10">{continuousStatus?.currentPhase || 'Continuous ingestion not running.'}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
                        {filteredReports.map((report) => (
                            <div
                                key={`${report.symbol}-${report.timeframe}`}
                                onClick={() => {
                                    setSelectedAsset({ symbol: report.symbol, timeframe: report.timeframe })
                                    fetchInspect(report.symbol, report.timeframe)
                                }}
                                className="glass-panel p-6 cursor-pointer hover:border-primary/40 transition-all group relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                                    <Activity className="w-24 h-24" />
                                </div>
                                <div className="flex justify-between items-start mb-6 relative z-10">
                                    <div>
                                        <h3 className="text-xl font-bold">{report.symbol}</h3>
                                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-2 py-0.5 bg-primary/10 rounded">{report.timeframe}</span>
                                    </div>
                                    <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${report.healthScore > 90 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                        {report.healthScore > 90 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                        {report.healthScore}%
                                    </div>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Continuity Health</span>
                                        <span className={`font-medium ${report.healthScore > 90 ? 'text-emerald-400' : 'text-amber-400'}`}>{report.healthScore}%</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Provider</span>
                                        <span className="font-mono text-primary/80 uppercase tracking-tighter">{report.source || 'Unknown'}</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-white/40">Internal Gaps</span>
                                        <span className={`font-bold ${report.gaps?.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>{report.gaps?.length || 0}</span>
                                    </div>
                                    <div className="pt-2">
                                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest text-white/40 mb-1">
                                            <span>Target Horizon</span>
                                            <span className={(report.targetCoveragePercent || 0) === 100 ? 'text-indigo-400' : 'text-primary'}>{report.targetCoveragePercent || 0}%</span>
                                        </div>
                                        <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden relative">
                                            <div
                                                className={`absolute top-0 left-0 h-full transition-all duration-1000 ${(report.targetCoveragePercent || 0) === 100 ? 'bg-indigo-500' : 'bg-primary'}`}
                                                style={{ width: `${Math.min(report.targetCoveragePercent || 0, 100)}%` }}
                                            />
                                        </div>
                                        <div className="mt-2 text-[8px] text-white/20 uppercase tracking-widest flex justify-between">
                                            <span>{report.startIndex ? new Date(report.startIndex).getFullYear() : 'N/A'} - {report.endIndex ? new Date(report.endIndex).getFullYear() : 'N/A'}</span>
                                            <span>Bars: {report.count.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {filteredReports.length === 0 && (
                            <div className="col-span-full py-24 text-center text-white/20 font-bold uppercase tracking-widest">
                                No data found. Try syncing a target.
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSelectedAsset(null)}
                            className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm"
                        >
                            <ChevronLeft className="w-4 h-4" /> Back to Monitor
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
                                        <span className="text-xs font-mono text-white/40">PAGE {page} / {inspectData?.pagination.totalPages}</span>
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
                </div>
            )}

            {isIngestingProgress && (
                <div className="fixed bottom-6 right-6 w-[460px] h-[320px] bg-black/95 border border-primary/30 rounded-lg p-4 font-mono text-[10px] text-primary/80 overflow-y-auto flex flex-col gap-1 z-50 shadow-2xl shadow-primary/20 backdrop-blur-sm">
                    <div className="text-white font-bold mb-3 uppercase tracking-widest border-b border-white/10 pb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-primary animate-pulse" /> Live Ingestion Feed
                    </div>
                    {ingestLogs.map((log, i) => (
                        <div key={i} className="leading-relaxed opacity-80 break-words">&gt; {log}</div>
                    ))}
                    <div ref={terminalEndRef} />
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
                <TargetIcon className="w-5 h-5 text-primary" /> Target Universe
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

const TargetIcon = (props: React.SVGProps<SVGSVGElement>) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2" />
    </svg>
)
