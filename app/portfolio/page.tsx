'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import {
    DollarSign,
    TrendingUp,
    TrendingDown,
    Activity,
    RefreshCw,
    Wallet,
    ArrowUpRight,
    ArrowDownRight,
    PieChart,
    ChevronDown,
    AlertCircle,
    CheckCircle,
    Settings,
    Unlink,
    Link as LinkIcon,
    ArrowRight,
    Target,
    Zap
} from 'lucide-react'

interface Position {
    symbol: string
    quantity: number
    averagePrice: number
    currentPrice: number
    marketValue: number
    unrealizedPL: number
    unrealizedPLPercent: number
}

interface AccountBalance {
    cashBalance: number
    equity: number
    buyingPower: number
    dayTradingBuyingPower: number
}

interface SchwabAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
        type: string
        currentBalances: {
            cashBalance: number
            equity: number
            buyingPower: number
        }
    }
}

export default function PortfolioPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [connected, setConnected] = useState(false)
    const [checkingConfig, setCheckingConfig] = useState(true)
    const [accounts, setAccounts] = useState<SchwabAccount[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    useEffect(() => {
        checkSchwabConfig()
    }, [])

    const checkSchwabConfig = async () => {
        try {
            const response = await fetch('/api/user/schwab-config')
            const data = await response.json()

            if (data.success && data.config) {
                if (data.config.hasAccessToken && data.config.hasRefreshToken) {
                    setConnected(true)
                    await fetchAccounts()
                } else {
                    setConnected(false)
                }
            }
        } catch (error) {
            console.error('Failed to check config:', error)
            setError('Connection check failed')
        } finally {
            setCheckingConfig(false)
            setLoading(false)
        }
    }

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()

            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts)
                // Default to first account if none selected. Use hashValue if available.
                if (!selectedAccountId) {
                    const firstAcc = data.accounts[0].securitiesAccount
                    setSelectedAccountId(firstAcc.hashValue || firstAcc.accountId)
                }
            } else if (data.error) {
                setError(data.error)
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error)
            setError('Failed to fetch accounts')
        }
    }

    const fetchPositions = async (id?: string) => {
        const targetId = id || selectedAccountId
        if (!targetId) return

        setIsRefreshing(true)
        setError(null)
        try {
            const response = await fetch(`/api/schwab/positions?accountId=${targetId}`)
            const data = await response.json()

            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
            } else if (data.error) {
                setError(`${data.error}${data.details ? ': ' + JSON.stringify(data.details) : ''}`)
            } else {
                setError('Failed to fetch position data')
            }
        } catch (error) {
            console.error('Failed to fetch positions:', error)
            setError('Data retrieval error: API service unavailable')
        } finally {
            setIsRefreshing(false)
        }
    }

    useEffect(() => {
        if (connected && selectedAccountId) {
            fetchPositions()
        }
    }, [connected, selectedAccountId])

    const totalPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0)
    const totalMarketValue = positions.reduce((sum, pos) => sum + pos.marketValue, 0)

    // Sort positions by market value for allocation
    const sortedPositions = [...positions].sort((a, b) => b.marketValue - a.marketValue)

    if (checkingConfig || (connected && loading)) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex-1 flex items-center justify-center bg-[#131722]">
                    <div className="text-center">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Loading Secured Portfolio Interface...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!connected) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex-1 flex items-center justify-center bg-[#131722] p-6">
                    <div className="text-center max-w-md bg-[#1E222D] p-10 rounded-3xl border border-[#2A2E39] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                        <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                            <Wallet className="w-10 h-10 text-blue-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Portfolio Inactive</h2>
                        <p className="text-gray-400 mb-8 lowercase font-medium tracking-tight">
                            Connect your Schwab credentials to unlock live asset intelligence and real-time execution tracking.
                        </p>
                        <button
                            onClick={() => router.push('/active-trader')}
                            className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                        >
                            <LinkIcon className="w-5 h-5" />
                            Connect Schwab Portal
                        </button>
                    </div>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <div className="flex flex-col h-full bg-[#131722] text-white overflow-hidden">
                {/* Header */}
                <div className="bg-[#1E222D] border-b border-[#2A2E39] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 z-10">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-indigo-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <PieChart className="w-6 h-6 text-blue-500" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Portfolio Control</h1>
                            <div className="flex items-center gap-2">
                                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Live Asset Intelligence</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Account Selector */}
                        <div className="relative group">
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="appearance-none bg-[#131722] border border-[#2A2E39] rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold focus:outline-none focus:border-blue-500 transition-colors cursor-pointer hover:bg-[#2A2E39]/50"
                            >
                                {accounts.map((acc) => {
                                    const id = acc.securitiesAccount.hashValue || acc.securitiesAccount.accountId
                                    return (
                                        <option key={id} value={id}>
                                            ID: {acc.securitiesAccount.accountId} (Schwab {acc.securitiesAccount.type})
                                        </option>
                                    )
                                })}
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-colors" />
                        </div>

                        <button
                            onClick={() => fetchPositions()}
                            disabled={isRefreshing}
                            className="p-2.5 bg-[#2A2E39] hover:bg-[#363A45] rounded-xl transition-all disabled:opacity-50 active:scale-95 border border-[#3B4050]"
                        >
                            <RefreshCw className={`w-5 h-5 text-gray-300 ${isRefreshing ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6 bg-gradient-to-b from-[#131722] to-[#0d0e12]">
                    {error && (
                        <div className="mb-6 bg-rose-500/5 border border-rose-500/20 rounded-2xl p-5 flex items-start gap-4 text-rose-500 animate-in fade-in slide-in-from-top-4 duration-300 shadow-2xl">
                            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-sm mb-1 uppercase tracking-wider">Sync Error Detected</h4>
                                <p className="text-xs font-medium opacity-80 leading-relaxed font-mono">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Metric Cards Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300 shadow-xl">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 scale-[2]">
                                <DollarSign className="w-16 h-16" />
                            </div>
                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Net Liquidation</div>
                            <div className="text-3xl font-bold flex items-baseline gap-1.5">
                                <span className="text-blue-500 text-lg font-medium tracking-tight">$</span>
                                {loading ? '---' : balance?.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-emerald-500/80 uppercase">
                                <Activity className="w-3 h-3" />
                                Updated Just Now
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 relative overflow-hidden group hover:border-blue-500/50 transition-all duration-300 shadow-xl">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 scale-[2]">
                                <Zap className="w-16 h-16" />
                            </div>
                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Cumulative P&L</div>
                            <div className={`text-3xl font-bold flex items-baseline gap-2 ${totalPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                <span>{totalPL >= 0 ? '+' : ''}${Math.abs(totalPL).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                {totalPL >= 0 ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold opacity-60 uppercase">
                                <Target className="w-3 h-3" />
                                Unrealized Market Gain
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 relative overflow-hidden group hover:border-emerald-500/50 transition-all duration-300 shadow-xl">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 scale-[2]">
                                <Wallet className="w-16 h-16" />
                            </div>
                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Settled Cash</div>
                            <div className="text-3xl font-bold flex items-baseline gap-1.5 text-white">
                                <span className="text-emerald-500 text-lg font-medium tracking-tight">$</span>
                                {loading ? '---' : balance?.cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-blue-500/60 uppercase">
                                <RefreshCw className="w-3 h-3" />
                                Available for Withdrawal
                            </div>
                        </div>

                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 relative overflow-hidden group hover:border-orange-500/50 transition-all duration-300 shadow-xl">
                            <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.08] transition-all duration-500 scale-[2]">
                                <TrendingUp className="w-16 h-16" />
                            </div>
                            <div className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3">Intraday Buying Power</div>
                            <div className="text-3xl font-bold flex items-baseline gap-1.5 text-white">
                                <span className="text-orange-500 text-lg font-medium tracking-tight">$</span>
                                {loading ? '---' : balance?.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="mt-3 flex items-center gap-2 text-[10px] font-bold text-orange-500/60 uppercase">
                                <Activity className="w-3 h-3" />
                                High Volatility Capacity
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Positions Details */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
                                <div className="px-8 py-5 border-b border-[#2A2E39] flex items-center justify-between bg-white/[0.02]">
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                        Asset Distribution
                                        <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-lg border border-blue-500/20">{positions.length} Positions</span>
                                    </h3>
                                    <button className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-wider flex items-center gap-1.5 transition-colors">
                                        Export CSV <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="bg-[#131722]/80 border-b border-[#2A2E39]">
                                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500">Asset Cluster</th>
                                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Qty / Entry</th>
                                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Market Profile</th>
                                                <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 text-right">Performance Δ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-[#2A2E39]">
                                            {positions.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="px-8 py-32 text-center text-gray-500">
                                                        <div className="flex flex-col items-center gap-4 opacity-30">
                                                            <Activity className="w-16 h-16" />
                                                            <p className="text-sm font-bold uppercase tracking-widest">No Active Market Presence</p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                positions.map((pos, idx) => (
                                                    <tr key={idx} className="hover:bg-white/[0.03] transition-all group cursor-pointer">
                                                        <td className="px-8 py-5">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-10 h-10 bg-gradient-to-br from-white/10 to-transparent rounded-xl flex items-center justify-center font-black text-xs group-hover:from-blue-500/20 transition-all border border-white/5">
                                                                    {pos.symbol.substring(0, 2)}
                                                                </div>
                                                                <div>
                                                                    <div className="font-bold text-white text-base tracking-tight">{pos.symbol}</div>
                                                                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Common Stock</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className="font-bold text-sm text-gray-300">{pos.quantity.toLocaleString()} Shares</div>
                                                            <div className="text-[10px] text-gray-500 font-bold mt-0.5 tracking-tighter">AVG: ${pos.averagePrice.toFixed(2)}</div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right font-mono">
                                                            <div className="font-bold text-white">${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                            <div className="text-[10px] text-gray-500 font-bold mt-0.5 tracking-tighter uppercase">MV: ${pos.marketValue.toLocaleString()}</div>
                                                        </td>
                                                        <td className="px-8 py-5 text-right">
                                                            <div className={`flex flex-col items-end ${pos.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                <span className="font-black text-sm tracking-tighter">
                                                                    {pos.unrealizedPL >= 0 ? '+' : ''}${Math.abs(pos.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                </span>
                                                                <div className="flex items-center gap-1 text-[10px] font-black uppercase mt-0.5 bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                                                                    {pos.unrealizedPLPercent >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                                                                    {Math.abs(pos.unrealizedPLPercent).toFixed(2)}%
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar: Strategic Insights & Allocation */}
                        <div className="space-y-6">
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl p-6 shadow-xl">
                                <h3 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] mb-6 flex items-center justify-between">
                                    Strategic Weights
                                    <PieChart className="w-4 h-4 text-blue-500" />
                                </h3>

                                <div className="space-y-5">
                                    {sortedPositions.slice(0, 5).map((pos, i) => {
                                        const percentage = totalMarketValue > 0 ? (pos.marketValue / totalMarketValue) * 100 : 0
                                        return (
                                            <div key={i} className="group">
                                                <div className="flex justify-between items-center mb-1.5">
                                                    <span className="text-xs font-black uppercase tracking-widest text-gray-300 group-hover:text-blue-500 transition-colors">{pos.symbol}</span>
                                                    <span className="text-[10px] font-mono font-bold text-gray-500">{percentage.toFixed(1)}%</span>
                                                </div>
                                                <div className="h-1 w-full bg-[#131722] rounded-full overflow-hidden border border-white/[0.02]">
                                                    <div
                                                        className="h-full bg-blue-500 rounded-full transition-all duration-1000 group-hover:brightness-125"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}

                                    {positions.length > 5 && (
                                        <div className="pt-2 text-center">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest hover:text-white cursor-pointer transition-colors">
                                                + {positions.length - 5} More Assets
                                            </span>
                                        </div>
                                    )}

                                    {positions.length === 0 && (
                                        <div className="py-10 text-center text-gray-500 font-mono text-[10px] uppercase tracking-widest opacity-50">
                                            Awaiting Positioning...
                                        </div>
                                    )}
                                </div>

                                <div className="mt-8 pt-6 border-t border-[#2A2E39]">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Risk Exposure</span>
                                        <span className="text-[10px] bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded font-bold border border-orange-500/20 uppercase tracking-tighter">Moderate</span>
                                    </div>
                                    <p className="text-[10px] text-gray-500 leading-relaxed font-medium">
                                        Your portfolio is concentrated in {sortedPositions[0]?.symbol || '---'}. Consider diversifying into uncorrelated sectors for higher volatility resilience.
                                    </p>
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 shadow-xl shadow-blue-500/10 group cursor-pointer overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-4 opacity-20 scale-150 transition-transform group-hover:rotate-12 duration-500">
                                    <TrendingUp className="w-12 h-12 text-white" />
                                </div>
                                <h4 className="text-white font-black text-xs uppercase tracking-widest mb-2">Alpha Insights</h4>
                                <p className="text-blue-100 text-[10px] font-medium leading-relaxed mb-4">
                                    Based on your current positions, the AI recommends adjusting exposure in tech sector before upcoming earnings volatility.
                                </p>
                                <button className="flex items-center gap-2 text-white font-bold text-[10px] uppercase tracking-widest bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-lg transition-all">
                                    Review Plan <ArrowRight className="w-3 h-3" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
