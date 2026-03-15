'use client'

import { ReactNode, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import { SchwabGating } from '../components/SchwabGating'
import {
    Activity,
    AlertCircle,
    CheckCircle2,
    ChevronDown,
    DollarSign,
    ExternalLink,
    Pause,
    RefreshCw,
    ShieldCheck,
    ShoppingCart,
    TrendingDown,
    TrendingUp,
    Unlink,
    X
} from 'lucide-react'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { resolveHydratedAccountId } from '@/lib/account-selection'
import {
    buildOrderRequestFromDraft,
    createOrderDraft,
    OrderDraft,
    parseOrderDraft,
    resolveDraftQuantity,
} from '@/lib/trading/order-draft'

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

interface BrokerageAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
        type: string
    }
}

interface BrokerageOrderLeg {
    instruction?: string
    quantity?: number
    instrument?: {
        symbol?: string
    }
}

interface BrokerageOrder {
    orderId: string
    status: string
    enteredTime?: string
    orderLegCollection?: BrokerageOrderLeg[]
}

interface LiveStrategy {
    id: string
    name: string
    symbol: string
    status: 'running' | 'stopped' | 'error'
    pnl: number
    trades: number
    winRate: number
    webhookUrl?: string | null
}

interface SavedStrategy {
    id: string
    name: string
    symbol: string
    description?: string
    timeframe?: string
}

const EMPTY_ORDER_DRAFT = createOrderDraft({
    symbol: '',
    side: 'BUY',
})

export default function ActiveTraderPage() {
    return (
        <Suspense fallback={<ActiveTraderPageSkeleton />}>
            <ActiveTraderPageContent />
        </Suspense>
    )
}

function ActiveTraderPageContent() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [connected, setConnected] = useState(false)
    const [accounts, setAccounts] = useState<BrokerageAccount[]>([])
    const [accountId, setAccountId] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([])
    const [showDeployModal, setShowDeployModal] = useState(false)
    const [liveStrategies, setLiveStrategies] = useState<LiveStrategy[]>([])
    const [orders, setOrders] = useState<BrokerageOrder[]>([])
    const [ordersLoading, setOrdersLoading] = useState(false)
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [showOrderPreview, setShowOrderPreview] = useState(false)
    const [orderDraft, setOrderDraft] = useState<OrderDraft>(EMPTY_ORDER_DRAFT)
    const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)
    const [deploymentSubmitting, setDeploymentSubmitting] = useState(false)
    const { preferences, updatePreferences } = useUserPreferences()

    const handleConnectionExpired = useCallback((message: string) => {
        setConnected(false)
        setAccounts([])
        setAccountId('')
        setPositions([])
        setOrders([])
        setBalance(null)
        setShowOrderPreview(false)
        setOrderFeedback({
            type: 'error',
            message,
        })
    }, [])

    useEffect(() => {
        const parsedDraft = parseOrderDraft(searchParams)
        if (!parsedDraft) {
            return
        }

        setOrderDraft(parsedDraft)
        if (parsedDraft.accountId) {
            setAccountId(parsedDraft.accountId)
        }
    }, [searchParams])

    useEffect(() => {
        let cancelled = false

        async function loadStrategyControlPlane() {
            try {
                const [draftResponse, deploymentResponse] = await Promise.all([
                    fetch('/api/script-editor/scripts', { cache: 'no-store' }),
                    fetch('/api/trading/deployments', { cache: 'no-store' }),
                ])

                const [draftJson, deploymentJson] = await Promise.all([
                    draftResponse.json(),
                    deploymentResponse.json(),
                ])

                if (cancelled) {
                    return
                }

                setSavedStrategies(((draftJson.drafts ?? []) as Array<any>).map((draft) => ({
                    id: draft.id,
                    name: draft.name,
                    symbol: draft.symbol,
                    description: draft.description,
                    timeframe: draft.timeframe,
                })))

                setLiveStrategies(((deploymentJson.deployments ?? []) as Array<any>).map((deployment) => ({
                    id: deployment.id,
                    name: deployment.name,
                    symbol: deployment.symbol,
                    status: deployment.status === 'active' ? 'running' : deployment.status === 'paused' ? 'stopped' : 'error',
                    pnl: 0,
                    trades: Array.isArray(deployment.executionIntents) ? deployment.executionIntents.length : 0,
                    winRate: 0,
                    webhookUrl: deployment.webhookUrl || null,
                })))
            } catch (strategyError) {
                console.warn('Failed to load strategy control plane:', strategyError)
            }
        }

        void loadStrategyControlPlane()

        return () => {
            cancelled = true
        }
    }, [])

    const refreshDeployments = useCallback(async () => {
        try {
            const deploymentResponse = await fetch('/api/trading/deployments', { cache: 'no-store' })
            const deploymentJson = await deploymentResponse.json()
            setLiveStrategies(((deploymentJson.deployments ?? []) as Array<any>).map((deployment) => ({
                id: deployment.id,
                name: deployment.name,
                symbol: deployment.symbol,
                status: deployment.status === 'active' ? 'running' : deployment.status === 'paused' ? 'stopped' : 'error',
                pnl: 0,
                trades: Array.isArray(deployment.executionIntents) ? deployment.executionIntents.length : 0,
                winRate: 0,
                webhookUrl: deployment.webhookUrl || null,
            })))
        } catch (refreshError) {
            console.warn('Failed to refresh deployments:', refreshError)
        }
    }, [])

    const handleDeploySavedStrategy = useCallback(async (strategy: SavedStrategy) => {
        setDeploymentSubmitting(true)
        try {
            const response = await fetch('/api/trading/deployments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    linkedScriptDraftId: strategy.id,
                    name: `${strategy.name} • Active Trader`,
                    description: strategy.description || null,
                    symbol: strategy.symbol,
                    timeframe: strategy.timeframe || '1d',
                    target: accountId ? 'schwab-live' : 'paper',
                    linkedAccountId: accountId || null,
                    executionConfig: {
                        defaultQuantity: 1,
                        autoSubmit: true,
                        orderType: 'MARKET',
                    },
                }),
            })
            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to deploy strategy.')
            }

            setOrderFeedback({
                type: 'success',
                message: `Strategy deployed. Webhook ready at ${json.deployment.webhookUrl}`,
            })
            setShowDeployModal(false)
            await refreshDeployments()
        } catch (deployError) {
            setOrderFeedback({
                type: 'error',
                message: deployError instanceof Error ? deployError.message : 'Failed to deploy strategy.',
            })
        } finally {
            setDeploymentSubmitting(false)
        }
    }, [accountId, refreshDeployments])

    const handleToggleLiveStrategy = useCallback(async (strategy: LiveStrategy) => {
        try {
            await fetch(`/api/trading/deployments/${strategy.id}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: strategy.status === 'running' ? 'paused' : 'active',
                }),
            })
            await refreshDeployments()
        } catch (toggleError) {
            setOrderFeedback({
                type: 'error',
                message: toggleError instanceof Error ? toggleError.message : 'Failed to toggle deployment state.',
            })
        }
    }, [refreshDeployments])

    const fetchAccounts = useCallback(async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()

            if (data.success && data.accounts.length > 0) {
                setAccounts(data.accounts)
            }
        } catch (error) {
            console.warn('Failed to fetch accounts:', error)
        }
    }, [])

    const fetchPositions = useCallback(async (targetAccountId?: string) => {
        const resolvedAccountId = targetAccountId || accountId
        if (!resolvedAccountId) {
            return
        }

        try {
            const response = await fetch(`/api/schwab/positions?accountId=${resolvedAccountId}`)
            const data = await response.json()

            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
                setOrderFeedback(null)
                return
            }

            if (
                response.status === 401 ||
                data.error?.toLowerCase().includes('token') ||
                data.error?.toLowerCase().includes('auth')
            ) {
                handleConnectionExpired('Schwab authorization expired. Reconnect the brokerage session to resume live trading.')
            }
        } catch (error) {
            console.warn('Failed to fetch positions:', error)
            setOrderFeedback({
                type: 'error',
                message: 'Failed to fetch positions for the selected account.',
            })
        }
    }, [accountId, handleConnectionExpired])

    const fetchOrders = useCallback(async (targetAccountId?: string) => {
        const resolvedAccountId = targetAccountId || accountId
        if (!resolvedAccountId) {
            return
        }

        setOrdersLoading(true)
        try {
            const response = await fetch(`/api/schwab/orders?accountId=${resolvedAccountId}`)
            const data = await response.json()

            if (data.success) {
                setOrders(Array.isArray(data.orders) ? data.orders : [])
            } else {
                setOrderFeedback({
                    type: 'error',
                    message: data.error || 'Failed to load recent orders.',
                })
            }
        } catch (error) {
            console.warn('Failed to fetch orders:', error)
            setOrderFeedback({
                type: 'error',
                message: 'Failed to load recent orders.',
            })
        } finally {
            setOrdersLoading(false)
        }
    }, [accountId])

    const handleStateChange = useCallback((isConnected: boolean) => {
        setConnected(isConnected)
        if (isConnected) {
            fetchAccounts()
        }
    }, [fetchAccounts])

    useEffect(() => {
        if (accounts.length === 0) {
            return
        }

        const localPreference = localStorage.getItem('mahita_default_account')
        const preferredAccountId = preferences?.selectedAccountId || localPreference
        const nextAccountId = resolveHydratedAccountId(
            accounts,
            accountId,
            preferredAccountId
        )

        if (nextAccountId && nextAccountId !== accountId) {
            setAccountId(nextAccountId)
        }
    }, [accounts, preferences?.selectedAccountId, accountId])

    useEffect(() => {
        if (!accountId) {
            return
        }

        localStorage.setItem('mahita_default_account', accountId)
        setOrderDraft((current) => ({ ...current, accountId }))

        if (preferences?.selectedAccountId === accountId) {
            return
        }

        updatePreferences({ selectedAccountId: accountId }).catch((preferenceError) => {
            console.warn('Failed to persist active trader account preference:', preferenceError)
        })
    }, [accountId, preferences?.selectedAccountId, updatePreferences])

    useEffect(() => {
        if (!connected || !accountId) {
            return
        }

        fetchPositions(accountId)
        fetchOrders(accountId)

        const interval = setInterval(() => {
            fetchPositions(accountId)
            fetchOrders(accountId)
        }, 10000)

        return () => clearInterval(interval)
    }, [connected, accountId, fetchPositions, fetchOrders])

    const selectedPosition = useMemo(
        () => positions.find((position) => position.symbol === orderDraft.symbol),
        [positions, orderDraft.symbol]
    )

    const resolvedQuantity = useMemo(
        () => resolveDraftQuantity(orderDraft, selectedPosition?.quantity),
        [orderDraft, selectedPosition?.quantity]
    )

    const referencePrice = useMemo(() => {
        if (orderDraft.orderType === 'LIMIT') {
            return orderDraft.limitPrice || selectedPosition?.currentPrice || 0
        }

        if (orderDraft.orderType === 'STOP' || orderDraft.orderType === 'STOP_LIMIT') {
            return orderDraft.stopPrice || orderDraft.limitPrice || selectedPosition?.currentPrice || 0
        }

        return selectedPosition?.currentPrice || 0
    }, [orderDraft, selectedPosition?.currentPrice])

    const estimatedNotional = referencePrice * resolvedQuantity
    const totalPL = positions.reduce((sum, position) => sum + position.unrealizedPL, 0)

    const validationError = useMemo(() => {
        if (!accountId) {
            return 'Select a Schwab account before preparing an order.'
        }

        if (!orderDraft.symbol) {
            return 'Enter a symbol before previewing the order.'
        }

        if (orderDraft.quantityMode === 'ALL' && orderDraft.side === 'SELL' && !selectedPosition) {
            return 'Sell All is only available when the symbol is currently held in this account.'
        }

        if (resolvedQuantity <= 0) {
            return 'Quantity must be greater than zero.'
        }

        if ((orderDraft.orderType === 'LIMIT' || orderDraft.orderType === 'STOP_LIMIT') && (!orderDraft.limitPrice || orderDraft.limitPrice <= 0)) {
            return 'Limit orders require a valid limit price.'
        }

        if ((orderDraft.orderType === 'STOP' || orderDraft.orderType === 'STOP_LIMIT') && (!orderDraft.stopPrice || orderDraft.stopPrice <= 0)) {
            return 'Stop orders require a valid stop price.'
        }

        return null
    }, [accountId, orderDraft, resolvedQuantity, selectedPosition])

    const previewPayload = useMemo(() => {
        if (validationError) {
            return null
        }

        try {
            return buildOrderRequestFromDraft(orderDraft, selectedPosition?.quantity)
        } catch {
            return null
        }
    }, [orderDraft, selectedPosition?.quantity, validationError])

    const handleDisconnect = () => {
        handleConnectionExpired('Schwab session disconnected. Reconnect to resume live account activity.')
    }

    const handleSubmitOrder = async () => {
        if (validationError || !previewPayload) {
            setOrderFeedback({
                type: 'error',
                message: validationError || 'Unable to build the order payload.',
            })
            return
        }

        setOrderSubmitting(true)
        try {
            const response = await fetch('/api/schwab/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId,
                    order: previewPayload,
                }),
            })
            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Order submission failed.')
            }

            setOrderFeedback({
                type: 'success',
                message: `Order submitted successfully${data.orderId ? ` (${data.orderId})` : ''}.`,
            })
            setShowOrderPreview(false)
            await Promise.all([fetchPositions(accountId), fetchOrders(accountId)])
        } catch (error) {
            setOrderFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Order submission failed.',
            })
        } finally {
            setOrderSubmitting(false)
        }
    }

    const handleCancelOrder = async (orderId: string) => {
        try {
            const response = await fetch(`/api/schwab/orders?accountId=${accountId}&orderId=${orderId}`, {
                method: 'DELETE',
            })
            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to cancel order.')
            }

            setOrderFeedback({
                type: 'success',
                message: `Order ${orderId} cancelled successfully.`,
            })
            await fetchOrders(accountId)
        } catch (error) {
            setOrderFeedback({
                type: 'error',
                message: error instanceof Error ? error.message : 'Failed to cancel order.',
            })
        }
    }

    const handlePositionTicket = (position: Position, side: 'BUY' | 'SELL') => {
        setOrderDraft(createOrderDraft({
            accountId,
            symbol: position.symbol,
            side,
            quantityMode: side === 'SELL' ? 'ALL' : 'CUSTOM',
            quantity: side === 'SELL' ? position.quantity : position.quantity,
            limitPrice: position.currentPrice,
        }))
        setShowOrderPreview(false)
        setOrderFeedback(null)
    }

    return (
        <MainLayout>
            <SchwabGating onStateChange={handleStateChange}>
                <div className="flex flex-1 flex-col overflow-hidden bg-[#131722]">
                    <div className="flex shrink-0 flex-col justify-between gap-3 border-b border-[#2A2E39] bg-[#1E222D] px-4 py-3 sm:h-14 sm:flex-row sm:items-center sm:px-6">
                        <div className="flex items-center gap-3">
                            <ShoppingCart className="h-5 w-5 text-blue-500 sm:h-6 sm:w-6" />
                            <h1 className="text-xl font-bold text-white">Active Trader</h1>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Execution Surface</p>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
                            {accounts.length > 0 && (
                                <div className="group relative">
                                    <select
                                        value={accountId}
                                        onChange={(event) => setAccountId(event.target.value)}
                                        className="cursor-pointer appearance-none rounded-xl border border-[#2A2E39] bg-[#131722] px-4 py-2.5 pr-10 text-xs font-bold text-white shadow-inner transition-all hover:border-blue-500/50 focus:border-blue-500 focus:outline-none"
                                    >
                                        {accounts.map((account) => (
                                            <option
                                                key={account.securitiesAccount.accountId}
                                                value={account.securitiesAccount.hashValue || account.securitiesAccount.accountId}
                                            >
                                                ...{account.securitiesAccount.accountId.slice(-4)} ({account.securitiesAccount.type})
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 transition-colors group-hover:text-blue-500" />
                                </div>
                            )}

                            <div className="flex items-center gap-1.5 rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-1.5">
                                <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-green-500 sm:text-xs">Connected</span>
                            </div>

                            <button
                                onClick={handleDisconnect}
                                className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-rose-500 transition-all active:scale-95 hover:bg-rose-500/20"
                            >
                                <Unlink className="h-3.5 w-3.5" />
                                <span className="hidden xs:inline">Disconnect</span>
                            </button>
                        </div>
                    </div>

                    <div className="custom-scrollbar flex-1 overflow-auto p-4 sm:p-6">
                        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <MetricCard
                                accent="blue"
                                icon={<DollarSign className="h-12 w-12" />}
                                label="Total Equity"
                                value={`$${balance?.equity.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}`}
                                caption="Real-time valuation"
                            />
                            <MetricCard
                                accent="orange"
                                icon={<Activity className="h-12 w-12" />}
                                label="Buying Power"
                                value={`$${balance?.buyingPower.toLocaleString(undefined, { minimumFractionDigits: 2 }) || '0.00'}`}
                                caption="Available deployment"
                            />
                            <MetricCard
                                accent={totalPL >= 0 ? 'emerald' : 'rose'}
                                icon={totalPL >= 0 ? <TrendingUp className="h-12 w-12" /> : <TrendingDown className="h-12 w-12" />}
                                label="Session P&L"
                                value={`${totalPL >= 0 ? '+' : '-'}$${Math.abs(totalPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                caption="Open-position movement"
                            />
                            <MetricCard
                                accent="purple"
                                icon={<ShoppingCart className="h-12 w-12" />}
                                label="Open Positions"
                                value={`${positions.length}`}
                                caption="Live inventory rows"
                            />
                        </div>

                        {orderFeedback && (
                            <div className={`mb-6 flex items-start gap-3 rounded-2xl border p-4 ${orderFeedback.type === 'success'
                                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                                : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                                }`}>
                                {orderFeedback.type === 'success' ? (
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                ) : (
                                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
                                )}
                                <div>
                                    <div className="text-[10px] font-black uppercase tracking-[0.2em]">
                                        {orderFeedback.type === 'success' ? 'Execution Update' : 'Execution Issue'}
                                    </div>
                                    <div className="mt-1 text-sm">{orderFeedback.message}</div>
                                </div>
                            </div>
                        )}

                        <div className="mb-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.9fr]">
                            <div className="overflow-hidden rounded-3xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                                <div className="border-b border-[#2A2E39] bg-white/[0.02] px-5 py-4">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Order Ticket</div>
                                            <h2 className="mt-2 text-lg font-black tracking-tight text-white">Prepare and validate Schwab orders</h2>
                                        </div>
                                        <button
                                            onClick={() => {
                                                setOrderDraft({ ...EMPTY_ORDER_DRAFT, accountId })
                                                setShowOrderPreview(false)
                                                setOrderFeedback(null)
                                            }}
                                            className="rounded-xl border border-[#2A2E39] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
                                        >
                                            Reset Ticket
                                        </button>
                                    </div>
                                </div>

                                <div className="grid gap-6 p-5 lg:grid-cols-2">
                                    <div className="space-y-4">
                                        <label className="block">
                                            <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Symbol</span>
                                            <input
                                                value={orderDraft.symbol}
                                                onChange={(event) => setOrderDraft((current) => ({
                                                    ...current,
                                                    symbol: event.target.value.toUpperCase(),
                                                }))}
                                                placeholder="AAPL"
                                                className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                            />
                                        </label>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Side</span>
                                                <select
                                                    value={orderDraft.side}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        side: event.target.value as OrderDraft['side'],
                                                        quantityMode: event.target.value === 'SELL' && selectedPosition ? current.quantityMode : 'CUSTOM',
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                >
                                                    <option value="BUY">BUY</option>
                                                    <option value="SELL">SELL</option>
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Order Type</span>
                                                <select
                                                    value={orderDraft.orderType}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        orderType: event.target.value as OrderDraft['orderType'],
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                >
                                                    <option value="MARKET">MARKET</option>
                                                    <option value="LIMIT">LIMIT</option>
                                                    <option value="STOP">STOP</option>
                                                    <option value="STOP_LIMIT">STOP LIMIT</option>
                                                </select>
                                            </label>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Quantity Mode</span>
                                                <select
                                                    value={orderDraft.quantityMode}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        quantityMode: event.target.value as OrderDraft['quantityMode'],
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                >
                                                    <option value="CUSTOM">CUSTOM</option>
                                                    {orderDraft.side === 'SELL' && selectedPosition ? (
                                                        <option value="ALL">SELL ALL</option>
                                                    ) : null}
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Quantity</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="1"
                                                    disabled={orderDraft.quantityMode === 'ALL'}
                                                    value={orderDraft.quantityMode === 'ALL' ? (selectedPosition?.quantity ?? 0) : (orderDraft.quantity ?? '')}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        quantity: Number(event.target.value),
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                                                />
                                            </label>
                                        </div>

                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Duration</span>
                                                <select
                                                    value={orderDraft.duration}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        duration: event.target.value as OrderDraft['duration'],
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                >
                                                    <option value="DAY">DAY</option>
                                                    <option value="GTC">GTC</option>
                                                    <option value="FILL_OR_KILL">FILL OR KILL</option>
                                                </select>
                                            </label>

                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Session</span>
                                                <select
                                                    value={orderDraft.session}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        session: event.target.value as OrderDraft['session'],
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                >
                                                    <option value="NORMAL">NORMAL</option>
                                                    <option value="AM">AM</option>
                                                    <option value="PM">PM</option>
                                                    <option value="SEAMLESS">SEAMLESS</option>
                                                </select>
                                            </label>
                                        </div>

                                        {(orderDraft.orderType === 'LIMIT' || orderDraft.orderType === 'STOP_LIMIT') && (
                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Limit Price</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={orderDraft.limitPrice ?? ''}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        limitPrice: Number(event.target.value),
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                />
                                            </label>
                                        )}

                                        {(orderDraft.orderType === 'STOP' || orderDraft.orderType === 'STOP_LIMIT') && (
                                            <label className="block">
                                                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Stop Price</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={orderDraft.stopPrice ?? ''}
                                                    onChange={(event) => setOrderDraft((current) => ({
                                                        ...current,
                                                        stopPrice: Number(event.target.value),
                                                    }))}
                                                    className="w-full rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm font-bold text-white outline-none transition-colors focus:border-blue-500"
                                                />
                                            </label>
                                        )}
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
                                            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Live Preview</div>
                                            <div className="mt-4 space-y-3 text-sm">
                                                <PreviewRow label="Account" value={accountId || 'Select account'} />
                                                <PreviewRow label="Symbol" value={orderDraft.symbol || 'Set symbol'} />
                                                <PreviewRow label="Side" value={orderDraft.side} valueClassName={orderDraft.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'} />
                                                <PreviewRow label="Resolved Qty" value={resolvedQuantity > 0 ? resolvedQuantity.toLocaleString() : 'Pending'} />
                                                <PreviewRow label="Reference Price" value={referencePrice > 0 ? `$${referencePrice.toFixed(2)}` : 'Market'} />
                                                <PreviewRow label="Estimated Notional" value={estimatedNotional > 0 ? `$${estimatedNotional.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'Pending'} />
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">
                                                <ShieldCheck className="h-4 w-4" />
                                                Schwab Payload
                                            </div>
                                            <pre className="mt-4 overflow-auto rounded-2xl bg-[#0D1016] p-4 text-xs text-gray-300">
{JSON.stringify(previewPayload ?? { error: validationError || 'Complete the ticket to render the final order payload.' }, null, 2)}
                                            </pre>
                                        </div>

                                        <div className="flex flex-col gap-3 sm:flex-row">
                                            <button
                                                onClick={() => setShowOrderPreview(true)}
                                                disabled={!!validationError}
                                                className="flex-1 rounded-2xl border border-[#2A2E39] px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-all hover:border-blue-500/40 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                Review Order
                                            </button>
                                            <button
                                                onClick={handleSubmitOrder}
                                                disabled={!!validationError || orderSubmitting}
                                                className="flex-1 rounded-2xl bg-blue-500 px-4 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {orderSubmitting ? 'Submitting...' : 'Submit to Schwab'}
                                            </button>
                                        </div>
                                        {validationError && (
                                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
                                                {validationError}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="overflow-hidden rounded-3xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                                    <div className="border-b border-[#2A2E39] bg-white/[0.02] px-5 py-4">
                                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Current Position Context</div>
                                        <h2 className="mt-2 text-lg font-black tracking-tight text-white">
                                            {selectedPosition ? `${selectedPosition.symbol} held in selected account` : 'No held position selected'}
                                        </h2>
                                    </div>
                                    <div className="p-5">
                                        {selectedPosition ? (
                                            <div className="space-y-3 text-sm">
                                                <PreviewRow label="Quantity" value={selectedPosition.quantity.toLocaleString()} />
                                                <PreviewRow label="Average Price" value={`$${selectedPosition.averagePrice.toFixed(2)}`} />
                                                <PreviewRow label="Last Price" value={`$${selectedPosition.currentPrice.toFixed(2)}`} />
                                                <PreviewRow label="Market Value" value={`$${selectedPosition.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                                                <PreviewRow
                                                    label="Net P&L"
                                                    value={`${selectedPosition.unrealizedPL >= 0 ? '+' : '-'}$${Math.abs(selectedPosition.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                                                    valueClassName={selectedPosition.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-2xl border border-dashed border-[#2A2E39] px-4 py-6 text-sm text-gray-500">
                                                Select a held symbol or send a draft from Portfolio to see matching inventory context here.
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="overflow-hidden rounded-3xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                                    <div className="flex items-center justify-between border-b border-[#2A2E39] bg-white/[0.02] px-5 py-4">
                                        <div>
                                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Recent Orders</div>
                                            <h2 className="mt-2 text-lg font-black tracking-tight text-white">Broker activity on this account</h2>
                                        </div>
                                        <button
                                            onClick={() => fetchOrders(accountId)}
                                            className="rounded-xl border border-[#2A2E39] p-2 text-gray-500 transition-colors hover:text-white"
                                        >
                                            <RefreshCw className={`h-4 w-4 ${ordersLoading ? 'animate-spin text-blue-500' : ''}`} />
                                        </button>
                                    </div>
                                    <div className="custom-scrollbar max-h-[360px] overflow-auto p-4">
                                        {orders.length === 0 ? (
                                            <div className="rounded-2xl border border-dashed border-[#2A2E39] px-4 py-10 text-center text-sm text-gray-500">
                                                No recent orders loaded for the selected account.
                                            </div>
                                        ) : (
                                            <div className="space-y-3">
                                                {orders.map((order) => {
                                                    const leg = order.orderLegCollection?.[0]
                                                    const symbol = leg?.instrument?.symbol || 'Unknown'
                                                    const instruction = leg?.instruction || 'N/A'
                                                    const quantity = leg?.quantity || 0
                                                    const cancellable = !['FILLED', 'CANCELED', 'REJECTED', 'EXPIRED'].includes(order.status)

                                                    return (
                                                        <div key={order.orderId} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-sm font-black text-white">{symbol}</span>
                                                                        <span className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${instruction === 'BUY' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                                                                            {instruction}
                                                                        </span>
                                                                    </div>
                                                                    <div className="mt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">
                                                                        {quantity} shares · {order.status}
                                                                    </div>
                                                                    <div className="mt-2 text-xs text-gray-500">
                                                                        {order.enteredTime ? new Date(order.enteredTime).toLocaleString() : 'No entered time'}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col items-end gap-2">
                                                                    <button
                                                                        onClick={() => setOrderDraft(createOrderDraft({
                                                                            accountId,
                                                                            symbol,
                                                                            side: instruction === 'BUY' ? 'BUY' : 'SELL',
                                                                            quantityMode: 'CUSTOM',
                                                                            quantity,
                                                                        }))}
                                                                        className="flex items-center gap-1 rounded-xl border border-[#2A2E39] px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-gray-300 transition-colors hover:text-white"
                                                                    >
                                                                        Reuse
                                                                        <ExternalLink className="h-3 w-3" />
                                                                    </button>
                                                                    {cancellable ? (
                                                                        <button
                                                                            onClick={() => handleCancelOrder(order.orderId)}
                                                                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-400 transition-colors hover:bg-rose-500/20"
                                                                        >
                                                                            Cancel
                                                                        </button>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <div className="overflow-hidden rounded-2xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                                <div className="flex items-center justify-between border-b border-[#2A2E39] bg-white/[0.02] p-5">
                                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                                        <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                        Live Inventory
                                    </h3>
                                    <button
                                        onClick={() => fetchPositions(accountId)}
                                        className="rounded-lg border border-transparent p-1.5 transition-colors hover:border-[#3B4050] hover:bg-[#2A2E39]"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5 text-gray-500" />
                                    </button>
                                </div>
                                <div className="custom-scrollbar max-h-[520px] overflow-auto p-4">
                                    {positions.length === 0 ? (
                                        <div className="py-20 text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#2A2E39] bg-[#131722]">
                                                <Activity className="h-6 w-6 text-gray-700" />
                                            </div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">No Active Market Presence</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {positions.map((position) => (
                                                <div
                                                    key={position.symbol}
                                                    className="rounded-xl border border-[#2A2E39] bg-[#131722] p-3 transition-all hover:border-blue-500/20"
                                                >
                                                    <div className="mb-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/5 bg-white/5 text-xs font-bold text-blue-400 transition-colors">
                                                                {position.symbol.slice(0, 2)}
                                                            </div>
                                                            <span className="text-sm font-bold tracking-tight text-white">{position.symbol}</span>
                                                        </div>
                                                        <div className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase ${position.unrealizedPL >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                            {position.unrealizedPL >= 0 ? '+' : ''}{position.unrealizedPLPercent.toFixed(2)}%
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-4">
                                                        <div>
                                                            <span className="mb-0.5 block text-[8px] font-bold uppercase text-gray-500">Quantity</span>
                                                            <span className="text-xs font-mono text-white">{position.quantity}</span>
                                                        </div>
                                                        <div>
                                                            <span className="mb-0.5 block text-[8px] font-bold uppercase text-gray-500">Average</span>
                                                            <span className="text-xs font-mono text-white">${position.averagePrice.toFixed(2)}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="mb-0.5 block text-[8px] font-bold uppercase text-gray-500">Floating P&L</span>
                                                            <span className={`text-xs font-bold font-mono ${position.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                {position.unrealizedPL >= 0 ? '+' : ''}${Math.abs(position.unrealizedPL).toLocaleString()}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="mt-4 flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => handlePositionTicket(position, 'BUY')}
                                                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-400 transition-colors hover:bg-emerald-500/20"
                                                        >
                                                            Buy More
                                                        </button>
                                                        <button
                                                            onClick={() => handlePositionTicket(position, 'SELL')}
                                                            className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-rose-400 transition-colors hover:bg-rose-500/20"
                                                        >
                                                            Sell All
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-hidden rounded-2xl border border-[#2A2E39] bg-[#1E222D] shadow-xl">
                                <div className="flex items-center justify-between border-b border-[#2A2E39] bg-white/[0.02] p-5">
                                    <h3 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-white">
                                        <div className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.5)]" />
                                        Active Strategies
                                    </h3>
                                    <button
                                        onClick={() => setShowDeployModal(true)}
                                        className="rounded-lg bg-blue-500 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-blue-500/10 transition-all active:scale-95 hover:bg-blue-600"
                                    >
                                        + Deploy Strategy
                                    </button>
                                </div>
                                <div className="p-4">
                                    {liveStrategies.length === 0 ? (
                                        <div className="py-20 text-center">
                                            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[#2A2E39] bg-[#131722]">
                                                <ShoppingCart className="h-6 w-6 text-gray-700" />
                                            </div>
                                            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">No Active Strategies</p>
                                            <p className="text-[9px] tracking-tight text-gray-600">
                                                Deploy a saved Pine strategy to paper mode or the selected Schwab account from this panel.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {liveStrategies.map((strategy) => (
                                                <div key={strategy.id} className="rounded-xl border border-[#2A2E39] bg-[#131722] p-3 transition-all hover:border-orange-500/20">
                                                    <div className="mb-4 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                                                                <ShoppingCart className="h-4 w-4 text-orange-500" />
                                                            </div>
                                                            <span className="text-sm font-bold tracking-tight text-white">{strategy.name}</span>
                                                        </div>
                                                        <button
                                                            onClick={() => void handleToggleLiveStrategy(strategy)}
                                                            className="rounded-lg border border-[#2A2E39] p-1.5 text-rose-500/40 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
                                                        >
                                                            <Pause className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                                                        <div>
                                                            <span className="mb-0.5 block font-bold uppercase text-gray-500">Asset</span>
                                                            <span className="font-bold text-white">{strategy.symbol}</span>
                                                        </div>
                                                        <div>
                                                            <span className="mb-0.5 block font-bold uppercase text-gray-500">Trades</span>
                                                            <span className="font-bold text-white">{strategy.trades}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="mb-0.5 block font-bold uppercase text-gray-500">Unrealized</span>
                                                            <span className={`font-bold ${strategy.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                                ${strategy.pnl.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {strategy.webhookUrl ? (
                                                        <div className="mt-3 rounded-lg border border-[#2A2E39] bg-[#0D1016] px-3 py-2 text-[9px] text-gray-400">
                                                            Webhook: {strategy.webhookUrl}
                                                        </div>
                                                    ) : null}
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

            {showOrderPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl rounded-3xl border border-[#2A2E39] bg-[#1E222D] shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between border-b border-[#2A2E39] px-6 py-5">
                            <div>
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-500">Final Review</div>
                                <h3 className="mt-2 text-xl font-black tracking-tight text-white">
                                    {orderDraft.side} {orderDraft.symbol || 'Order'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowOrderPreview(false)}
                                className="rounded-xl border border-[#2A2E39] p-2 text-gray-500 transition-colors hover:text-white"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        <div className="grid gap-5 px-6 py-5 md:grid-cols-2">
                            <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Summary</div>
                                <div className="mt-4 space-y-3 text-sm">
                                    <PreviewRow label="Account" value={accountId} />
                                    <PreviewRow label="Side" value={orderDraft.side} valueClassName={orderDraft.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'} />
                                    <PreviewRow label="Symbol" value={orderDraft.symbol} />
                                    <PreviewRow label="Quantity" value={resolvedQuantity.toLocaleString()} />
                                    <PreviewRow label="Duration" value={orderDraft.duration} />
                                    <PreviewRow label="Session" value={orderDraft.session} />
                                    <PreviewRow label="Estimated Notional" value={`$${estimatedNotional.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} />
                                </div>
                            </div>

                            <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-400">Payload</div>
                                <pre className="mt-4 overflow-auto rounded-2xl bg-[#0D1016] p-4 text-xs text-gray-300">
{JSON.stringify(previewPayload, null, 2)}
                                </pre>
                            </div>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-[#2A2E39] px-6 py-5 sm:flex-row sm:justify-end">
                            <button
                                onClick={() => setShowOrderPreview(false)}
                                className="rounded-2xl border border-[#2A2E39] px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-gray-400 transition-colors hover:text-white"
                            >
                                Back To Ticket
                            </button>
                            <button
                                onClick={handleSubmitOrder}
                                disabled={orderSubmitting}
                                className="rounded-2xl bg-blue-500 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-blue-500/20 transition-all hover:bg-blue-600 disabled:opacity-40"
                            >
                                {orderSubmitting ? 'Submitting...' : 'Confirm And Submit'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeployModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-2xl rounded-2xl border border-[#2A2E39] bg-[#1E222D] p-6 shadow-[0_0_100px_rgba(0,0,0,0.8)] animate-in zoom-in-95 duration-200">
                        <div className="mb-6 flex items-center gap-4">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-blue-500/20 bg-blue-500/10">
                                <ShoppingCart className="h-6 w-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black tracking-tight text-white">Deploy Strategy</h3>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Create a shared Mahita deployment with a webhook endpoint.</p>
                            </div>
                        </div>

                        <div className="custom-scrollbar mb-8 grid max-h-[400px] grid-cols-1 gap-4 overflow-auto pr-2 md:grid-cols-2">
                            {savedStrategies.length === 0 ? (
                                <div className="col-span-2 rounded-2xl border-2 border-dashed border-[#2A2E39] py-20 text-center">
                                    <p className="mb-4 text-xs font-bold uppercase tracking-widest text-gray-500">No Valid Strategies Detected</p>
                                    <button
                                        onClick={() => router.push('/backtest')}
                                        className="mx-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400"
                                    >
                                        Initiate Backtest <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            ) : (
                                savedStrategies.map((strategy) => (
                                    <div
                                        key={strategy.id}
                                        className="group cursor-pointer rounded-2xl border border-[#2A2E39] bg-[#131722] p-4 transition-all hover:border-blue-500/50"
                                        onClick={() => void handleDeploySavedStrategy(strategy)}
                                    >
                                        <div className="mb-3 flex items-start justify-between">
                                            <h4 className="text-sm font-bold text-white transition-colors group-hover:text-blue-400">{strategy.name}</h4>
                                            <span className="rounded border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[9px] font-black uppercase text-blue-500">
                                                {strategy.symbol}
                                            </span>
                                        </div>
                                        <p className="mb-4 line-clamp-2 text-[10px] font-medium leading-relaxed text-gray-500">
                                            {strategy.description || 'Deploy this strategy into Mahita’s shared webhook/runtime control plane.'}
                                        </p>
                                        <div className="border-t border-[#2A2E39] pt-3 text-[8px] font-black uppercase tracking-widest text-gray-600 transition-colors group-hover:text-gray-400">
                                            {deploymentSubmitting ? 'Deploying…' : strategy.timeframe || 'Unknown timeframe'}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => setShowDeployModal(false)}
                                className="flex-1 rounded-2xl border border-[#2A2E39] py-4 text-[10px] font-bold uppercase tracking-widest text-gray-400 transition-all hover:bg-white/[0.02] hover:text-white"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => setShowDeployModal(false)}
                                className="flex-1 rounded-2xl bg-blue-500 py-4 text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-blue-600"
                            >
                                Choose A Strategy Above
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </MainLayout>
    )
}

function ActiveTraderPageSkeleton() {
    return (
        <MainLayout>
            <div className="flex flex-1 items-center justify-center bg-[#131722]">
                <div className="rounded-2xl border border-[#2A2E39] bg-[#1E222D] px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">
                    Loading active trader workspace
                </div>
            </div>
        </MainLayout>
    )
}

function PreviewRow({
    label,
    value,
    valueClassName,
}: {
    label: string
    value: string
    valueClassName?: string
}) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-gray-500">{label}</span>
            <span className={`font-mono text-white ${valueClassName ?? ''}`}>{value}</span>
        </div>
    )
}

function MetricCard({
    accent,
    icon,
    label,
    value,
    caption,
}: {
    accent: 'blue' | 'orange' | 'emerald' | 'rose' | 'purple'
    icon: ReactNode
    label: string
    value: string
    caption: string
}) {
    const accentMap: Record<typeof accent, { border: string, text: string }> = {
        blue: { border: 'hover:border-blue-500/30', text: 'text-blue-500' },
        orange: { border: 'hover:border-orange-500/30', text: 'text-orange-500' },
        emerald: { border: 'hover:border-emerald-500/30', text: 'text-emerald-500' },
        rose: { border: 'hover:border-rose-500/30', text: 'text-rose-500' },
        purple: { border: 'hover:border-purple-500/30', text: 'text-purple-500' },
    }

    return (
        <div className={`group relative overflow-hidden rounded-2xl border border-[#2A2E39] bg-[#1E222D] p-5 transition-all ${accentMap[accent].border}`}>
            <div className="absolute right-0 top-0 p-3 opacity-5 transition-opacity group-hover:opacity-10">
                {icon}
            </div>
            <div className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</div>
            <div className={`text-2xl font-bold ${accentMap[accent].text}`}>{value}</div>
            <div className="mt-2 text-[9px] uppercase text-gray-500">{caption}</div>
        </div>
    )
}
