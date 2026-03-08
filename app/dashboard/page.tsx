'use client'

import { useState, useEffect } from 'react'
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
    MoreVertical,
    Trash2,
    Settings2,
    Check
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
}

export default function DashboardPage() {
    const [marketMovers, setMarketMovers] = useState<MarketMover[]>([
        { symbol: 'AAPL', price: 178.25, change: 2.45, changePercent: 1.39 },
        { symbol: 'MSFT', price: 410.68, change: 5.52, changePercent: 1.36 },
        { symbol: 'GOOGL', price: 141.80, change: -1.20, changePercent: -0.84 },
        { symbol: 'TSLA', price: 242.84, change: 8.12, changePercent: 3.46 },
        { symbol: 'NVDA', price: 875.28, change: 12.45, changePercent: 1.44 },
    ])

    const [news, setNews] = useState<NewsItem[]>([
        { title: 'Fed signals potential rate cuts in 2026', source: 'Reuters', time: '2h ago', sentiment: 'positive' },
        { title: 'Tech stocks rally on strong earnings', source: 'Bloomberg', time: '4h ago', sentiment: 'positive' },
        { title: 'Oil prices surge amid supply concerns', source: 'CNBC', time: '5h ago', sentiment: 'neutral' },
        { title: 'Market volatility expected ahead of jobs report', source: 'WSJ', time: '6h ago', sentiment: 'negative' },
    ])

    const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA'])
    const [watchlistQuotes, setWatchlistQuotes] = useState<any[]>([])
    const [expandedWatchlistSymbol, setExpandedWatchlistSymbol] = useState<string | null>(null)
    const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
    const [editInputValue, setEditInputValue] = useState('')
    const [newSymbolInput, setNewSymbolInput] = useState('')
    const [isAddingWatchlist, setIsAddingWatchlist] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const saved = localStorage.getItem('mahita_watchlist')
        if (saved) {
            try {
                setSymbols(JSON.parse(saved))
            } catch (e) { }
        }
    }, [])

    useEffect(() => {
        if (symbols.length === 0) {
            setWatchlistQuotes([])
            return
        }
        const fetchQuotes = async () => {
            try {
                const res = await fetch(`/api/trading/quotes?symbols=${symbols.join(',')}`)
                const data = await res.json()
                if (data.success) {
                    setWatchlistQuotes(data.quotes)
                }
            } catch (error) { }
        }
        fetchQuotes()
        const interval = setInterval(fetchQuotes, 5000)
        return () => clearInterval(interval)
    }, [symbols])

    const saveWatchlist = (newSymbols: string[]) => {
        setSymbols(newSymbols)
        localStorage.setItem('mahita_watchlist', JSON.stringify(newSymbols))
    }

    const handleRemoveFromWatchlist = (sym: string) => {
        saveWatchlist(symbols.filter(s => s !== sym))
    }

    const handleEditSubmit = (oldSym: string) => {
        if (editInputValue.trim() && !symbols.includes(editInputValue.trim().toUpperCase())) {
            const up = symbols.map(s => s === oldSym ? editInputValue.trim().toUpperCase() : s)
            saveWatchlist(up)
        }
        setEditingSymbol(null)
    }

    const handleAddNewSymbol = () => {
        if (newSymbolInput.trim() && !symbols.includes(newSymbolInput.trim().toUpperCase())) {
            saveWatchlist([...symbols, newSymbolInput.trim().toUpperCase()])
        }
        setNewSymbolInput('')
        setIsAddingWatchlist(false)
    }

    const [aiInsights, setAiInsights] = useState([
        { text: 'Strong bullish momentum detected in tech sector', confidence: 85 },
        { text: 'AAPL showing potential breakout pattern', confidence: 72 },
        { text: 'Market correlation increasing - consider diversification', confidence: 68 },
    ])

    return (
        <MainLayout>
            <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-4 sm:px-6 shrink-0">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                        <h1 className="text-white font-semibold text-base sm:text-lg">Dashboard</h1>
                        <span className="hidden xs:inline text-xs text-gray-400">Market Overview</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400">
                        <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 sm:p-6">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Portfolio Value</span>
                                <DollarSign className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-white mb-1">$125,430</div>
                            <div className="flex items-center gap-1 text-sm text-green-500">
                                <ArrowUpRight className="w-4 h-4" />
                                <span>+2.4% Today</span>
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Active Strategies</span>
                                <Zap className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-white mb-1">3</div>
                            <div className="flex items-center gap-1 text-sm text-blue-500">
                                <Activity className="w-4 h-4" />
                                <span>2 Running</span>
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Today's P&L</span>
                                <TrendingUp className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-green-500 mb-1">+$2,845</div>
                            <div className="flex items-center gap-1 text-sm text-gray-400">
                                <span>8 Trades</span>
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-gray-400 text-sm">Win Rate</span>
                                <BarChart3 className="w-4 h-4 text-gray-400" />
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-white mb-1">68%</div>
                            <div className="flex items-center gap-1 text-sm text-gray-400">
                                <span>Last 30 days</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column */}
                        <div className="lg:col-span-2 space-y-6 order-2 lg:order-1">
                            {/* Market Movers */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold flex items-center gap-2">
                                        <TrendingUp className="w-5 h-5 text-blue-500" />
                                        Market Movers
                                    </h3>
                                    <Link href="/screener" className="text-xs text-blue-500 hover:text-blue-400">
                                        View All →
                                    </Link>
                                </div>
                                <div className="p-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {marketMovers.map((mover) => (
                                            <div
                                                key={mover.symbol}
                                                className="flex items-center justify-between p-3 bg-[#131722] rounded-lg border border-[#2A2E39] hover:border-blue-500/30 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                                                        <span className="text-blue-500 font-bold text-sm">{mover.symbol.slice(0, 2)}</span>
                                                    </div>
                                                    <div>
                                                        <div className="text-white font-medium text-sm">{mover.symbol}</div>
                                                        <div className="text-gray-400 text-xs">${mover.price.toFixed(2)}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className={`font-medium text-sm ${mover.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {mover.change >= 0 ? '+' : ''}{mover.change.toFixed(2)}
                                                    </div>
                                                    <div className={`text-[10px] flex items-center gap-1 justify-end ${mover.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                        {mover.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                        {Math.abs(mover.changePercent).toFixed(2)}%
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Market News */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold flex items-center gap-2">
                                        <Newspaper className="w-5 h-5 text-blue-500" />
                                        Market News
                                    </h3>
                                    <button className="text-xs text-blue-500 hover:text-blue-400">
                                        Refresh
                                    </button>
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        {news.map((item, index) => (
                                            <div
                                                key={index}
                                                className="p-3 bg-[#131722] rounded-lg border border-[#2A2E39] hover:border-blue-500/30 transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1">
                                                        <div className="text-white text-sm mb-1 leading-snug">{item.title}</div>
                                                        <div className="flex items-center gap-2 text-[10px] sm:text-xs text-gray-400">
                                                            <span className="whitespace-nowrap">{item.source}</span>
                                                            <span>•</span>
                                                            <span className="whitespace-nowrap">{item.time}</span>
                                                        </div>
                                                    </div>
                                                    <div className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${item.sentiment === 'positive' ? 'bg-green-500/20 text-green-500' :
                                                        item.sentiment === 'negative' ? 'bg-red-500/20 text-red-500' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {item.sentiment}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6 order-1 lg:order-2">
                            {/* Watchlist */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold flex items-center gap-2">
                                        <Star className="w-5 h-5 text-blue-500" />
                                        Watchlist
                                    </h3>
                                    <Link href="/watchlist" className="text-xs text-blue-500 hover:text-blue-400">
                                        Manage →
                                    </Link>
                                </div>
                                <div className="p-4">
                                    <div className="flex flex-col gap-2">
                                        {watchlistQuotes.map((item) => (
                                            <div
                                                key={item.symbol}
                                                className="bg-[#131722] rounded border border-[#2A2E39] hover:border-blue-500/30 transition-colors group relative"
                                            >
                                                <div
                                                    className="flex items-center justify-between p-3 cursor-pointer"
                                                    onClick={() => setExpandedWatchlistSymbol(expandedWatchlistSymbol === item.symbol ? null : item.symbol)}
                                                >
                                                    {editingSymbol === item.symbol ? (
                                                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                                            <input
                                                                type="text"
                                                                value={editInputValue}
                                                                onChange={e => setEditInputValue(e.target.value)}
                                                                onKeyDown={e => e.key === 'Enter' && handleEditSubmit(item.symbol)}
                                                                autoFocus
                                                                className="bg-black/20 text-white px-2 py-1 rounded text-xs w-16 focus:outline-none focus:border-blue-500 border border-[#2A2E39]"
                                                            />
                                                            <button onClick={() => handleEditSubmit(item.symbol)} className="text-blue-500"><Check className="w-3 h-3" /></button>
                                                        </div>
                                                    ) : (
                                                        <span
                                                            className="text-white font-medium text-sm hover:text-blue-400 transition-colors"
                                                            onClick={(e) => {
                                                                e.stopPropagation()
                                                                router.push(`/chart?symbol=${item.symbol}`)
                                                            }}
                                                        >
                                                            {item.symbol}
                                                        </span>
                                                    )}

                                                    <div className="flex items-center gap-3">
                                                        <div className="text-right">
                                                            <div className="text-white text-xs">${(item.price || 0).toFixed(2)}</div>
                                                            <div className={`text-[10px] ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                {item.change >= 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%
                                                            </div>
                                                        </div>

                                                        {/* Hover Actions */}
                                                        <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity" onClick={e => e.stopPropagation()}>
                                                            <Settings2
                                                                className="w-3 h-3 text-gray-400 hover:text-white cursor-pointer"
                                                                onClick={(e) => {
                                                                    setEditingSymbol(item.symbol)
                                                                    setEditInputValue(item.symbol)
                                                                }}
                                                            />
                                                            <Trash2
                                                                className="w-3 h-3 text-gray-400 hover:text-red-500 cursor-pointer"
                                                                onClick={(e) => {
                                                                    handleRemoveFromWatchlist(item.symbol)
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Expanded Card Details */}
                                                {expandedWatchlistSymbol === item.symbol && (
                                                    <div className="px-3 pb-3 pt-1 border-t border-[#2A2E39] bg-[#161A25] rounded-b animate-in slide-in-from-top-2 duration-200">
                                                        <div className="flex justify-between items-center mt-2">
                                                            <div className="text-[10px] text-gray-400 truncate pr-2">{item.name}</div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => router.push(`/chart?symbol=${item.symbol}`)}
                                                                    className="px-2 py-1 bg-[#2A2E39] hover:bg-blue-500/20 text-white text-[10px] font-bold rounded uppercase transition-colors"
                                                                >
                                                                    Chart
                                                                </button>
                                                                <button
                                                                    onClick={() => router.push(`/active-trader?symbol=${item.symbol}`)}
                                                                    className="px-2 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-500 text-[10px] font-bold rounded uppercase transition-colors"
                                                                >
                                                                    Trade
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        {watchlistQuotes.length === 0 && (
                                            <div className="text-center py-6 text-gray-500 text-xs">Loading quotes...</div>
                                        )}
                                    </div>

                                    {isAddingWatchlist ? (
                                        <div className="mt-3 flex items-center gap-2 relative z-20">
                                            <input
                                                type="text"
                                                autoFocus
                                                value={newSymbolInput}
                                                onChange={e => setNewSymbolInput(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && handleAddNewSymbol()}
                                                placeholder="Symbol..."
                                                className="flex-1 bg-black/20 border border-[#2A2E39] text-white px-2 py-1.5 rounded text-xs focus:outline-none focus:border-blue-500"
                                            />
                                            <button onClick={handleAddNewSymbol} className="px-2 py-1.5 bg-blue-500 text-white rounded text-xs">Add</button>
                                            <button onClick={() => setIsAddingWatchlist(false)} className="px-2 py-1.5 text-gray-400 hover:text-white rounded text-xs">Cancel</button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setIsAddingWatchlist(true)}
                                            className="mt-3 w-full py-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-500 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                        >
                                            <Star className="w-4 h-4" />
                                            Add Symbol
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                                <h3 className="text-white font-semibold mb-3 text-sm">Quick Actions</h3>
                                <div className="grid grid-cols-2 lg:grid-cols-1 gap-2">
                                    <Link
                                        href="/backtest"
                                        className="py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-2 text-center"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        <span>New Backtest</span>
                                    </Link>
                                    <Link
                                        href="/active-trader"
                                        className="py-2.5 bg-green-500/20 hover:bg-green-500/30 text-green-500 rounded-lg text-xs font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-2 text-center"
                                    >
                                        <Zap className="w-4 h-4" />
                                        <span>Live Trading</span>
                                    </Link>
                                    <Link
                                        href="/chart"
                                        className="py-2.5 bg-[#131722] hover:bg-[#2A2E39] text-white rounded-lg text-xs font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-2 border border-[#2A2E39] text-center"
                                    >
                                        <Activity className="w-4 h-4" />
                                        <span>Chart Analysis</span>
                                    </Link>
                                    <Link
                                        href="/data-health"
                                        className="py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 rounded-lg text-xs font-medium transition-colors flex flex-col sm:flex-row items-center justify-center gap-2 border border-amber-500/20 text-center"
                                    >
                                        <Activity className="w-4 h-4" />
                                        <span>Data Health</span>
                                    </Link>
                                </div>
                            </div>

                            {/* AI Insights */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold flex items-center gap-2 text-sm">
                                        <Brain className="w-5 h-5 text-purple-500" />
                                        AI Insights
                                    </h3>
                                    <span className="text-[10px] text-purple-500 bg-purple-500/20 px-1.5 py-0.5 rounded font-bold">BETA</span>
                                </div>
                                <div className="p-4">
                                    <div className="space-y-3">
                                        {aiInsights.map((insight, index) => (
                                            <div
                                                key={index}
                                                className="p-3 bg-[#131722] rounded-lg border border-[#2A2E39]"
                                            >
                                                <div className="text-white text-xs mb-2 leading-relaxed">{insight.text}</div>
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 h-1 bg-[#2A2E39] rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-purple-500 rounded-full"
                                                            style={{ width: `${insight.confidence}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[10px] text-gray-400">{insight.confidence}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
