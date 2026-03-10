'use client'

import { useState, useEffect, useCallback } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    BarChart3,
    Newspaper,
    Brain,
    Star,
    Clock,
    AlertCircle,
    ArrowUpRight,
    ArrowDownRight,
    Zap,
    RefreshCw,
    Target,
    ArrowRight
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { SchwabGating } from '../components/SchwabGating'
import { AlphaInsightsWidget } from '../components/AI/AlphaInsightsWidget'

interface MarketMover {
    symbol: string
    price: number
    change: number
    changePercent: number
}

interface NewsItem {
    title: string
    source: string
    time: string
    sentiment: 'positive' | 'negative' | 'neutral'
    link?: string
}

export default function DashboardPage() {
    const router = useRouter()

    // State for Account Management
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<any[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')

    // State for Metrics
    const [accountValue, setAccountValue] = useState<number | null>(null)
    const [dayPnL, setDayPnL] = useState<number | null>(null)
    const [systemRunning, setSystemRunning] = useState<boolean>(false)
    const [loading, setLoading] = useState(false)

    // State for Widgets
    const [marketMovers, setMarketMovers] = useState<MarketMover[]>([])
    const [news, setNews] = useState<NewsItem[]>([])
    const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'])
    const [watchlistQuotes, setWatchlistQuotes] = useState<any[]>([])
    const [aiInsights, setAiInsights] = useState<any[]>([
        { text: 'Monitoring market liquidity and asset flow...', confidence: 64 },
    ])

    const fetchDashboardData = useCallback(async () => {
        if (!connected) return
        setLoading(true)
        try {
            // 1. Fetch Accounts if needed
            if (accounts.length === 0) {
                const accRes = await fetch('/api/schwab/accounts')
                const accData = await accRes.json()
                if (accData.success && accData.accounts?.length > 0) {
                    setAccounts(accData.accounts)
                    const saved = localStorage.getItem('mahita_default_account')
                    if (saved && accData.accounts.some((a: any) => (a.securitiesAccount.hashValue || a.securitiesAccount.accountId) === saved)) {
                        setSelectedAccount(saved)
                    } else {
                        const first = accData.accounts[0].securitiesAccount
                        setSelectedAccount(first.hashValue || first.accountId)
                    }
                }
            }

            // 2. Fetch Account Specific Stats
            if (selectedAccount) {
                const posRes = await fetch(`/api/schwab/positions?accountId=${selectedAccount}`)
                const posData = await posRes.json()
                if (posData.success && posData.balance) {
                    setAccountValue(posData.balance.liquidationValue || 0)
                    setDayPnL(posData.balance.netChange || 0)
                }
            }

            // 3. News
            const newsRes = await fetch('/api/trading/news')
            const newsData = await newsRes.json()
            if (newsData.success) setNews(newsData.news || [])

            // 4. System Status
            const sysRes = await fetch('/api/trading/continuous-ingest')
            const sysData = await sysRes.json()
            setSystemRunning(!!sysData.isRunning)

            // 5. Market Movers
            const moversRes = await fetch('/api/trading/quotes?symbols=SPY,QQQ,AAPL,MSFT,NVDA,TSLA,AMZN,META')
            const moversData = await moversRes.json()
            if (moversData.success && moversData.quotes) {
                const sorted = moversData.quotes.sort((a: any, b: any) => Math.abs(b.changePercent) - Math.abs(a.changePercent)).slice(0, 6)
                setMarketMovers(sorted)

                // Dynamic Insight Sample
                if (sorted[0]?.changePercent > 1.5) {
                    setAiInsights([
                        { text: `${sorted[0].symbol} breakout detected with significant volume growth.`, confidence: 88 },
                        { text: 'Overall market momentum looks highly supportive.', confidence: 75 }
                    ])
                }
            }
        } catch (e) {
            console.error("Dashboard error", e)
        } finally {
            setLoading(false)
        }
    }, [connected, selectedAccount, accounts.length])

    useEffect(() => {
        if (connected) fetchDashboardData()
        const timer = setInterval(() => { if (connected) fetchDashboardData() }, 60000)
        return () => clearInterval(timer)
    }, [connected, fetchDashboardData])

    useEffect(() => {
        if (selectedAccount) localStorage.setItem('mahita_default_account', selectedAccount)
    }, [selectedAccount])

    // Watchlist Management
    useEffect(() => {
        const saved = localStorage.getItem('mahita_watchlist')
        if (saved) try { setSymbols(JSON.parse(saved)) } catch (e) { }
    }, [])

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
                                    {accounts.map((acc: any) => (
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
                                    label="Portfolio Liquidity"
                                    value={accountValue !== null ? `$${accountValue.toLocaleString()}` : '---'}
                                    icon={<DollarSign className="w-4 h-4" />}
                                    sub="Schwab Real-time"
                                />
                                <MetricCard
                                    label="Day P&L Momentum"
                                    value={dayPnL !== null ? (dayPnL >= 0 ? `+$${dayPnL.toLocaleString()}` : `-$${Math.abs(dayPnL).toLocaleString()}`) : '---'}
                                    icon={<Activity className="w-4 h-4" />}
                                    sub="Intraday Delta"
                                    trendColor={dayPnL !== null ? (dayPnL >= 0 ? 'text-emerald-500' : 'text-rose-500') : ''}
                                />
                                <MetricCard
                                    label="System Latency"
                                    value={systemRunning ? 'Active' : 'Idle'}
                                    icon={<Zap className="w-4 h-4" />}
                                    sub="Data Ingestion"
                                    trendColor={systemRunning ? 'text-emerald-500' : 'text-gray-500'}
                                />
                                <MetricCard
                                    label="Monitor Assets"
                                    value={symbols.length.toString()}
                                    icon={<Star className="w-4 h-4" />}
                                    sub="Active Watchlist"
                                />
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

function MetricCard({ label, value, icon, sub, trendColor = 'text-white' }: any) {
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

function MoverCard({ mover }: { mover: MarketMover }) {
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

function ChevronDown(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
