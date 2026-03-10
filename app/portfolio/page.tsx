'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import { SchwabGating } from '../components/SchwabGating'
import {
    PieChart,
    Download,
    ChevronDown,
    AlertCircle,
    TrendingUp,
    TrendingDown,
    Activity,
    DollarSign,
    RefreshCw,
    Wallet,
    Target,
    ArrowRight
} from 'lucide-react'
import { PositionTable } from '../components/Portfolio/PositionTable'

interface Position {
    symbol: string
    quantity: number
    averagePrice: number
    currentPrice: number
    marketValue: number
    unrealizedPL: number
    unrealizedPLPercent: number
    description?: string
}

interface AccountBalance {
    cashBalance: number
    equity: number
    liquidationValue: number
    buyingPower: number
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
            liquidationValue: number
        }
    }
}

export default function PortfolioPage() {
    const [loading, setLoading] = useState(false)
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<SchwabAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()
            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts)
                // Persistence logic for default account
                const saved = localStorage.getItem('mahita_default_account')
                if (saved) {
                    setSelectedAccount(saved)
                } else {
                    const firstAcc = data.accounts[0].securitiesAccount
                    setSelectedAccount(firstAcc.hashValue || firstAcc.accountId)
                }
            }
        } catch (e) {
            setError('Failed to load accounts')
        }
    }

    const fetchPositions = async (id?: string) => {
        const targetId = id || selectedAccount
        if (!targetId) return

        setIsRefreshing(true)
        setLoading(true)
        try {
            const response = await fetch(`/api/schwab/positions?accountId=${targetId}`)
            const data = await response.json()
            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
                setError(null)
            } else {
                setError(data.error)
            }
        } catch (e) {
            setError('Portfolio data synchronization failed')
        } finally {
            setIsRefreshing(false)
            setLoading(false)
        }
    }

    useEffect(() => {
        if (connected) {
            fetchAccounts()
        }
    }, [connected])

    useEffect(() => {
        if (selectedAccount) {
            fetchPositions()
            localStorage.setItem('mahita_default_account', selectedAccount)
        }
    }, [selectedAccount])

    const handleAction = async (symbol: string, side: 'BUY' | 'SELL', amount?: number | 'ALL') => {
        console.log(`Action: ${side} ${symbol} ${amount}`)
        alert(`${side} ${symbol} order triggered (Simulated)`)
    }

    const handleExport = () => {
        const headers = ['Symbol', 'Quantity', 'Avg Price', 'Price', 'Market Value', 'P&L', 'P&L%']
        const rows = positions.map(p => [
            p.symbol,
            p.quantity,
            p.averagePrice,
            p.currentPrice,
            p.marketValue,
            p.unrealizedPL,
            p.unrealizedPLPercent
        ].join(','))
        const csv = [headers.join(','), ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `portfolio_${selectedAccount}.csv`
        a.click()
    }

    return (
        <MainLayout>
            <SchwabGating onStateChange={setConnected}>
                <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                    {/* Header */}
                    <div className="h-20 bg-[#1E222D]/80 backdrop-blur-md border-b border-[#2A2E39] flex items-center justify-between px-8 shrink-0 z-20">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                                    <PieChart className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-white font-black text-xl tracking-tight">Portfolio</h1>
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span className="text-[10px] text-emerald-500 font-black uppercase tracking-widest">Live Integration</span>
                                    </div>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-[#2A2E39] mx-2"></div>

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

                            <button
                                onClick={() => fetchPositions()}
                                disabled={isRefreshing}
                                className="p-2.5 bg-[#2A2E39] hover:bg-white/5 rounded-xl border border-[#3B4050] text-gray-400 hover:text-white transition-all active:scale-95 disabled:opacity-30"
                            >
                                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
                            </button>
                        </div>

                        <div className="flex items-center gap-8">
                            <div className="text-right">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Liquidation</div>
                                <div className="text-2xl font-black text-white tracking-tighter tabular-nums flex items-baseline gap-1">
                                    <span className="text-blue-500 text-sm font-medium">$</span>
                                    {balance?.liquidationValue?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Cash</div>
                                <div className="text-xl font-bold text-emerald-500 tracking-tighter tabular-nums flex items-baseline gap-1">
                                    <span className="text-emerald-500/50 text-sm font-medium">$</span>
                                    {balance?.cashBalance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-auto p-8 bg-gradient-to-b from-[#131722] to-[#0D0F14]">
                        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-700">
                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
                                    <AlertCircle className="w-12 h-12 text-rose-500" />
                                    <div>
                                        <div className="text-white font-bold mb-1 uppercase tracking-widest">Synchronization Blocked</div>
                                        <div className="text-rose-500/80 text-xs font-mono">{error}</div>
                                    </div>
                                    <button
                                        onClick={() => window.location.reload()}
                                        className="mt-2 px-8 py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all"
                                    >
                                        Reconnect Schwab Data
                                    </button>
                                </div>
                            )}

                            {!error && (
                                <PositionTable
                                    positions={positions}
                                    onExport={handleExport}
                                    onAction={handleAction}
                                />
                            )}

                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 group hover:border-blue-500/30 transition-all cursor-pointer">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                                        Asset Exposure
                                        <Target className="w-3 h-3 text-blue-500" />
                                    </div>
                                    <div className="h-2 w-full bg-[#131722] rounded-full overflow-hidden mb-4">
                                        <div className="h-full bg-blue-500 w-[65%]" />
                                    </div>
                                    <div className="text-xs font-bold text-gray-300">Equity Concentration: 65%</div>
                                </div>

                                <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 group hover:border-emerald-500/30 transition-all cursor-pointer">
                                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex justify-between items-center">
                                        P&L Momentum
                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                    </div>
                                    <div className="text-lg font-black text-emerald-500">+$2,450.12 <span className="text-[10px] opacity-60">(+3.4%)</span></div>
                                    <div className="text-[10px] font-bold text-gray-500 mt-2 uppercase tracking-tight">Relative to S&P 500</div>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-600 to-blue-700 border border-white/10 rounded-2xl p-6 group hover:brightness-110 transition-all cursor-pointer shadow-lg shadow-indigo-500/20">
                                    <div className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-4 flex justify-between items-center">
                                        Alpha Insights
                                        <Activity className="w-3 h-3 text-white" />
                                    </div>
                                    <p className="text-xs font-bold text-white/90 leading-relaxed">
                                        Market overlap detected in tech sector. Consider scaling into defensive positions.
                                    </p>
                                    <div className="mt-4 text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2">
                                        Consult AI <ArrowRight className="w-3 h-3" />
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
