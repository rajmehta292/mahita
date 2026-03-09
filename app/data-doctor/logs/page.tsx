'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, Activity, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface TelemetryEvent {
    id: string
    timestamp: string
    kind: 'request' | 'response' | 'error' | 'verification' | 'control'
    provider?: string
    symbol?: string
    timeframe?: string
    rangeStart?: number
    rangeEnd?: number
    message: string
    request?: any
    response?: any
}

export default function LogsViewerPage() {
    const [events, setEvents] = useState<TelemetryEvent[]>([])
    const [loading, setLoading] = useState(true)
    const [autoScroll, setAutoScroll] = useState(true)
    const [selectedEvent, setSelectedEvent] = useState<TelemetryEvent | null>(null)
    const [retrying, setRetrying] = useState(false)
    const [providerHealth, setProviderHealth] = useState<{ tokenStatus: string, tokenError: string | null, throttleQueueSize: number, throttledSymbols: string[] } | null>(null)

    const handleForceRetry = async (evt: TelemetryEvent) => {
        if (!evt.symbol || !evt.timeframe) return
        setRetrying(true)
        try {
            await fetch('/api/trading/continuous-ingest/run-sweep', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: [evt.symbol], timeframes: [evt.timeframe] })
            })
            setSelectedEvent(null)
            fetchLogs() // Force an immediate manual refresh
        } catch (error) {
            console.error('Failed to dispatch retry sweep:', error)
        } finally {
            setRetrying(false)
        }
    }

    const fetchLogs = async () => {
        try {
            const [logsRes, healthRes] = await Promise.all([
                fetch('/api/trading/provider-traffic'),
                fetch('/api/trading/provider-health')
            ])

            if (logsRes.ok) {
                const data = await logsRes.json()
                setEvents(data.events || [])
            }
            if (healthRes.ok) {
                const hData = await healthRes.json()
                setProviderHealth(hData)
            }
        } catch (error) {
            console.error('Failed to stream provider telemetry:', error)
        } finally {
            setLoading(false)
        }
    }

    // Auto-poll every 2 seconds
    useEffect(() => {
        fetchLogs()
        const interval = setInterval(fetchLogs, 2000)
        return () => clearInterval(interval)
    }, [])

    const getKindBadge = (kind: string) => {
        switch (kind) {
            case 'request':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/20 text-blue-400 border border-blue-500/20 uppercase tracking-widest">REQ</span>
            case 'response':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 uppercase tracking-widest">RES</span>
            case 'error':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/20 uppercase tracking-widest">ERR</span>
            case 'control':
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/20 text-purple-400 border border-purple-500/20 uppercase tracking-widest">SYS</span>
            default:
                return <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-white/10 text-white/60 border border-white/10 uppercase tracking-widest">{kind}</span>
        }
    }

    const formatTime = (isoString: string) => {
        const date = new Date(isoString)
        return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.' + date.getMilliseconds().toString().padStart(3, '0')
    }

    const renderDetails = (event: TelemetryEvent) => {
        if (event.kind === 'response' && event.response) {
            return (
                <div className="flex items-center gap-3 text-xs">
                    <span className="text-white/40">{event.response.durationMs}ms</span>
                    <span className={event.response.bars > 0 ? "text-emerald-400 font-medium" : "text-amber-400 font-medium"}>
                        {event.response.bars} bars
                    </span>
                </div>
            )
        }

        if (event.kind === 'error' && event.response?.error) {
            return (
                <button
                    onClick={() => setSelectedEvent(event)}
                    className="flex items-center gap-2 px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-md border border-red-500/20 transition-colors"
                >
                    <span className="text-xs font-mono truncate max-w-[120px]">{String(event.response.error)}</span>
                    <span className="text-[10px] uppercase bg-red-500/20 px-1.5 py-0.5 rounded">Inspect</span>
                </button>
            )
        }

        if (event.kind === 'control' && event.response?.totalProcessed !== undefined) {
            return (
                <div className="flex gap-4 text-xs">
                    <span className="text-white/60">Batch: {event.response.totalProcessed}</span>
                    <span className="text-emerald-400">Yield: {event.response.totalPersisted} saved</span>
                </div>
            )
        }

        return <span className="text-white/20">-</span>
    }

    return (
        <div className="min-h-screen bg-[#0b0c10] text-white flex flex-col font-sans">
            {/* Header */}
            <header className="px-6 py-4 border-b border-white/5 bg-[#0d0e12]/80 backdrop-blur-xl sticky top-0 z-50 flex justify-between items-center">
                <div className="flex items-center gap-4">
                    <Link href="/data-doctor" className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                            Provider <span className="text-primary">Telemetry</span>
                        </h1>
                    </div>
                    <div className="h-4 w-[1px] bg-white/10 mx-2" />
                    <p className="text-white/40 text-xs hidden md:block">Live Ingestion Streaming Viewer</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setAutoScroll(!autoScroll)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-2 ${autoScroll ? 'bg-primary/20 border-primary/30 text-primary' : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'}`}
                    >
                        {autoScroll ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
                        {autoScroll ? 'Auto-Scrolling' : 'Scroll Locked'}
                    </button>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg">
                        <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
                        <span className="text-[10px] font-medium text-white/60 uppercase tracking-wider">
                            {loading ? 'Connecting...' : 'Live Stream'}
                        </span>
                    </div>
                </div>
            </header>

            {/* Terminal View */}
            <main className="flex-1 overflow-auto p-6 flex flex-col items-center">

                {/* Global Health Widget */}
                <div className="w-full max-w-[1400px] mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
                        <span className="text-white/40 text-xs uppercase tracking-widest font-medium mb-1 relative flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${providerHealth?.tokenStatus === 'active' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                            Schwab OAuth Status
                        </span>
                        <span className="text-white text-lg font-mono">
                            {providerHealth?.tokenStatus === 'active' ? 'Authorized' : 'HALTED'}
                        </span>
                        {providerHealth?.tokenError && <span className="text-red-400 text-xs mt-1 truncate">{providerHealth.tokenError}</span>}
                    </div>

                    <div className="bg-white/5 border border-amber-500/20 rounded-xl p-4 flex flex-col">
                        <span className="text-amber-500/70 text-xs uppercase tracking-widest font-medium mb-1">
                            Throttle Queue
                        </span>
                        <div className="flex items-end justify-between">
                            <span className="text-amber-400 text-lg font-mono">
                                {providerHealth?.throttleQueueSize || 0} <span className="text-amber-500/50 text-sm">blocked symbols</span>
                            </span>
                        </div>
                        {providerHealth?.throttleQueueSize ? (
                            <span className="text-white/40 text-[10px] mt-1 pr-1 truncate">Waiting on rolling window ({providerHealth.throttledSymbols.slice(0, 3).join(',')}{providerHealth.throttleQueueSize > 3 ? '...' : ''})</span>
                        ) : null}
                    </div>

                    <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col">
                        <span className="text-white/40 text-xs uppercase tracking-widest font-medium mb-1">
                            Engine Velocity
                        </span>
                        <span className="text-white text-lg font-mono">
                            {events.filter(e => e.kind === 'response').length} <span className="text-white/30 text-sm">yields / tick</span>
                        </span>
                    </div>
                </div>

                <div className="flex flex-col gap-1 w-full max-w-[1400px] mx-auto">
                    {events.length === 0 && !loading && (
                        <div className="py-20 text-center flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl bg-white/5">
                            <Activity className="w-8 h-8 text-white/20 mb-3" />
                            <p className="text-white/40">No ingestion events found in memory buffer.</p>
                            <p className="text-white/20 text-xs mt-1">Start a sweep from Data Command to see live traffic.</p>
                        </div>
                    )}

                    {/* Events render reversed for log tailing */}
                    {events.slice().reverse().map((evt, idx) => (
                        <div key={evt.id || idx} className="grid grid-cols-[120px_60px_160px_1fr_200px] gap-4 items-center px-4 py-2.5 hover:bg-white/[0.02] border-b border-white/5 hover:border-white/10 transition-colors rounded-lg group text-sm font-mono">
                            {/* Timestamp */}
                            <div className="text-white/30 text-xs tracking-wider">
                                {formatTime(evt.timestamp)}
                            </div>

                            {/* Kind Badge */}
                            <div>
                                {getKindBadge(evt.kind)}
                            </div>

                            {/* Context (Provider / Symbol) */}
                            <div className="flex flex-col">
                                {evt.symbol ? (
                                    <span className="text-white/80 font-bold">{evt.symbol} <span className="text-white/30 font-normal">@ {evt.timeframe || '-'}</span></span>
                                ) : (
                                    <span className="text-white/20 italic text-xs">System</span>
                                )}
                                <span className="text-white/40 text-[10px] uppercase tracking-widest mt-0.5">{evt.provider || 'Core'}</span>
                            </div>

                            {/* Message */}
                            <div className="text-white/70 truncate pr-4" title={evt.message}>
                                {evt.message}
                            </div>

                            {/* Details / Metrics */}
                            <div className="flex justify-end pr-2">
                                {renderDetails(evt)}
                            </div>
                        </div>
                    ))}
                </div>
            </main>

            {/* Inspect JSON Modal */}
            {selectedEvent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-[#12141a] border border-white/10 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col overflow-hidden">
                        <div className="flex justify-between items-center p-4 border-b border-white/5 bg-white/[0.02]">
                            <h3 className="font-bold text-white flex items-center gap-2">
                                <span className="text-red-400">Error Trace</span>
                                {selectedEvent.symbol} <span className="text-white/40 font-normal">@ {selectedEvent.timeframe}</span>
                            </h3>
                            <button onClick={() => setSelectedEvent(null)} className="text-white/40 hover:text-white transition-colors">
                                ✕
                            </button>
                        </div>

                        <div className="p-4 overflow-auto max-h-[60vh] flex flex-col gap-4">
                            <div className="bg-black/50 p-4 rounded-lg font-mono text-xs text-red-300 whitespace-pre-wrap border border-red-500/10">
                                {JSON.stringify(selectedEvent.response, null, 2)}
                            </div>

                            <div className="break-words text-sm text-white/70 bg-white/5 p-3 rounded-lg border border-white/10">
                                <strong className="text-white/90">Message:</strong> {selectedEvent.message}
                            </div>

                            <div className="text-xs text-white/40 flex flex-wrap items-center gap-4">
                                <div className="flex flex-col gap-1">
                                    <span className="uppercase text-[10px] tracking-wider text-white/30">Timestamp</span>
                                    <span>{formatTime(selectedEvent.timestamp)}</span>
                                </div>
                                <div className="flex flex-col gap-1">
                                    <span className="uppercase text-[10px] tracking-wider text-white/30">Trace ID</span>
                                    <span>{selectedEvent.id}</span>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-white/5 bg-white/[0.02] flex justify-end gap-3">
                            <button onClick={() => setSelectedEvent(null)} className="px-4 py-2 text-sm font-medium text-white/60 hover:text-white transition-colors">
                                Dismiss
                            </button>
                            <button
                                onClick={() => handleForceRetry(selectedEvent)}
                                disabled={retrying || !selectedEvent.symbol || !selectedEvent.timeframe}
                                className="px-4 py-2 text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                            >
                                {retrying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
                                Force Retry Sequence
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
