'use client'

import { type ReactNode, useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    BarChart3,
    Newspaper,
    Star,
    Clock,
    Zap,
    ChevronDown
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SchwabGating } from '../components/SchwabGating'
import { AlphaInsightsWidget } from '../components/AI/AlphaInsightsWidget'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { parseStoredStringArray } from '@/lib/preferences-serialization'
import { resolveHydratedAccountId } from '@/lib/account-selection'

interface QuoteSnapshot {
    symbol: string
    price: number
    change: number
    changePercent: number
    name?: string
}

interface SchwabAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
        type: string
    }
}

interface DashboardAccountSummary {
    accountId: string
    accountKey: string
    type: string
    displayName: string
    cashAndCashInvestments: number
    accountValue: number
    dayChange: number
    dayChangePercent: number
    positionsCount: number
    holdingsMarketValue: number
    totalCostBasis: number
    totalUnrealizedGainLoss: number
}

interface DashboardTotals {
    cashAndCashInvestments: number
    accountValue: number
    dayChange: number
    dayChangePercent: number
    holdingsMarketValue: number
    totalCostBasis: number
    totalUnrealizedGainLoss: number
    positionsCount: number
}

interface NewsItem {
    title: string
    source: string
    time: string
    sentiment: 'positive' | 'negative' | 'neutral'
    link?: string
}

interface MetricCardProps {
    label: string
    value: string
    icon: ReactNode
    sub: string
    trendColor?: string
}

export default function DashboardPage() {
    const router = useRouter()
    const { preferences, updatePreferences } = useUserPreferences()

    // State for Account Management
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<SchwabAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')

    // State for Metrics
    const [systemRunning, setSystemRunning] = useState<boolean>(false)
    const [accountSummaries, setAccountSummaries] = useState<DashboardAccountSummary[]>([])
    const [summaryTotals, setSummaryTotals] = useState<DashboardTotals | null>(null)
    const [summaryUpdatedAt, setSummaryUpdatedAt] = useState<string | null>(null)

    // State for Widgets
    const [marketMovers, setMarketMovers] = useState<QuoteSnapshot[]>([])
    const [news, setNews] = useState<NewsItem[]>([])
    const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'])
    const [watchlistQuotes, setWatchlistQuotes] = useState<QuoteSnapshot[]>([])

    const selectedAccountSummary = accountSummaries.find(
        (account) => account.accountKey === selectedAccount || account.accountId === selectedAccount
    ) || null

    const fetchDashboardData = useCallback(async () => {
        if (!connected) return
        try {
            // 1. Fetch account summaries
            const accountSummaryResponse = await fetch('/api/schwab/account-summaries')
            const accountSummaryData = await accountSummaryResponse.json()
            if (accountSummaryData.success && accountSummaryData.accounts?.length > 0) {
                const summaries = accountSummaryData.accounts as DashboardAccountSummary[]
                setAccountSummaries(summaries)
                setSummaryTotals(accountSummaryData.totals ?? null)
                setSummaryUpdatedAt(accountSummaryData.updatedAt ?? null)
                setAccounts(
                    summaries.map((summary) => ({
                        securitiesAccount: {
                            accountId: summary.accountId,
                            hashValue: summary.accountKey,
                            type: summary.type,
                        },
                    }))
                )
            } else if (accountSummaryData.success) {
                setAccountSummaries([])
                setSummaryTotals(accountSummaryData.totals ?? null)
                setSummaryUpdatedAt(accountSummaryData.updatedAt ?? null)
                setAccounts([])
            }

            // 2. News
            const newsRes = await fetch('/api/trading/news')
            const newsData = await newsRes.json()
            if (newsData.success) setNews(newsData.news || [])

            // 3. System Status
            const sysRes = await fetch('/api/platform/runtime-status')
            const sysData = await sysRes.json()
            setSystemRunning(!!sysData.runtime?.dataPipeline?.running)

            // 4. Market Movers
            const moversRes = await fetch('/api/trading/quotes?symbols=SPY,QQQ,AAPL,MSFT,NVDA,TSLA,AMZN,META')
            const moversData = await moversRes.json()
            if (moversData.success && moversData.quotes) {
                const sorted = (moversData.quotes as QuoteSnapshot[])
                    .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
                    .slice(0, 6)
                setMarketMovers(sorted)
            }
        } catch (e) {
            console.warn("Dashboard error", e)
        }
    }, [connected])

    useEffect(() => {
        if (connected) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            void fetchDashboardData()
        }
        const timer = setInterval(() => { if (connected) fetchDashboardData() }, 60000)
        return () => clearInterval(timer)
    }, [connected, fetchDashboardData])

    useEffect(() => {
        if (accounts.length === 0) {
            return
        }

        const localPreference = localStorage.getItem('mahita_default_account')
        const preferredAccountId = preferences?.selectedAccountId || localPreference
        const nextAccountId = resolveHydratedAccountId(
            accounts,
            selectedAccount,
            preferredAccountId
        )

        if (nextAccountId && nextAccountId !== selectedAccount) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedAccount(nextAccountId)
        }
    }, [accounts, preferences?.selectedAccountId, selectedAccount])

    useEffect(() => {
        if (!selectedAccount) {
            return
        }

        localStorage.setItem('mahita_default_account', selectedAccount)
        if (preferences?.selectedAccountId === selectedAccount) {
            return
        }

        updatePreferences({ selectedAccountId: selectedAccount }).catch((preferenceError) => {
            console.warn('Failed to persist account preference:', preferenceError)
        })
    }, [preferences?.selectedAccountId, selectedAccount, updatePreferences])

    // Watchlist Management
    useEffect(() => {
        const preferenceSymbols = parseStoredStringArray(preferences?.watchlistSymbols)
        if (preferenceSymbols.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSymbols(preferenceSymbols)
            return
        }

        const saved = localStorage.getItem('mahita_watchlist')
        if (saved) {
            try {
                setSymbols(JSON.parse(saved))
            } catch {
                // fall back to defaults
            }
        }
    }, [preferences?.watchlistSymbols])

    useEffect(() => {
        if (symbols.length === 0) return
        const fetchQuotes = async () => {
            const res = await fetch(`/api/trading/quotes?symbols=${symbols.join(',')}`)
            const data = await res.json()
            if (data.success) setWatchlistQuotes(data.quotes)
        }
        fetchQuotes()
        const timer = setInterval(fetchQuotes, 10000)
        return () => clearInterval(timer)
    }, [symbols])

    return (
        <MainLayout>
            <SchwabGating onStateChange={setConnected}>
                <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                    {/* Header */}
                    <div className="h-20 bg-[#1E222D]/80 backdrop-blur-md border-b border-[#2A2E39] flex items-center justify-between px-8 shrink-0 z-30">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <BarChart3 className="w-5 h-5 text-white" />
                                </div>
                                <h1 className="text-white font-black text-xl tracking-tight hidden sm:block">Dashboard</h1>
                            </div>

                            <div className="h-8 w-px bg-[#2A2E39] mx-2 hidden sm:block"></div>

                            <div className="relative group">
                                <select
                                    value={selectedAccount}
                                    onChange={(e) => setSelectedAccount(e.target.value)}
                                    className="bg-[#131722] text-white text-xs font-bold px-4 py-2.5 rounded-xl border border-[#2A2E39] focus:outline-none focus:border-blue-500 appearance-none pr-10 hover:border-blue-500/50 transition-all cursor-pointer shadow-inner"
                                >
                                    {accounts.map((acc) => (
                                        <option key={acc.securitiesAccount.accountId} value={acc.securitiesAccount.hashValue || acc.securitiesAccount.accountId}>
                                            ...{acc.securitiesAccount.accountId.slice(-4)} ({acc.securitiesAccount.type})
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" />
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-gray-500">
                            <Clock className="w-4 h-4" />
                            <span className="text-[10px] font-black uppercase tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-8 bg-gradient-to-b from-[#131722] to-[#0D0F14]">
                        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
                            {/* Matrix Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <MetricCard
                                    label="Selected Account Value"
                                    value={selectedAccountSummary ? `$${selectedAccountSummary.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                    icon={<DollarSign className="w-4 h-4" />}
                                    sub={selectedAccountSummary ? selectedAccountSummary.displayName : 'Select account'}
                                />
                                <MetricCard
                                    label="Cash & Cash Investments"
                                    value={selectedAccountSummary ? `$${selectedAccountSummary.cashAndCashInvestments.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                    icon={<Activity className="w-4 h-4" />}
                                    sub="Selected Account Liquidity"
                                />
                                <MetricCard
                                    label="Day Change"
                                    value={selectedAccountSummary ? (selectedAccountSummary.dayChange >= 0 ? `+$${selectedAccountSummary.dayChange.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : `-$${Math.abs(selectedAccountSummary.dayChange).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`) : '---'}
                                    icon={<TrendingUp className="w-4 h-4" />}
                                    sub={selectedAccountSummary ? `${selectedAccountSummary.dayChangePercent >= 0 ? '+' : ''}${selectedAccountSummary.dayChangePercent.toFixed(2)}% intraday` : 'Selected account'}
                                    trendColor={selectedAccountSummary ? (selectedAccountSummary.dayChange >= 0 ? 'text-emerald-500' : 'text-rose-500') : ''}
                                />
                                <MetricCard
                                    label="System Status"
                                    value={systemRunning ? 'Active' : 'Idle'}
                                    icon={<Zap className="w-4 h-4" />}
                                    sub={selectedAccountSummary ? `${selectedAccountSummary.positionsCount} positions tracked` : 'Data Ingestion'}
                                    trendColor={systemRunning ? 'text-emerald-500' : 'text-gray-500'}
                                />
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl shadow-2xl overflow-hidden">
                                <div className="px-8 py-5 border-b border-[#2A2E39] bg-white/[0.02] flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-widest text-white">Summary</h3>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {summaryUpdatedAt
                                                ? `Updated: ${new Date(summaryUpdatedAt).toLocaleString([], {
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    second: '2-digit',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    year: 'numeric',
                                                })}`
                                                : 'Waiting for account summary sync'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">All Accounts</div>
                                        <div className="text-2xl font-black tracking-tighter text-white">
                                            {summaryTotals ? `$${summaryTotals.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                        </div>
                                        <div className={`text-xs font-bold ${summaryTotals ? (summaryTotals.dayChange >= 0 ? 'text-emerald-500' : 'text-rose-500') : 'text-gray-500'}`}>
                                            {summaryTotals
                                                ? `${summaryTotals.dayChange >= 0 ? '+' : '-'}$${Math.abs(summaryTotals.dayChange).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })} (${summaryTotals.dayChangePercent >= 0 ? '+' : ''}${summaryTotals.dayChangePercent.toFixed(2)}%)`
                                                : 'No totals available'}
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 px-8 py-6 border-b border-[#2A2E39]">
                                    <SummaryStat
                                        label="Selected Value"
                                        value={selectedAccountSummary ? `$${selectedAccountSummary.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                    />
                                    <SummaryStat
                                        label="Selected Cash"
                                        value={selectedAccountSummary ? `$${selectedAccountSummary.cashAndCashInvestments.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                    />
                                    <SummaryStat
                                        label="Holdings Market Value"
                                        value={selectedAccountSummary ? `$${selectedAccountSummary.holdingsMarketValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                    />
                                    <SummaryStat
                                        label="Unrealized Gain / Loss"
                                        value={selectedAccountSummary ? `${selectedAccountSummary.totalUnrealizedGainLoss >= 0 ? '+' : '-'}$${Math.abs(selectedAccountSummary.totalUnrealizedGainLoss).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}` : '---'}
                                        tone={selectedAccountSummary ? (selectedAccountSummary.totalUnrealizedGainLoss >= 0 ? 'positive' : 'negative') : 'neutral'}
                                    />
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                        <thead className="bg-[#131722] text-gray-500 uppercase text-[10px] tracking-[0.2em]">
                                            <tr>
                                                <th className="px-8 py-4 text-left">Account</th>
                                                <th className="px-6 py-4 text-right">Cash & Cash Investments</th>
                                                <th className="px-6 py-4 text-right">Account Value</th>
                                                <th className="px-6 py-4 text-right">Day Change $</th>
                                                <th className="px-6 py-4 text-right">Day Change %</th>
                                                <th className="px-6 py-4 text-right">Positions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {accountSummaries.map((summary) => {
                                                const isSelected =
                                                    summary.accountKey === selectedAccount ||
                                                    summary.accountId === selectedAccount

                                                return (
                                                    <tr
                                                        key={summary.accountKey}
                                                        className={`border-t border-[#2A2E39] transition-colors cursor-pointer ${isSelected ? 'bg-blue-500/10' : 'hover:bg-white/[0.02]'
                                                            }`}
                                                        onClick={() => setSelectedAccount(summary.accountKey)}
                                                    >
                                                        <td className="px-8 py-4">
                                                            <div className="text-white font-semibold">{summary.displayName}</div>
                                                            <div className="text-xs text-gray-500">
                                                                Account ending in {summary.accountId.slice(-4)} • {summary.type}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-white">
                                                            ${summary.cashAndCashInvestments.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="px-6 py-4 text-right font-mono text-white">
                                                            ${summary.accountValue.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-mono ${summary.dayChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {summary.dayChange >= 0 ? '+' : '-'}${Math.abs(summary.dayChange).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
                                                        </td>
                                                        <td className={`px-6 py-4 text-right font-mono ${summary.dayChangePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {summary.dayChangePercent >= 0 ? '+' : ''}{summary.dayChangePercent.toFixed(2)}%
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-white">{summary.positionsCount}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                {/* Left Column: Market Dynamics */}
                                <div className="lg:col-span-2 space-y-8">
                                    {/* Market Movers */}
                                    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl shadow-2xl overflow-hidden">
                                        <div className="px-8 py-5 border-b border-[#2A2E39] flex items-center justify-between bg-white/[0.02]">
                                            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                                                <TrendingUp className="w-5 h-5 text-blue-500" />
                                                Market Catalysts
                                            </h3>
                                        </div>
                                        <div className="p-8">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                {marketMovers.map(mover => (
                                                    <MoverCard key={mover.symbol} mover={mover} />
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* News Stream */}
                                    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl shadow-2xl overflow-hidden">
                                        <div className="px-8 py-5 border-b border-[#2A2E39] flex items-center bg-white/[0.02]">
                                            <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-3">
                                                <Newspaper className="w-5 h-5 text-blue-500" />
                                                Alpha Intelligence
                                            </h3>
                                        </div>
                                        <div className="p-8 space-y-4">
                                            {news.slice(0, 5).map((item, i) => (
                                                <NewsRow key={i} item={item} />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Insight & Watchlist */}
                                <div className="space-y-8">
                                    {/* Real AI Insights Widget */}
                                    <AlphaInsightsWidget accountId={selectedAccount} />

                                    {/* Watchlist Quickview */}
                                    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl p-8 shadow-2xl">
                                        <h3 className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-6 flex justify-between items-center">
                                            Active Watchlist
                                            <Star className="w-4 h-4 text-blue-500" />
                                        </h3>
                                        <div className="space-y-4">
                                            {watchlistQuotes.slice(0, 6).map(quote => (
                                                <div key={quote.symbol} className="flex justify-between items-center group cursor-pointer" onClick={() => router.push(`/portfolio`)}>
                                                    <div>
                                                        <div className="text-white font-bold text-sm tracking-tight group-hover:text-blue-500 transition-colors">{quote.symbol}</div>
                                                        <div className="text-[10px] text-gray-500 font-bold uppercase">{quote.name?.slice(0, 20)}</div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-white font-black text-xs">${quote.price?.toFixed(2)}</div>
                                                        <div className={`text-[10px] font-bold ${quote.changePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            {quote.changePercent >= 0 ? '+' : ''}{quote.changePercent?.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <Link href="/watchlist" className="mt-8 block w-full py-3 bg-[#131722] border border-[#2A2E39] rounded-xl text-center text-gray-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-white hover:border-blue-500/50 transition-all">
                                            Manage Watchlist
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SchwabGating>
        </MainLayout>
    )
}

function MetricCard({ label, value, icon, sub, trendColor = 'text-white' }: MetricCardProps) {
    return (
        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 hover:border-blue-500/30 transition-all shadow-xl group cursor-pointer">
            <div className="flex justify-between items-center mb-4">
                <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{label}</span>
                <div className="w-8 h-8 rounded-lg bg-[#131722] flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                    {icon}
                </div>
            </div>
            <div className={`text-2xl font-black tracking-tighter ${trendColor} mb-1`}>{value}</div>
            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">{sub}</div>
        </div>
    )
}

function SummaryStat({
    label,
    value,
    tone = 'neutral',
}: {
    label: string
    value: string
    tone?: 'positive' | 'negative' | 'neutral'
}) {
    const toneClass =
        tone === 'positive'
            ? 'text-emerald-500'
            : tone === 'negative'
                ? 'text-rose-500'
                : 'text-white'

    return (
        <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] px-5 py-4">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">{label}</div>
            <div className={`mt-2 text-xl font-black tracking-tight ${toneClass}`}>{value}</div>
        </div>
    )
}

function MoverCard({ mover }: { mover: QuoteSnapshot }) {
    const isUp = mover.change >= 0
    return (
        <div className="flex items-center justify-between p-4 bg-[#131722] rounded-2xl border border-[#2A2E39] hover:border-blue-500/20 transition-all group cursor-pointer">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-xs border ${isUp ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'}`}>
                    {mover.symbol.slice(0, 2)}
                </div>
                <div>
                    <div className="text-white font-bold text-sm tracking-tight">{mover.symbol}</div>
                    <div className="text-gray-500 text-[10px] font-bold uppercase tracking-wider">${mover.price.toFixed(2)}</div>
                </div>
            </div>
            <div className="text-right">
                <div className={`text-sm font-black tracking-tighter ${isUp ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isUp ? '+' : ''}{mover.changePercent.toFixed(2)}%
                </div>
                <div className="flex items-center justify-end gap-1 opacity-50">
                    {isUp ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    <span className="text-[10px] font-bold uppercase tracking-tighter">Day Δ</span>
                </div>
            </div>
        </div>
    )
}

function NewsRow({ item }: { item: NewsItem }) {
    return (
        <a href={item.link} target="_blank" rel="noopener" className="flex items-start justify-between gap-4 p-4 bg-[#131722] rounded-2xl border border-[#2A2E39] hover:border-blue-500/20 transition-all group">
            <div className="flex-1">
                <h4 className="text-white font-bold text-sm leading-snug group-hover:text-blue-500 transition-colors mb-2">{item.title}</h4>
                <div className="flex items-center gap-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    <span>{item.source}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-700" />
                    <span>{item.time}</span>
                </div>
            </div>
            <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${item.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                item.sentiment === 'negative' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' :
                    'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                }`}>
                {item.sentiment}
            </div>
        </a>
    )
}
