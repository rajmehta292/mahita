'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import { SchwabGating } from '../components/SchwabGating'
import {
    PieChart,
    ChevronDown,
    AlertCircle,
    TrendingUp,
    Activity,
    RefreshCw,
    Target,
    ArrowRight,
    ExternalLink,
    X
} from 'lucide-react'
import { ColumnConfig, PositionTable } from '../components/Portfolio/PositionTable'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { useViewDemand } from '../hooks/use-view-demand'
import { createOrderDraft, OrderDraft, serializeOrderDraft } from '@/lib/trading/order-draft'
import { resolveHydratedAccountId } from '@/lib/account-selection'

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
    const router = useRouter()
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<SchwabAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isRefreshing, setIsRefreshing] = useState(false)
    const [pendingOrderDraft, setPendingOrderDraft] = useState<OrderDraft | null>(null)
    const { preferences, updatePreferences } = useUserPreferences()
    const viewRefreshIntervalSeconds = Math.max(3, preferences?.viewRefreshIntervalSeconds ?? 13)

    const preferredColumns = useMemo(() => {
        if (!preferences?.portfolioColumns) {
            return undefined
        }

        try {
            return JSON.parse(preferences.portfolioColumns) as ColumnConfig[]
        } catch {
            return undefined
        }
    }, [preferences?.portfolioColumns])

    useViewDemand({
        enabled: connected,
        surface: 'portfolio',
        providerPreference: 'schwab',
        priorityScore: 1.35,
        refreshIntervalSeconds: viewRefreshIntervalSeconds,
    })

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()
            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts)
            }
        } catch {
            setError('Failed to load accounts')
        }
    }

    const fetchPositions = useCallback(async (id?: string) => {
        const targetId = id || selectedAccount
        if (!targetId) return

        setIsRefreshing(true)
        try {
            const response = await fetch(`/api/schwab/positions?accountId=${targetId}`)
            const data = await response.json()
            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
                setError(null)
            } else {
                if (
                    response.status === 401 ||
                    data.error?.toLowerCase().includes('token') ||
                    data.error?.toLowerCase().includes('auth')
                ) {
                    setConnected(false)
                    setSelectedAccount('')
                    setPositions([])
                    setBalance(null)
                    setError('Schwab authorization expired. Reconnect the brokerage session to resume live portfolio sync.')
                } else {
                    setError(data.error)
                }
            }
        } catch {
            setError('Portfolio data synchronization failed')
        } finally {
            setIsRefreshing(false)
        }
    }, [selectedAccount])

    useEffect(() => {
        if (connected) {
            fetchAccounts()
        }
    }, [connected])

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
            setSelectedAccount(nextAccountId)
        }
    }, [accounts, preferences?.selectedAccountId, selectedAccount])

    useEffect(() => {
        if (!selectedAccount) {
            return
        }

        fetchPositions()
        localStorage.setItem('mahita_default_account', selectedAccount)

        if (preferences?.selectedAccountId === selectedAccount) {
            return
        }

        updatePreferences({ selectedAccountId: selectedAccount }).catch((preferenceError) => {
            console.warn('Failed to persist account preference:', preferenceError)
        })
    }, [preferences?.selectedAccountId, selectedAccount, updatePreferences, fetchPositions])

    useEffect(() => {
        if (!connected || !selectedAccount) {
            return
        }

        const timer = setInterval(() => {
            void fetchPositions(selectedAccount)
        }, viewRefreshIntervalSeconds * 1000)

        return () => clearInterval(timer)
    }, [connected, fetchPositions, selectedAccount, viewRefreshIntervalSeconds])

    const activeColumnConfig = preferredColumns && preferredColumns.length > 0
        ? preferredColumns
        : [
            { id: 'ticker', label: 'Ticker', visible: true, order: 0 },
            { id: 'qty_entry', label: 'Qty / Avg Price', visible: true, order: 1 },
            { id: 'market_profile', label: 'Last Price / MV', visible: true, order: 2 },
            { id: 'performance', label: '% Change / Net', visible: true, order: 3 },
            { id: 'actions', label: 'Actions', visible: true, order: 4 },
        ] satisfies ColumnConfig[]

    const handleAction = async (symbol: string, side: 'BUY' | 'SELL', amount?: number | 'ALL') => {
        const position = positions.find((candidate) => candidate.symbol === symbol)

        setPendingOrderDraft(createOrderDraft({
            accountId: selectedAccount,
            symbol,
            side,
            quantityMode: amount === 'ALL' ? 'ALL' : 'CUSTOM',
            quantity: typeof amount === 'number'
                ? amount
                : side === 'BUY'
                    ? undefined
                    : position?.quantity,
            limitPrice: position?.currentPrice,
        }))
    }

    const handleExport = () => {
        const visibleColumns = [...activeColumnConfig]
            .filter((column) => column.visible)
            .sort((left, right) => left.order - right.order)

        const rows = positions.map((position) => visibleColumns.map((column) => {
            if (column.id === 'ticker') {
                return `${position.symbol} (${position.description || 'Common Stock'})`
            }

            if (column.id === 'qty_entry') {
                return `${position.quantity} @ ${position.averagePrice.toFixed(2)}`
            }

            if (column.id === 'market_profile') {
                return `${position.currentPrice.toFixed(2)} / ${position.marketValue.toFixed(2)}`
            }

            if (column.id === 'performance') {
                return `${position.unrealizedPLPercent.toFixed(2)}% / ${position.unrealizedPL.toFixed(2)}`
            }

            return 'Portfolio actions are available in-app'
        }).join(','))

        const headers = visibleColumns.map((column) => column.label)
        const csv = [headers.join(','), ...rows].join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `portfolio_${selectedAccount}.csv`
        a.click()
        URL.revokeObjectURL(url)
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
                                    {accounts.map((acc) => (
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
                    <div className="flex-1 overflow-hidden p-8 bg-gradient-to-b from-[#131722] to-[#0D0F14]">
                        <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col gap-8 animate-in fade-in duration-700">
                            {error && (
                                <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6 flex flex-col items-center gap-4 text-center">
                                    <AlertCircle className="w-12 h-12 text-rose-500" />
                                    <div>
                                        <div className="text-white font-bold mb-1 uppercase tracking-widest">Synchronization Blocked</div>
                                        <div className="text-rose-500/80 text-xs font-mono">{error}</div>
                                    </div>
                                    <button
                                        onClick={() => setConnected(false)}
                                        className="mt-2 px-8 py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-rose-500/20 hover:brightness-110 active:scale-95 transition-all"
                                    >
                                        Reconnect Schwab Data
                                    </button>
                                </div>
                            )}

                            {!error && (
                                <div className="min-h-0 flex-1">
                                    <PositionTable
                                        key={preferences?.portfolioColumns ?? 'default-columns'}
                                        positions={positions}
                                        onExport={handleExport}
                                        onAction={handleAction}
                                        initialColumns={preferredColumns}
                                        onConfigChange={(config) => {
                                            updatePreferences({
                                                portfolioColumns: JSON.stringify(config)
                                            }).catch((preferenceError) => {
                                                console.warn('Failed to persist portfolio column preferences:', preferenceError)
                                            })
                                        }}
                                    />
                                </div>
                            )}

                            {/* Summary Cards */}
                            <div className="grid shrink-0 grid-cols-1 gap-6 md:grid-cols-3">
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

            {pendingOrderDraft && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-xl rounded-3xl border border-[#2A2E39] bg-[#171B24] shadow-[0_30px_120px_rgba(0,0,0,0.65)]">
                        <div className="flex items-start justify-between gap-4 border-b border-[#2A2E39] px-6 py-5">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500">Trade Preview</div>
                                <h2 className="mt-2 text-xl font-black tracking-tight text-white">
                                    {pendingOrderDraft.side} {pendingOrderDraft.symbol}
                                </h2>
                                <p className="mt-2 text-sm text-gray-400">
                                    Review the ticket and continue in Active Trader for validation and submission.
                                </p>
                            </div>
                            <button
                                onClick={() => setPendingOrderDraft(null)}
                                className="rounded-xl border border-[#2A2E39] p-2 text-gray-500 transition-colors hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
                            <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Order Setup</div>
                                <div className="mt-4 space-y-3 text-sm">
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Account</span>
                                        <span className="font-mono text-white">{selectedAccount || 'Pending selection'}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Side</span>
                                        <span className={`font-black ${pendingOrderDraft.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {pendingOrderDraft.side}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Quantity</span>
                                        <span className="font-mono text-white">
                                            {pendingOrderDraft.quantityMode === 'ALL'
                                                ? 'All available shares'
                                                : pendingOrderDraft.quantity ?? 'Set in ticket'}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-gray-500">Order Type</span>
                                        <span className="font-mono text-white">{pendingOrderDraft.orderType}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-400">Execution Flow</div>
                                <ul className="mt-4 space-y-3 text-sm text-gray-300">
                                    <li>1. Active Trader loads this ticket with your selected account and symbol.</li>
                                    <li>2. You can edit quantity, order type, duration, and session rules.</li>
                                    <li>3. Mahita will preview the final Schwab payload before submit.</li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-[#2A2E39] px-6 py-5 sm:flex-row sm:items-center sm:justify-end">
                            <button
                                onClick={() => setPendingOrderDraft(null)}
                                className="rounded-2xl border border-[#2A2E39] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
                            >
                                Stay Here
                            </button>
                            <button
                                onClick={() => {
                                    const query = serializeOrderDraft({
                                        ...pendingOrderDraft,
                                        accountId: selectedAccount,
                                    })
                                    setPendingOrderDraft(null)
                                    router.push(`/active-trader?${query}`)
                                }}
                                className="flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600"
                            >
                                Edit In Active Trader
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    )
}
