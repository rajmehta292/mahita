'use client'

import { useState, useEffect, useCallback } from 'react'
import { Activity, ArrowLeft, AlertCircle, CheckCircle2, Search, Table, Filter, ChevronLeft, ChevronRight, Calendar, BarChart3, Clock, LayoutGrid } from 'lucide-react'
import { HealthReport } from '../services/market-data/health'

export default function DataHealthPage() {
    const [reports, setReports] = useState<HealthReport[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'summary' | 'roadmap'>('summary')
    const [selectedAsset, setSelectedAsset] = useState<{ symbol: string, timeframe: string } | null>(null)
    const [inspectData, setInspectData] = useState<any>(null)
    const [inspectLoading, setInspectLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)

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
                    <p className="text-white/40 text-xs uppercase tracking-widest animate-pulse">Scanning Datasets...</p>
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
                        <h1 className="text-3xl font-bold tracking-tight">Data <span className="text-primary">Health</span></h1>
                    </div>
                    <p className="text-white/40 text-sm">Monitor integrity and coverage of your financial datasets.</p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mr-4">
                        <button
                            onClick={() => { setView('summary'); setSelectedAsset(null); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'summary' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Health Summary
                        </button>
                        <button
                            onClick={() => { setView('roadmap'); setSelectedAsset(null); }}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${view === 'roadmap' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'}`}
                        >
                            Acquisition Roadmap
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
                            className="glass-panel p-6 cursor-pointer hover:border-primary/40 transition-all groups"
                        >
                            <div className="flex justify-between items-start mb-6">
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

                            <div className="space-y-4">
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Total Bars</span>
                                    <span className="font-medium text-white/80">{report.count.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-white/40">Gaps Detected</span>
                                    <span className={`font-bold ${report.gaps.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                        {report.gaps.length}
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
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-left-4 duration-500">
                    {view === 'summary' ? (
                        <>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setSelectedAsset(null)}
                                    className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-sm"
                                >
                                    <ChevronLeft className="w-4 h-4" /> Back to Summary
                                </button>
                                <h2 className="text-2xl font-bold">{selectedAsset.symbol} <span className="text-white/20">/</span> {selectedAsset.timeframe}</h2>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                {/* Stats Sidebar */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="glass-panel p-6">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-white/40 mb-6 font-mono">Status</h3>
                                        <div className="space-y-6">
                                            <StatItem icon={<Calendar className="w-4 h-4" />} label="Start Date" value={inspectData?.health.startIndex ? new Date(inspectData.health.startIndex).toLocaleDateString() : 'N/A'} />
                                            <StatItem icon={<Clock className="w-4 h-4" />} label="End Date" value={inspectData?.health.endIndex ? new Date(inspectData.health.endIndex).toLocaleDateString() : 'N/A'} />
                                            <StatItem icon={<BarChart3 className="w-4 h-4" />} label="Bar Count" value={inspectData?.health.count.toLocaleString() || '0'} />
                                            <StatItem icon={<Filter className="w-4 h-4" />} label="Gap Count" value={inspectData?.health.gaps.length || '0'} />
                                        </div>
                                    </div>

                                    <div className="glass-panel p-6 border-amber-500/20 bg-amber-500/5">
                                        <h3 className="text-sm font-bold uppercase tracking-widest text-amber-500/60 mb-4 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" /> Identified Gaps
                                        </h3>
                                        <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                            {inspectData?.health.gaps.map((gap: any, i: number) => (
                                                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/5 text-[10px]">
                                                    <div className="flex justify-between mb-1">
                                                        <span className="text-white/40 font-mono">MISSING {gap.missingBars} BARS</span>
                                                    </div>
                                                    <div className="text-white/60">
                                                        {new Date(gap.start).toLocaleString()} → {new Date(gap.end).toLocaleString()}
                                                    </div>
                                                </div>
                                            ))}
                                            {(!inspectData?.health.gaps || inspectData.health.gaps.length === 0) && (
                                                <p className="text-xs text-emerald-400/60 text-center py-4 italic">No gaps detected in time series.</p>
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
                                                    disabled={page === 1}
                                                    onClick={() => fetchInspect(selectedAsset.symbol, selectedAsset.timeframe, page - 1)}
                                                    className="p-1 hover:bg-white/10 disabled:opacity-20 rounded"
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
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <AcquisitionRoadmap reports={reports} />
                    )}
                </div>
            )}
        </div>
    )
}

function AcquisitionRoadmap({ reports }: { reports: HealthReport[] }) {
    const dow30 = ["AAPL", "AMGN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS", "GS", "HD", "HON", "IBM", "INTC", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK", "MSFT", "NKE", "PG", "TRV", "UNH", "V", "VZ", "WBA", "WMT"]

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 animate-in fade-in zoom-in-95 duration-500">
            {dow30.map(symbol => {
                const hasData = reports.some(r => r.symbol === symbol)
                const qualityReport = reports.find(r => r.symbol === symbol && r.timeframe === '1d')

                return (
                    <div key={symbol} className={`glass-panel p-4 flex flex-col gap-3 ${hasData ? 'border-primary/20' : 'border-dashed opacity-50'}`}>
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-bold">{symbol}</span>
                            {hasData ? (
                                <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 uppercase">
                                    <CheckCircle2 className="w-3 h-3" /> Cached
                                </div>
                            ) : (
                                <div className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Missing</div>
                            )}
                        </div>

                        {hasData ? (
                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px]">
                                    <span className="text-white/20">Data Quality</span>
                                    <span className={qualityReport && qualityReport.healthScore > 90 ? 'text-emerald-400' : 'text-amber-400'}>
                                        {qualityReport ? `${qualityReport.healthScore}%` : 'Check Sub-intervals'}
                                    </span>
                                </div>
                                <div className="text-[9px] text-white/40 truncate">
                                    {qualityReport?.startIndex ? new Date(qualityReport.startIndex).getFullYear() : 'N/A'} - {qualityReport?.endIndex ? new Date(qualityReport.endIndex).getFullYear() : 'N/A'}
                                </div>
                            </div>
                        ) : (
                            <div className="text-[9px] text-white/20 italic">
                                Ready for ingestion via Schwab/Yahoo interface.
                            </div>
                        )}

                        {!hasData && (
                            <button className="mt-2 w-full py-1.5 border border-white/5 rounded text-[10px] font-bold hover:bg-white/5 transition-colors uppercase tracking-widest">
                                Queue Sync
                            </button>
                        )}
                    </div>
                )
            })}
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
