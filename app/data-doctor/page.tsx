'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
    Activity, ArrowLeft, AlertCircle, CheckCircle2, Search, Table, Filter,
    ChevronLeft, ChevronRight, Calendar, BarChart3, Clock, LayoutGrid, RefreshCw, Zap
} from 'lucide-react'
import { HealthReport } from '../services/market-data/health'

export default function DataDoctorPage() {
    const [reports, setReports] = useState<HealthReport[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'summary' | 'roadmap'>('summary')
    const [selectedAsset, setSelectedAsset] = useState<{ symbol: string, timeframe: string } | null>(null)
    const [inspectData, setInspectData] = useState<any>(null)
    const [inspectLoading, setInspectLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [refreshing, setRefreshing] = useState(false)
    const [syncing, setSyncing] = useState<string | null>(null)
    const [globalIngesting, setGlobalIngesting] = useState(false)

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
        if (!confirm('This will trigger a massive background sweep to download S&P 500, Crypto, and Forex data to repair gaps. It may take several minutes and hit rate limits. Proceed?')) return;

        setGlobalIngesting(true)
        try {
            const res = await fetch('/api/trading/ingest', { method: 'POST', body: JSON.stringify({}) })
            const data = await res.json()
            if (res.ok) {
                alert(`Ingestion triggered successfully! Prosessed ${data.processed} actions.`)
                await fetchReports()
            } else {
                alert(data.error || 'Failed to start global ingestion')
            }
        } catch (e) {
            console.error(e)
            alert('Failed to start global ingestion')
        } finally {
            setGlobalIngesting(false)
        }
    }, [fetchReports])

    const handleSyncGaps = useCallback(async (symbol: string, timeframe: string) => {
        setSyncing(`${symbol}-${timeframe}`)
        try {
            const res = await fetch('/api/trading/ingest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, overrideTimeframe: timeframe })
            })
            const data = await res.json()
            if (res.ok) {
                alert('Symbol synchronization sweep complete.')
                if (selectedAsset?.symbol === symbol) {
                    fetchInspect(symbol, timeframe)
                }
                await fetchReports()
            } else {
                alert(data.error || 'Failed to sync gaps')
            }
        } catch (e) {
            console.error(e)
            alert('Failed to sync gaps')
        } finally {
            setSyncing(null)
        }
    }, [fetchReports])

    const fetchInspect = useCallback(async (symbol: string, timeframe: string, p: number = 1) => {
        setInspectLoading(true)
        try {
            const res = await fetch(`/api/trading/data-inspect?symbol=${symbol}&timeframe=${timeframe}&page=${p}`)
            const data = await res.json()
            setInspectData(data)
            setPage(p)
        } catch (e) {
            console.error(e)
        } finally {
            setInspectLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchReports()
    }, [fetchReports])

    const filteredReports = reports.filter(r =>
        r.symbol.toLowerCase().includes(search.toLowerCase())
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

    return (
        <div className="min-h-screen bg-[#0d0e12] text-white p-6 md:p-10">
            {/* Header */}
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-12">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <a href="/dashboard" className="p-2 bg-white/5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors">
                            <ArrowLeft className="w-4 h-4" />
                        </a>
                        <h1 className="text-3xl font-bold tracking-tight">Data <span className="text-primary">Doctor</span></h1>
                    </div>
                    <p className="text-white/40 text-sm">Visualize gaps, run background ingestion, and monitor multi-provider dataset health.</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={handleGlobalIngest}
                        disabled={globalIngesting}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${globalIngesting ? 'bg-white/5 text-white/20 border-white/10' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'}`}
                    >
                        <Zap className={`w-4 h-4 ${globalIngesting ? 'animate-pulse text-emerald-500' : ''}`} />
                        {globalIngesting ? 'Ingesting Universe...' : 'Run Global Ingestion'}
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className={`px-4 py-2.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-2 ${refreshing ? 'bg-white/5 text-white/20 border-white/10' : 'bg-primary/10 text-primary border-primary/20 hover:bg-primary/20'}`}
                    >
                        <Clock className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                        {refreshing ? 'Scanning...' : 'Scan Inventory'}
                    </button>
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
                        <button
                            onClick={() => { setView('summary'); setSelectedAsset(null); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'summary' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Health Monitor
                        </button>
                        <button
                            onClick={() => { setView('roadmap'); setSelectedAsset(null); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'roadmap' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Ingestion Targets
                        </button>
                    </div>
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
            </header>

            {!selectedAsset ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {filteredReports.map((report, idx) => (
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
                                <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${report.healthScore > 90 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                    }`}>
                                    {report.healthScore > 90 ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                    {report.healthScore}%
                                </div>
                            </div>

                            <div className="space-y-4 relative z-10">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Total Bars</span>
                                    <span className="font-medium text-white/80">{report.count.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Source</span>
                                    <span className="font-mono text-primary/80 uppercase tracking-tighter">{report.source || 'Unknown'}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Gaps Detected</span>
                                    <span className={`font-bold ${report.gaps?.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {report.gaps?.length || 0}
                                    </span>
                                </div>
                                <div className="pt-2">
                                    <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full transition-all duration-1000 ${report.healthScore > 90 ? 'bg-emerald-500' : 'bg-amber-500'
                                                }`}
                                            style={{ width: `${report.healthScore}%` }}
                                        />
                                    </div>
                                    {report.lastSynced && (
                                        <div className="mt-2 text-[8px] text-white/20 uppercase tracking-widest text-right">
                                            Scanned: {new Date(report.lastSynced).toLocaleTimeString()}
                                        </div>
                                    )}
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

                    {view === 'summary' ? (
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                            {/* Stats Sidebar */}
                            <div className="lg:col-span-1 space-y-6">
                                <div className="glass-panel p-6">
                                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-6 font-mono">Status</h3>
                                    <div className="space-y-6">
                                        <StatItem icon={<Calendar className="w-4 h-4" />} label="Anchor Date" value={inspectData?.health.startIndex ? new Date(inspectData.health.startIndex).toLocaleDateString() : 'N/A'} />
                                        <StatItem icon={<Clock className="w-4 h-4" />} label="Latest Sync" value={inspectData?.health.endIndex ? new Date(inspectData.health.endIndex).toLocaleDateString() : 'N/A'} />
                                        <StatItem icon={<BarChart3 className="w-4 h-4" />} label="Bar Count" value={inspectData?.health.count.toLocaleString() || '0'} />
                                        <StatItem icon={<Filter className="w-4 h-4" />} label="Missing Gaps" value={inspectData?.health.gaps.length || '0'} />
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
                                                <div className="text-white/60">
                                                    {new Date(gap.start).toLocaleString()} → {new Date(gap.end).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                        {(!inspectData?.health.gaps || inspectData.health.gaps.length === 0) && (
                                            <p className="text-xs text-emerald-400/60 text-center py-4 italic">No gaps detected. Data integrity is solid.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Data Table */}
                            <div className="lg:col-span-3 flex flex-col gap-4">
                                <div className="glass-panel p-0 overflow-hidden flex flex-col min-h-[600px]">
                                    <div className="p-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                                        <div className="flex items-center gap-4">
                                            <Table className="w-4 h-4 text-primary" />
                                            <span className="text-sm font-bold">Raw Market Candles</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleSyncGaps(selectedAsset.symbol, selectedAsset.timeframe)}
                                                disabled={!!syncing}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${syncing ? 'bg-white/5 text-white/20 border border-white/10' : 'bg-blue-500/10 text-blue-500 border border-blue-500/20 hover:bg-blue-500/20'}`}
                                            >
                                                <RefreshCw className={`w-3 h-3 ${syncing === `${selectedAsset.symbol}-${selectedAsset.timeframe}` ? 'animate-spin' : ''}`} />
                                                {syncing === `${selectedAsset.symbol}-${selectedAsset.timeframe}` ? 'Healing Gaps...' : 'Trigger Auto-Heal'}
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
                                                        </tr>
                                                    ))}
                                                    {(!inspectData?.data || inspectData.data.length === 0) && (
                                                        <tr>
                                                            <td colSpan={6} className="text-center py-24 text-white/20 italic font-mono uppercase">
                                                                No data available for this range.
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <AcquisitionRoadmap reports={reports} onSync={handleSyncGaps} syncing={syncing} />
                    )}
                </div>
            )}
        </div>
    )
}

function AcquisitionRoadmap({ reports, onSync, syncing }: { reports: HealthReport[], onSync: (s: string, t: string) => void, syncing: string | null }) {
    // Top dynamically generated from universe
    const dow30 = ["AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "BTC-USD", "ETH-USD", "EURUSD=X", "USDJPY=X", "JPM", "V", "WMT", "JNJ", "TSLA", "PG", "HD", "CVX", "MRK", "KO"]

    return (
        <div className="space-y-6">
            <h3 className="text-xl font-bold flex items-center gap-2">
                <TargetIcon className="w-5 h-5 text-primary" /> Target Universe
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in fade-in zoom-in-95 duration-500">
                {dow30.map(symbol => {
                    const has1d = reports.some(r => r.symbol === symbol && r.timeframe === '1d')
                    const has1h = reports.some(r => r.symbol === symbol && r.timeframe === '1h')
                    const hasData = has1d || has1h
                    const qualityReport = reports.find(r => r.symbol === symbol && r.timeframe === '1d')
                    const isSyncing = syncing === `${symbol}-1d`

                    return (
                        <div key={symbol} className={`glass-panel p-4 flex flex-col gap-3 ${hasData ? 'border-primary/20' : 'border-dashed opacity-50'}`}>
                            <div className="flex justify-between items-center">
                                <span className="text-lg font-bold">{symbol}</span>
                                {hasData ? (
                                    <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 uppercase">
                                        <CheckCircle2 className="w-3 h-3" /> {qualityReport?.source || 'Cached'}
                                    </div>
                                ) : (
                                    <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Awaiting Sync</div>
                                )}
                            </div>

                            {hasData ? (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-[10px]">
                                        <span className="text-white/20">1D Quality</span>
                                        <span className={qualityReport && qualityReport.healthScore > 90 ? 'text-emerald-400' : 'text-amber-400'}>
                                            {qualityReport ? `${qualityReport.healthScore}%` : 'N/A'}
                                        </span>
                                    </div>
                                    <div className="text-[9px] text-white/40 truncate">
                                        {qualityReport?.startIndex ? new Date(qualityReport.startIndex).getFullYear() : 'N/A'} - {qualityReport?.endIndex ? new Date(qualityReport.endIndex).getFullYear() : 'N/A'}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[9px] text-white/20 italic">
                                    Not indexed across any intervals.
                                </div>
                            )}

                            <button
                                onClick={() => onSync(symbol, '1d')}
                                disabled={!!syncing}
                                className={`mt-2 w-full py-1.5 border border-white/5 rounded text-[10px] font-bold transition-colors uppercase tracking-widest flex items-center justify-center gap-2 ${syncing ? 'opacity-50' : 'hover:bg-primary/20 hover:text-primary'}`}
                            >
                                {isSyncing && <RefreshCw className="w-3 h-3 animate-spin" />}
                                {isSyncing ? 'Syncing...' : 'Bootstrap Data'}
                            </button>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function StatItem({ icon, label, value }: { icon: React.ReactNode, label: string, value: string }) {
    return (
        <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                {icon}
            </div>
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
