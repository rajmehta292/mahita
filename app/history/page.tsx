'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { SchwabGating } from '../components/SchwabGating'
import { AuthEntryCta } from '../components/Auth/AuthEntryCta'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { resolveHydratedAccountId } from '@/lib/account-selection'
import {
    Download,
    RefreshCw,
    AlertCircle,
    ChevronDown,
    ChevronRight,
    History as HistoryIcon,
    Search
} from 'lucide-react'

interface SchwabAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
        type: string
    }
}

interface Trade {
    id: string
    symbol: string
    type: string
    status: string
    quantity: number
    price: number
    date: string
    fullData: BrokerageOrder
}

interface BrokerageOrder {
    orderId: string
    status: string
    quantity?: number
    price?: number
    stopPrice?: number
    enteredTime?: string
    orderLegCollection?: Array<{
        instruction?: string
        instrument?: {
            symbol?: string
        }
    }>
}

export default function HistoryPage() {
    const { data: session, status } = useSession()
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<SchwabAccount[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState<string>('')
    const [trades, setTrades] = useState<Trade[]>([])
    const [loading, setLoading] = useState(true)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { preferences, updatePreferences } = useUserPreferences()

    const fetchAccounts = useCallback(async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()
            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts)
            }
        } catch (error) {
            console.warn('Fetch accounts failed:', error)
        } finally {
            setLoading(false)
        }
    }, [])

    const fetchOrders = useCallback(async (id?: string) => {
        const targetId = id || selectedAccountId
        if (!targetId) return

        setIsRefreshing(true)
        setError(null)
        try {
            const response = await fetch(`/api/schwab/orders?accountId=${targetId}`)
            const data = await response.json()

            if (data.success && data.orders) {
                // Map Schwab orders to our Trade interface
                const mappedTrades = (data.orders as BrokerageOrder[]).map((order) => {
                    const leg = order.orderLegCollection?.[0]
                    return {
                        id: order.orderId,
                        symbol: leg?.instrument?.symbol || 'UNKNOWN',
                        type: leg?.instruction || 'TRADE',
                        status: order.status,
                        quantity: order.quantity || 0,
                        price: order.price || order.stopPrice || 0,
                        date: order.enteredTime ? new Date(order.enteredTime).toLocaleDateString() : 'Unknown',
                        fullData: order
                    }
                })
                setTrades(mappedTrades)
            } else {
                setError(data.error || 'No history found')
            }
        } catch {
            setError('Failed to fetch trade history')
        } finally {
            setIsRefreshing(false)
        }
    }, [selectedAccountId])

    const handleStateChange = useCallback((isConnected: boolean) => {
        setConnected(isConnected)
        if (isConnected) {
            fetchAccounts()
            return
        }

        setAccounts([])
        setSelectedAccountId('')
        setTrades([])
        setLoading(false)
    }, [fetchAccounts])

    useEffect(() => {
        if (accounts.length === 0) {
            return
        }

        const localPreference = localStorage.getItem('mahita_default_account')
        const preferredAccountId = preferences?.selectedAccountId || localPreference
        const nextAccountId = resolveHydratedAccountId(
            accounts,
            selectedAccountId,
            preferredAccountId
        )

        if (nextAccountId && nextAccountId !== selectedAccountId) {
            setSelectedAccountId(nextAccountId)
        }
    }, [accounts, preferences?.selectedAccountId, selectedAccountId])

    useEffect(() => {
        if (!selectedAccountId) {
            return
        }

        localStorage.setItem('mahita_default_account', selectedAccountId)
        if (preferences?.selectedAccountId === selectedAccountId) {
            return
        }

        updatePreferences({ selectedAccountId: selectedAccountId }).catch((preferenceError) => {
            console.warn('Failed to persist history account preference:', preferenceError)
        })
    }, [preferences?.selectedAccountId, selectedAccountId, updatePreferences])

    useEffect(() => {
        if (connected && selectedAccountId) {
            fetchOrders(selectedAccountId)
        }
    }, [connected, selectedAccountId, fetchOrders])

    if (status === 'loading' || (connected && loading)) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex-1 flex items-center justify-center bg-[#131722]">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex-1 flex items-center justify-center bg-[#131722] p-6 text-center">
                    <div className="max-w-md bg-[#1E222D] p-8 rounded-2xl border border-[#2A2E39] shadow-2xl">
                        <HistoryIcon className="w-12 h-12 text-blue-500 mx-auto mb-4 opacity-50" />
                        <h2 className="text-2xl font-bold text-white mb-4">Secure History Access</h2>
                        <p className="text-gray-400 mb-8 font-medium">Please sign in to view your private trading history and execution metrics.</p>
                        <AuthEntryCta fullWidth className="bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-all font-bold flex items-center justify-center gap-2" />
                    </div>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <SchwabGating onStateChange={handleStateChange}>
                <div className="flex flex-col h-full bg-[#131722] text-white overflow-hidden">
                {/* Header */}
                <div className="bg-[#1E222D] border-b border-[#2A2E39] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center">
                            <HistoryIcon className="w-6 h-6 text-blue-500" />
                        </div>
                        <h1 className="text-xl font-bold">Trade History</h1>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Account Selector */}
                        <div className="relative group">
                            <select
                                value={selectedAccountId}
                                onChange={(e) => setSelectedAccountId(e.target.value)}
                                className="appearance-none bg-[#131722] border border-[#2A2E39] rounded-xl px-4 py-2 pr-10 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                            >
                                {accounts.map((acc) => (
                                    <option key={acc.securitiesAccount.accountId} value={acc.securitiesAccount.hashValue || acc.securitiesAccount.accountId}>
                                        Account: {acc.securitiesAccount.accountId}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none group-hover:text-white transition-colors" />
                        </div>

                        <div className="flex items-center gap-2 border-l border-[#2A2E39] ml-2 pl-4">
                                <button
                                    onClick={() => fetchOrders()}
                                    disabled={isRefreshing}
                                    className="p-2 bg-[#2A2E39] hover:bg-[#363A45] rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
                            </button>
                            <button className="p-2 bg-[#2A2E39] hover:bg-[#363A45] rounded-lg transition-colors">
                                <Download className="w-4 h-4 text-gray-400" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {error && (
                        <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4 flex items-center gap-3 text-rose-500 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    {/* Desktop Table */}
                    <div className="hidden lg:block bg-[#1E222D] border border-[#2A2E39] rounded-2xl overflow-hidden shadow-2xl">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-[#131722]/50 border-b border-[#2A2E39]">
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Execution Date</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Asset</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500">Instruction</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Quantity</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Price</th>
                                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-gray-500 text-right">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2A2E39]">
                                {trades.length === 0 && !isRefreshing ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-20 text-center text-gray-500">
                                            <div className="flex flex-col items-center gap-3">
                                                <Search className="w-12 h-12 opacity-10" />
                                                <p>No trade execution history found for this account.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    trades.map((trade) => (
                                        <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-4 text-sm font-mono text-gray-400">{trade.date}</td>
                                            <td className="px-6 py-4">
                                                <span className="font-bold text-white tracking-tight">{trade.symbol}</span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.type.includes('BUY') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                    {trade.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-medium">{trade.quantity.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-white">${trade.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`text-[10px] font-bold uppercase tracking-widest ${trade.status === 'FILLED' ? 'text-emerald-500' :
                                                        trade.status === 'CANCELLED' ? 'text-gray-500' :
                                                            'text-blue-500'
                                                    }`}>
                                                    {trade.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List View */}
                    <div className="lg:hidden space-y-3">
                        {trades.length === 0 && !isRefreshing ? (
                            <div className="text-center py-20 text-gray-500 bg-[#1E222D] border border-[#2A2E39] rounded-2xl">
                                <Search className="w-12 h-12 opacity-10 mx-auto mb-3" />
                                <p>No trade history.</p>
                            </div>
                        ) : (
                            trades.map((trade) => (
                                <div key={trade.id} className="bg-[#1E222D] border border-[#2A2E39] rounded-2xl p-4 active:bg-[#2A2E39] transition-colors shadow-lg">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <span className="text-white font-bold text-lg">{trade.symbol}</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.type.includes('BUY') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {trade.type}
                                            </span>
                                        </div>
                                        <div className={`text-[10px] font-bold tracking-widest px-2 py-1 rounded bg-[#131722] ${trade.status === 'FILLED' ? 'text-emerald-500' :
                                                trade.status === 'CANCELLED' ? 'text-gray-500' :
                                                    'text-blue-500'
                                            }`}>
                                            {trade.status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 text-xs">
                                        <div className="flex flex-col gap-1">
                                            <span className="text-gray-500 uppercase font-bold text-[9px] tracking-widest">Qty / Price</span>
                                            <span className="text-white font-mono font-medium">{trade.quantity.toLocaleString()} @ ${trade.price.toFixed(2)}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 text-right">
                                            <span className="text-gray-500 uppercase font-bold text-[9px] tracking-widest">Execution Date</span>
                                            <span className="text-white font-mono">{trade.date}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-[#2A2E39] flex justify-end">
                                        <button className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                            Order Details <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
                </div>
            </SchwabGating>
        </MainLayout>
    )
}
