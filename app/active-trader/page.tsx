'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import { SchwabGating } from '../components/SchwabGating'
import {
    Zap,
    TrendingUp,
    TrendingDown,
    DollarSign,
    Activity,
    Settings,
    Play,
    Pause,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    Link as LinkIcon,
    Unlink,
    Key
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

interface LiveStrategy {
    id: string
    name: string
    symbol: string
    status: 'running' | 'stopped' | 'error'
    pnl: number
    trades: number
    winRate: number
}

export default function ActiveTraderPage() {
    const router = useRouter()
    const [connected, setConnected] = useState(false)
    const [accountId, setAccountId] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [liveStrategies, setLiveStrategies] = useState<LiveStrategy[]>([])
    const [savedStrategies, setSavedStrategies] = useState<any[]>([])
    const [showDeployModal, setShowDeployModal] = useState(false)

    useEffect(() => {
        loadSavedStrategies()
    }, [])

    const loadSavedStrategies = () => {
        const saved = localStorage.getItem('strategies')
        if (saved) {
            setSavedStrategies(JSON.parse(saved))
        }
    }

    const handleStateChange = (isConnected: boolean) => {
        setConnected(isConnected)
        if (isConnected && !accountId) {
            fetchAccounts()
        }
    }

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()

            if (data.success && data.accounts.length > 0) {
                setAccountId(data.accounts[0].securitiesAccount.accountId)
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error)
        }
    }

    const fetchPositions = async () => {
        if (!accountId) return

        try {
            const response = await fetch(`/api/schwab/positions?accountId=${accountId}`)
            const data = await response.json()

            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
            } else {
                if (response.status === 401 || data.error?.toLowerCase().includes('token') || data.error?.toLowerCase().includes('auth')) {
                    setConnected(false)
                    setAccountId('')
                    // Forces a reload to let SchwabGating catch the expiry
                    window.location.reload()
                }
            }
        } catch (error) {
            console.error('Failed to fetch positions:', error)
            setConnected(false)
            setAccountId('')
        }
    }

    useEffect(() => {
        if (connected && accountId) {
            fetchPositions()
            const interval = setInterval(fetchPositions, 5000)
            return () => clearInterval(interval)
        }
    }, [connected, accountId])

    const totalPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0)

    const handleDisconnect = async () => {
        // Option: we could call a DELETE endpoint to clear tokens
        setConnected(false)
        setAccountId('')
        // Just reload for now, SchwabGating will show the gate
        window.location.reload()
    }

    return (
        <MainLayout>
            <SchwabGating onStateChange={handleStateChange}>
                <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                    {/* Header */}
                    <div className="bg-[#1E222D] border-b border-[#2A2E39] flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 sm:h-14 sm:px-6 shrink-0 gap-3">
                        <div className="flex items-center gap-3">
                            <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
                            <h1 className="text-xl font-bold text-white">Active Trader</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black">Live Execution Engine</p>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-4">
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/10 rounded-lg border border-green-500/20">
                                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
                                <span className="text-[10px] sm:text-xs text-green-500 font-bold uppercase tracking-wider">Connected</span>
                            </div>
                            <button
                                onClick={handleDisconnect}
                                className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 rounded-lg transition-all border border-rose-500/20 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest active:scale-95"
                            >
                                <Unlink className="w-3.5 h-3.5" />
                                <span className="hidden xs:inline">Disconnect</span>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto p-4 sm:p-6 custom-scrollbar">
                        {/* Account Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <DollarSign className="w-12 h-12" />
                                </div>
                                <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Equity</div>
                                <div className="text-2xl font-bold text-white">
                                    <span className="text-blue-500 text-lg mr-1 font-medium">$</span>
                                    {balance?.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-2 text-[9px] text-gray-500 uppercase flex items-center gap-1">
                                    <Activity className="w-3 h-3 text-blue-500" />
                                    Real-time Valuation
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 relative overflow-hidden group hover:border-orange-500/30 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Activity className="w-12 h-12" />
                                </div>
                                <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Buying Power</div>
                                <div className="text-2xl font-bold text-white">
                                    <span className="text-orange-500 text-lg mr-1 font-medium">$</span>
                                    {balance?.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                                <div className="mt-2 text-[9px] text-orange-500/60 uppercase flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    Leverage Available
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    {totalPL >= 0 ? <TrendingUp className="w-12 h-12" /> : <TrendingDown className="w-12 h-12" />}
                                </div>
                                <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Session P&L</div>
                                <div className={`text-2xl font-bold flex items-center gap-2 ${totalPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                    <span className="font-mono">{totalPL >= 0 ? '+' : '-'}${Math.abs(totalPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                </div>
                                <div className="mt-2 text-[9px] text-emerald-500/60 uppercase flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" />
                                    Market Performance
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-5 relative overflow-hidden group hover:border-purple-500/30 transition-all">
                                <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                                    <Zap className="w-12 h-12" />
                                </div>
                                <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Open Positions</div>
                                <div className="text-2xl font-bold text-white">
                                    {positions.length} <span className="text-xs text-gray-500 font-normal uppercase ml-1">Active</span>
                                </div>
                                <div className="mt-2 text-[9px] text-purple-500/60 uppercase flex items-center gap-1">
                                    <Activity className="w-3 h-3" />
                                    Portfolio Cluster
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Current Positions */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-5 border-b border-[#2A2E39] flex items-center justify-between bg-white/[0.02]">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                                        Live Inventory
                                    </h3>
                                    <button
                                        onClick={fetchPositions}
                                        className="p-1.5 hover:bg-[#2A2E39] rounded-lg transition-colors border border-transparent hover:border-[#3B4050]"
                                    >
                                        <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
                                    </button>
                                </div>
                                <div className="p-4 max-h-[500px] overflow-auto custom-scrollbar">
                                    {positions.length === 0 ? (
                                        <div className="text-center py-20">
                                            <div className="w-12 h-12 bg-[#131722] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#2A2E39]">
                                                <Activity className="w-6 h-6 text-gray-700" />
                                            </div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">No Active Market Presence</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {positions.map((position, index) => (
                                                <div
                                                    key={index}
                                                    className="p-3 bg-[#131722] rounded-xl border border-[#2A2E39] hover:border-blue-500/20 transition-all group"
                                                >
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center font-bold text-xs text-blue-400 border border-white/5 group-hover:bg-blue-500/10 transition-colors">
                                                                {position.symbol.slice(0, 2)}
                                                            </div>
                                                            <span className="text-white font-bold tracking-tight text-sm">{position.symbol}</span>
                                                        </div>
                                                        <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase ${position.unrealizedPL >= 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'}`}>
                                                            {position.unrealizedPL >= 0 ? '+' : ''}{position.unrealizedPLPercent.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div>
                                                            <span className="text-[8px] text-gray-500 font-bold uppercase block mb-0.5">Quantity</span>
                                                            <span className="text-xs text-white font-mono">{position.quantity}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-[8px] text-gray-500 font-bold uppercase block mb-0.5">Average</span>
                                                            <span className="text-xs text-white font-mono">${position.averagePrice.toFixed(2)}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[8px] text-gray-500 font-bold uppercase block mb-0.5">Floating P&L</span>
                                                            <span className={`text-xs font-mono font-bold ${position.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {position.unrealizedPL >= 0 ? '+' : ''}${Math.abs(position.unrealizedPL).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Live Strategies */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-5 border-b border-[#2A2E39] flex items-center justify-between bg-white/[0.02]">
                                    <h3 className="text-xs font-black uppercase tracking-widest text-white flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]"></div>
                                        Active Strategies
                                    </h3>
                                    <button
                                        onClick={() => setShowDeployModal(true)}
                                        className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg transition-all active:scale-95 shadow-lg shadow-blue-500/10"
                                    >
                                        + Deploy Strategy
                                    </button>
                                </div>
                                <div className="p-4">
                                    {liveStrategies.length === 0 ? (
                                        <div className="text-center py-20">
                                            <div className="w-12 h-12 bg-[#131722] rounded-full flex items-center justify-center mx-auto mb-4 border border-[#2A2E39]">
                                                <Zap className="w-6 h-6 text-gray-700" />
                                            </div>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-widest mb-2">No Active Strategies</p>
                                            <p className="text-[9px] text-gray-600 lowercase tracking-tight">
                                                Deploy backtested models for automated execution.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {liveStrategies.map((strategy) => (
                                                <div
                                                    key={strategy.id}
                                                    className="p-3 bg-[#131722] rounded-xl border border-[#2A2E39] hover:border-orange-500/20 transition-all"
                                                >
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 bg-orange-500/10 rounded-lg flex items-center justify-center">
                                                                <Zap className="w-4 h-4 text-orange-500" />
                                                            </div>
                                                            <span className="text-white font-bold tracking-tight text-sm">{strategy.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5 px-2 py-1 bg-[#1E222D] rounded-lg border border-[#2A2E39]">
                                                                <div className="w-1 h-1 rounded-full bg-green-500 animate-pulse"></div>
                                                                <span className="text-[8px] text-green-500 font-bold uppercase">Running</span>
                                                            </div>
                                                            <button className="p-1.5 hover:bg-rose-500/10 rounded-lg text-rose-500/40 hover:text-rose-500 transition-colors border border-[#2A2E39]">
                                                                <Pause className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                        <div>
                                                            <span className="text-gray-500 font-bold uppercase block mb-0.5">Asset</span>
                                                            <span className="text-white font-bold">{strategy.symbol}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-500 font-bold uppercase block mb-0.5">Trades</span>
                                                            <span className="text-white font-bold">{strategy.trades}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-gray-500 font-bold uppercase block mb-0.5">Unrealized</span>
                                                            <span className={`font-bold ${strategy.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                ${strategy.pnl.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </SchwabGating>

            {/* Strategy Deployment Modal */}
            {showDeployModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-6 w-full max-w-2xl shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center border border-blue-500/20">
                                <Zap className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-tight">Deploy Strategy</h3>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Select Operational Profile</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[400px] overflow-auto mb-8 pr-2 custom-scrollbar">
                            {savedStrategies.length === 0 ? (
                                <div className="col-span-2 py-20 text-center border-2 border-dashed border-[#2A2E39] rounded-2xl">
                                    <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-4">No Valid Strategies Detected</p>
                                    <button
                                        onClick={() => router.push('/backtest')}
                                        className="text-blue-500 hover:text-blue-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto"
                                    >
                                        Initiate Backtest <ArrowRight className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            ) : (
                                savedStrategies.map(strat => (
                                    <div
                                        key={strat.id}
                                        className="p-4 bg-[#131722] border border-[#2A2E39] rounded-2xl hover:border-blue-500/50 transition-all cursor-pointer group"
                                        onClick={() => {
                                            console.log(`Starting deployment for ${strat.name}...`)
                                            setShowDeployModal(false)
                                        }}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <h4 className="text-white font-bold group-hover:text-blue-400 transition-colors text-sm">{strat.name}</h4>
                                            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-500 text-[9px] font-black rounded uppercase border border-blue-500/20">{strat.symbol}</span>
                                        </div>
                                        <p className="text-gray-500 text-[10px] font-medium leading-relaxed mb-4 line-clamp-2">{strat.description || 'Quantum execution model with custom risk parameters.'}</p>
                                        <div className="flex items-center gap-4 text-[8px] text-gray-600 font-black uppercase tracking-widest border-t border-[#2A2E39] pt-3 group-hover:text-gray-400 transition-colors">
                                            <span className="flex items-center gap-1.5"><Clock className="w-2.5 h-2.5" /> {strat.timeframe}</span>
                                            <span className="flex items-center gap-1.5"><Settings className="w-2.5 h-2.5" /> V1.0.4</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowDeployModal(false)}
                                className="flex-1 py-4 border border-[#2A2E39] text-gray-400 hover:text-white rounded-2xl hover:bg-white/[0.02] transition-all font-bold uppercase tracking-widest text-[10px]"
                            >
                                Abort Deployment
                            </button>
                            <button
                                disabled={savedStrategies.length === 0}
                                className="flex-1 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all font-black uppercase tracking-widest text-[10px] shadow-lg shadow-blue-500/20 disabled:opacity-20 disabled:grayscale"
                            >
                                Initiate Live Trading
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    )
}

const Clock = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
)

const ArrowRight = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
)
