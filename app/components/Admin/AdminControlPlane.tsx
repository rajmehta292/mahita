'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Database,
    Layers3,
    Play,
    RefreshCw,
    Shield,
    Square,
    Users,
    Wrench,
} from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { parseResponseError } from '@/lib/app-errors'
import { DiUiWorkspace } from '@/app/components/Admin/DiUiWorkspace'

type AdminTab = 'overview' | 'providers' | 'data-command' | 'di-ui' | 'users' | 'audits'

interface RuntimeHealthResponse {
    ok: boolean
    runtime: {
        prismaClientReady: boolean
        missingPrismaModels: string[]
        insecureUserBrokeragePlatformFallbackEnabled: boolean
        hasDedicatedAppSecretKey: boolean
    }
    providerPool: {
        marketDataMemberCount: number | null
        superuserBridgeCandidates: number | null
    }
}

interface AdminOverviewResponse {
    userSummary: {
        totalUsers: number
        usersWithBrokerage: number
        activePreferenceProfiles: number
    }
    runtimeSummary: {
        runtimeHealth: RuntimeHealthResponse
        platformDataProviderCount: number
        tokenHealth: { isValid: boolean; error?: string }
        availableProviders: string[]
        continuousIngest: {
            running: boolean
            startedAt: string | null
            lastCompletedAt: string | null
            cycleCount: number
            currentPhase: string
            providerOverride: string | null
            intervalMs: number
            lastError: string | null
        }
    }
    providerPool: Array<{
        id: string
        label: string | null
        purpose: string
        priority: number
        weight: number
        status: string
        isPrimary: boolean
        credential: {
            id: string
            provider: string
            label: string
            sourceType: string
            isEnabled: boolean
            linkedUser: { id: string; email: string | null; name: string | null } | null
        }
    }>
    latestAudits: Array<{
        id: string
        action: string
        reason: string | null
        metadata: string | null
        createdAt: string
        actorUser: { email: string | null; name: string | null }
        targetUser: { email: string | null; name: string | null } | null
    }>
}

interface ProviderPoolResponse {
    providerPool: AdminOverviewResponse['providerPool']
}

interface AdminDataCommandResponse {
    runtime: {
        runtimeHealth: RuntimeHealthResponse
        continuousIngest: {
            running: boolean
            startedAt: string | null
            lastCompletedAt: string | null
            cycleCount: number
            currentPhase: string
            providerOverride: string | null
            intervalMs: number
            lastError: string | null
        }
        providers: string[]
        providerEvents: Array<{
            id: string
            timestamp: string
            kind: string
            message: string
            symbol?: string
            timeframe?: string
            provider?: string
        }>
        tokenHealth: { isValid: boolean; error?: string }
    }
    vaults: Array<{
        id: string
        name: string
        type: string
        isEnabled: boolean
        _count?: { inventories: number }
    }>
    inventorySummary: {
        rows: number
        avgHealthScore: number
        avgCoveragePercent: number
        totalBars: number
        totalGaps: number
        latestSyncAt: string | null
    }
    weakestInventory: Array<{
        id: string
        symbol: string
        timeframe: string
        healthScore: number
        targetCoveragePercent: number
        gapCount: number
        barCount: number
        vault: { name: string; type: string; isEnabled: boolean } | null
    }>
    recentAudits: Array<{
        id: string
        action: string
        createdAt: string
        actorUser: { email: string | null; name: string | null }
    }>
}

interface UsersResponse {
    users: Array<{
        id: string
        email: string | null
        name: string | null
        role: string
        primaryBrokerageConnection: {
            id: string
            provider: string
            status: string
            lastSyncedAt: string | null
            lastError: string | null
            accountCount: number
            accessTokenExpiry: string | null
            refreshTokenExpiry: string | null
        } | null
        preferences: {
            selectedAccountId: string | null
            lastVisitedPath: string | null
            lastVisitedAt: string | null
            lastSignInAt: string | null
        } | null
    }>
}

interface AuditEventsResponse {
    events: Array<{
        id: string
        action: string
        reason: string | null
        metadata: string | null
        createdAt: string
        actorUser: { email: string | null; name: string | null }
        targetUser: { email: string | null; name: string | null } | null
    }>
}

interface ProviderCredentialRevealResponse {
    revealGrantId: string
    recentAuthAt: string | null
    credential: {
        id: string
        provider: string
        label: string
        sourceType: string
        clientId: string | null
        clientSecret: string | null
        accessToken: string | null
        refreshToken: string | null
        accessTokenExpiry: string | null
        refreshTokenExpiry: string | null
        linkedUser: { id: string; email: string | null; name: string | null } | null
        poolMembers: Array<{ id: string; purpose: string; status: string; isPrimary: boolean }>
    }
    revealExpiresAt: string
}

interface RemoteState<T> {
    data: T | null
    loading: boolean
    loaded: boolean
    error: string | null
}

const tabs: Array<{ id: AdminTab; label: string; icon: typeof Shield }> = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'providers', label: 'Provider Pool', icon: Database },
    { id: 'data-command', label: 'Data Command', icon: Wrench },
    { id: 'di-ui', label: 'DI-UI', icon: Layers3 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'audits', label: 'Audit Log', icon: Activity },
]

const emptyRemoteState = <T,>(): RemoteState<T> => ({
    data: null,
    loading: false,
    loaded: false,
    error: null,
})

function formatDate(value?: string | null) {
    if (!value) return 'Never'
    return new Date(value).toLocaleString()
}

async function fetchJsonOrThrow<T>(url: string, fallbackMessage: string) {
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
        throw await parseResponseError(response, fallbackMessage)
    }

    return response.json() as Promise<T>
}

function TabStateMessage({
    loading,
    error,
    empty,
}: {
    loading: boolean
    error: string | null
    empty: string
}) {
    if (loading) {
        return (
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/60">
                Loading…
            </div>
        )
    }

    if (error) {
        return (
            <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-sm text-rose-200">
                {error}
            </div>
        )
    }

    return (
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/45">
            {empty}
        </div>
    )
}

export function AdminControlPlane() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const requestedTab = searchParams.get('tab')
    const initialTab = tabs.some((tab) => tab.id === requestedTab)
        ? (requestedTab as AdminTab)
        : 'overview'

    const [activeTab, setActiveTab] = useState<AdminTab>(initialTab)
    const [overviewState, setOverviewState] = useState<RemoteState<AdminOverviewResponse>>(() => ({
        ...emptyRemoteState<AdminOverviewResponse>(),
        loading: true,
    }))
    const [providerPoolState, setProviderPoolState] = useState<RemoteState<ProviderPoolResponse>>(emptyRemoteState)
    const [dataCommandState, setDataCommandState] = useState<RemoteState<AdminDataCommandResponse>>(emptyRemoteState)
    const [usersState, setUsersState] = useState<RemoteState<UsersResponse>>(emptyRemoteState)
    const [auditsState, setAuditsState] = useState<RemoteState<AuditEventsResponse>>(emptyRemoteState)
    const [busyAction, setBusyAction] = useState<string | null>(null)
    const [promoteUserId, setPromoteUserId] = useState<string>('')
    const [syncForm, setSyncForm] = useState({ symbol: 'AAPL', timeframe: '1d' })
    const [revealTarget, setRevealTarget] = useState<string | null>(null)
    const [revealReason, setRevealReason] = useState('')
    const [revealedCredential, setRevealedCredential] = useState<ProviderCredentialRevealResponse | null>(null)
    const [globalError, setGlobalError] = useState<string | null>(null)
    const [diUiRefreshToken, setDiUiRefreshToken] = useState(0)

    const users = useMemo(() => usersState.data?.users ?? [], [usersState.data])
    const usersWithBrokerage = useMemo(
        () => users.filter((user) => user.primaryBrokerageConnection),
        [users]
    )
    const providerPool = providerPoolState.data?.providerPool ?? []
    const dataCommand = dataCommandState.data
    const audits = auditsState.data?.events ?? []
    const overview = overviewState.data

    const loadOverview = useCallback(async (force = false) => {
        setOverviewState((current) => {
            if (current.loaded && !force) {
                return current
            }

            return {
                ...current,
                loading: true,
                error: null,
            }
        })

        try {
            const data = await fetchJsonOrThrow<AdminOverviewResponse>(
                '/api/admin/overview',
                'Mahita could not load the admin overview.'
            )
            setOverviewState({
                data,
                loaded: true,
                loading: false,
                error: null,
            })
        } catch (error) {
            setOverviewState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : 'Mahita could not load the admin overview.',
            }))
        }
    }, [])

    const loadProviderPool = useCallback(async (force = false) => {
        setProviderPoolState((current) => {
            if (current.loaded && !force) {
                return current
            }

            return {
                ...current,
                loading: true,
                error: null,
            }
        })

        try {
            const data = await fetchJsonOrThrow<ProviderPoolResponse>(
                '/api/admin/provider-pool',
                'Mahita could not load provider-pool members.'
            )
            setProviderPoolState({
                data,
                loaded: true,
                loading: false,
                error: null,
            })
        } catch (error) {
            setProviderPoolState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : 'Mahita could not load provider-pool members.',
            }))
        }
    }, [])

    const loadDataCommand = useCallback(async (force = false) => {
        setDataCommandState((current) => {
            if (current.loaded && !force) {
                return current
            }

            return {
                ...current,
                loading: true,
                error: null,
            }
        })

        try {
            const data = await fetchJsonOrThrow<AdminDataCommandResponse>(
                '/api/admin/data-command',
                'Mahita could not load Data Command.'
            )
            setDataCommandState({
                data,
                loaded: true,
                loading: false,
                error: null,
            })
        } catch (error) {
            setDataCommandState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : 'Mahita could not load Data Command.',
            }))
        }
    }, [])

    const loadUsers = useCallback(async (force = false) => {
        setUsersState((current) => {
            if (current.loaded && !force) {
                return current
            }

            return {
                ...current,
                loading: true,
                error: null,
            }
        })

        try {
            const data = await fetchJsonOrThrow<UsersResponse>(
                '/api/admin/users',
                'Mahita could not load user oversight data.'
            )
            setUsersState({
                data,
                loaded: true,
                loading: false,
                error: null,
            })
            setPromoteUserId((current) => {
                if (current) {
                    return current
                }

                return data.users.find((user) => user.primaryBrokerageConnection)?.id ?? ''
            })
        } catch (error) {
            setUsersState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : 'Mahita could not load user oversight data.',
            }))
        }
    }, [])

    const loadAudits = useCallback(async (force = false) => {
        setAuditsState((current) => {
            if (current.loaded && !force) {
                return current
            }

            return {
                ...current,
                loading: true,
                error: null,
            }
        })

        try {
            const data = await fetchJsonOrThrow<AuditEventsResponse>(
                '/api/admin/audit-events',
                'Mahita could not load the audit log.'
            )
            setAuditsState({
                data,
                loaded: true,
                loading: false,
                error: null,
            })
        } catch (error) {
            setAuditsState((current) => ({
                ...current,
                loading: false,
                error: error instanceof Error ? error.message : 'Mahita could not load the audit log.',
            }))
        }
    }, [])

    const loadTab = useCallback(
        async (tab: AdminTab, force = false) => {
            setGlobalError(null)

            if (tab === 'overview') {
                await loadOverview(force)
                return
            }

            if (tab === 'providers') {
                await Promise.all([loadProviderPool(force), loadUsers(force)])
                return
            }

            if (tab === 'data-command') {
                await loadDataCommand(force)
                return
            }

            if (tab === 'di-ui') {
                return
            }

            if (tab === 'users') {
                await loadUsers(force)
                return
            }

            await loadAudits(force)
        },
        [loadAudits, loadDataCommand, loadOverview, loadProviderPool, loadUsers]
    )

    useEffect(() => {
        setActiveTab(initialTab)
    }, [initialTab])

    useEffect(() => {
        void loadOverview()
    }, [loadOverview])

    useEffect(() => {
        void loadTab(activeTab)
    }, [activeTab, loadTab])

    const switchTab = (tab: AdminTab) => {
        setActiveTab(tab)
        const next = new URLSearchParams(searchParams.toString())
        next.set('tab', tab)
        router.replace(`/admin?${next.toString()}`)
    }

    const refreshVisibleTab = async () => {
        if (activeTab === 'di-ui') {
            setDiUiRefreshToken((current) => current + 1)
            return
        }
        await loadTab(activeTab, true)
    }

    const runDataAction = async (action: string, payload: Record<string, unknown> = {}) => {
        setBusyAction(action)
        setGlobalError(null)
        try {
            const response = await fetch('/api/admin/data-command/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...payload }),
            })

            if (!response.ok) {
                throw await parseResponseError(response, `Mahita could not complete ${action}.`)
            }

            await Promise.all([loadDataCommand(true), loadOverview(true)])
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : `Mahita could not complete ${action}.`)
        } finally {
            setBusyAction(null)
        }
    }

    const promoteProvider = async () => {
        setBusyAction('promote-provider')
        setGlobalError(null)
        try {
            const response = await fetch('/api/admin/provider-pool', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'promote-user-schwab',
                    targetUserId: promoteUserId || undefined,
                    isPrimary: true,
                }),
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not promote the selected provider bridge.')
            }

            await Promise.all([loadProviderPool(true), loadUsers(true), loadOverview(true)])
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : 'Mahita could not promote the selected provider bridge.')
        } finally {
            setBusyAction(null)
        }
    }

    const updateProviderMember = async (providerPoolMemberId: string, payload: Record<string, unknown>) => {
        setBusyAction(`provider-${providerPoolMemberId}`)
        setGlobalError(null)
        try {
            const response = await fetch('/api/admin/provider-pool', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ providerPoolMemberId, ...payload }),
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not update the provider member.')
            }

            await Promise.all([loadProviderPool(true), loadOverview(true)])
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : 'Mahita could not update the provider member.')
        } finally {
            setBusyAction(null)
        }
    }

    const revealCredential = async () => {
        if (!revealTarget || !revealReason.trim()) return

        setBusyAction(`reveal-${revealTarget}`)
        setGlobalError(null)
        try {
            const response = await fetch(`/api/admin/provider-pool/${revealTarget}/reveal`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: revealReason.trim() }),
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not reveal the provider credential.')
            }

            const data = await response.json()
            setRevealedCredential(data)
        } catch (error) {
            setGlobalError(error instanceof Error ? error.message : 'Mahita could not reveal the provider credential.')
        } finally {
            setBusyAction(null)
        }
    }

    return (
        <div className="flex-1 bg-[#0d0e12] text-white overflow-y-auto">
            <div className="max-w-[1600px] mx-auto px-6 py-6 flex flex-col gap-6">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">Superuser Control Plane</p>
                        <h1 className="text-3xl font-semibold tracking-tight">Admin Control</h1>
                        <p className="text-sm text-white/45 mt-2">
                            Provider pool, user oversight, audited operations, and the rebuilt data command live here now.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            void refreshVisibleTab()
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {globalError && (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                        {globalError}
                    </div>
                )}

                <div className="flex flex-wrap gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        const active = tab.id === activeTab
                        return (
                            <button
                                key={tab.id}
                                onClick={() => switchTab(tab.id)}
                                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors ${active
                                    ? 'bg-primary/15 border-primary/30 text-primary'
                                    : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                                    }`}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {activeTab === 'overview' && (
                    <>
                        {!overview && (overviewState.loading || overviewState.error) ? (
                            <TabStateMessage
                                loading={overviewState.loading}
                                error={overviewState.error}
                                empty="Overview data is not available yet."
                            />
                        ) : overview ? (
                            <>
                                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Users</p>
                                        <p className="mt-3 text-3xl font-semibold">{overview.userSummary.totalUsers}</p>
                                        <p className="mt-1 text-sm text-white/45">{overview.userSummary.usersWithBrokerage} with brokerage connected</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Provider Pool</p>
                                        <p className="mt-3 text-3xl font-semibold">{overview.runtimeSummary.platformDataProviderCount}</p>
                                        <p className="mt-1 text-sm text-white/45">active market-data pool members</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Platform Token Health</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            {overview.runtimeSummary.tokenHealth.isValid ? (
                                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <AlertTriangle className="w-5 h-5 text-amber-400" />
                                            )}
                                            <span className="text-lg font-semibold">
                                                {overview.runtimeSummary.tokenHealth.isValid ? 'Healthy' : 'Needs attention'}
                                            </span>
                                        </div>
                                        {!overview.runtimeSummary.tokenHealth.isValid && (
                                            <p className="mt-2 text-sm text-amber-200/80">{overview.runtimeSummary.tokenHealth.error}</p>
                                        )}
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Continuous Ingest</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            {overview.runtimeSummary.continuousIngest.running ? (
                                                <Play className="w-5 h-5 text-emerald-400" />
                                            ) : (
                                                <Square className="w-5 h-5 text-white/35" />
                                            )}
                                            <span className="text-lg font-semibold">
                                                {overview.runtimeSummary.continuousIngest.running ? 'Running' : 'Stopped'}
                                            </span>
                                        </div>
                                        <p className="mt-2 text-sm text-white/45">
                                            Phase: {overview.runtimeSummary.continuousIngest.currentPhase}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <h2 className="text-lg font-semibold">Runtime Health</h2>
                                        <div className="mt-4 grid grid-cols-1 gap-3 text-sm">
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Prisma client</p>
                                                <p className="mt-2 font-medium">
                                                    {overview.runtimeSummary.runtimeHealth.runtime.prismaClientReady ? 'Ready' : 'Schema/client mismatch'}
                                                </p>
                                                {!overview.runtimeSummary.runtimeHealth.runtime.prismaClientReady && (
                                                    <p className="mt-2 text-amber-200/80">
                                                        Missing models: {overview.runtimeSummary.runtimeHealth.runtime.missingPrismaModels.join(', ')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Temporary platform bridge</p>
                                                <p className="mt-2 font-medium">
                                                    {overview.runtimeSummary.runtimeHealth.runtime.insecureUserBrokeragePlatformFallbackEnabled ? 'Enabled for local dev only' : 'Disabled'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                        <div className="px-5 py-4 border-b border-white/10">
                                            <h2 className="text-lg font-semibold">Latest Audits</h2>
                                        </div>
                                        <div className="divide-y divide-white/5">
                                            {overview.latestAudits.length === 0 && (
                                                <div className="px-5 py-6 text-sm text-white/45">No admin audits recorded yet.</div>
                                            )}
                                            {overview.latestAudits.map((event) => (
                                                <div key={event.id} className="px-5 py-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="font-medium">{event.action}</div>
                                                        <div className="text-xs text-white/35">{formatDate(event.createdAt)}</div>
                                                    </div>
                                                    <p className="text-sm text-white/45 mt-1">
                                                        Actor: {event.actorUser.email || event.actorUser.name || 'Unknown'}
                                                        {event.targetUser ? ` · Target: ${event.targetUser.email || event.targetUser.name}` : ''}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : null}
                    </>
                )}

                {activeTab === 'providers' && (
                    <>
                        {providerPoolState.error && !providerPool.length && usersState.error && !users.length ? (
                            <TabStateMessage
                                loading={providerPoolState.loading || usersState.loading}
                                error={providerPoolState.error || usersState.error}
                                empty="Provider-pool data is not available yet."
                            />
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
                                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
                                    <div>
                                        <h2 className="text-lg font-semibold">Promote Provider</h2>
                                        <p className="text-sm text-white/45 mt-1">
                                            Until dedicated platform credentials exist, explicitly promote one connected superuser Schwab bridge into the market-data provider pool.
                                        </p>
                                    </div>
                                    <select
                                        value={promoteUserId}
                                        onChange={(event) => setPromoteUserId(event.target.value)}
                                        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                                        disabled={usersState.loading}
                                    >
                                        {usersWithBrokerage.length === 0 && <option value="">No connected brokerage users</option>}
                                        {usersWithBrokerage.map((user) => (
                                            <option key={user.id} value={user.id}>
                                                {user.email || user.name || user.id}
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={promoteProvider}
                                        disabled={!promoteUserId || busyAction === 'promote-provider'}
                                        className="rounded-2xl bg-primary px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
                                    >
                                        {busyAction === 'promote-provider' ? 'Promoting...' : 'Use selected user for market-data pool'}
                                    </button>
                                    {(providerPoolState.error || usersState.error) && (
                                        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                                            {providerPoolState.error || usersState.error}
                                        </div>
                                    )}
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/10">
                                        <h2 className="text-lg font-semibold">Provider Pool Members</h2>
                                    </div>
                                    <div className="divide-y divide-white/5">
                                        {providerPoolState.loading && providerPool.length === 0 && (
                                            <div className="px-5 py-6 text-sm text-white/45">Loading provider-pool members…</div>
                                        )}
                                        {!providerPoolState.loading && providerPool.length === 0 && (
                                            <div className="px-5 py-6 text-sm text-white/45">No provider pool members configured yet.</div>
                                        )}
                                        {providerPool.map((member) => {
                                            const credential = member.credential
                                            const credentialLabel = credential?.label || member.label || 'Unnamed provider'
                                            const credentialProvider = credential?.provider || 'unknown'
                                            const credentialSource = credential?.sourceType || 'unknown'
                                            const linkedUser = credential?.linkedUser ?? null

                                            return (
                                                <div key={member.id} className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-base font-medium">{credentialLabel}</span>
                                                            {member.isPrimary && <span className="text-[10px] uppercase tracking-[0.2em] text-primary">Primary</span>}
                                                            <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">{member.status}</span>
                                                        </div>
                                                        <p className="text-sm text-white/45 mt-1">
                                                            {credentialProvider} · {credentialSource} · priority {member.priority}
                                                        </p>
                                                        {credentialSource === 'USER_SCHWAB_CONFIG' && (
                                                            <p className="text-xs text-amber-200/80 mt-1">
                                                                Temporary superuser-backed bridge for local platform data fallback.
                                                            </p>
                                                        )}
                                                        {linkedUser && (
                                                            <p className="text-xs text-white/35 mt-1">
                                                                Linked user: {linkedUser.email || linkedUser.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => updateProviderMember(member.id, { isPrimary: true })}
                                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                                                        >
                                                            Make primary
                                                        </button>
                                                        <button
                                                            onClick={() => updateProviderMember(member.id, { status: member.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE' })}
                                                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10"
                                                        >
                                                            {member.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                if (!credential?.id) {
                                                                    setGlobalError('Mahita could not reveal this provider credential because it is missing its credential metadata.')
                                                                    return
                                                                }
                                                                setRevealTarget(credential.id)
                                                                setRevealedCredential(null)
                                                            }}
                                                            className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 hover:bg-amber-500/20"
                                                        >
                                                            Reveal
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'data-command' && (
                    <>
                        {!dataCommand && (dataCommandState.loading || dataCommandState.error) ? (
                            <TabStateMessage
                                loading={dataCommandState.loading}
                                error={dataCommandState.error}
                                empty="Data Command data is not available yet."
                            />
                        ) : dataCommand ? (
                            <div className="flex flex-col gap-6">
                                <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Inventory Rows</p>
                                        <p className="mt-3 text-3xl font-semibold">{dataCommand.inventorySummary.rows}</p>
                                        <p className="mt-1 text-sm text-white/45">{Math.round(dataCommand.inventorySummary.totalBars).toLocaleString()} total bars</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Average Health</p>
                                        <p className="mt-3 text-3xl font-semibold">{dataCommand.inventorySummary.avgHealthScore.toFixed(1)}%</p>
                                        <p className="mt-1 text-sm text-white/45">{dataCommand.inventorySummary.totalGaps} total gaps recorded</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Continuous Ingest</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            {dataCommand.runtime.continuousIngest.running ? <Play className="w-5 h-5 text-emerald-400" /> : <Square className="w-5 h-5 text-white/35" />}
                                            <span className="text-lg font-semibold">{dataCommand.runtime.continuousIngest.running ? 'Running' : 'Stopped'}</span>
                                        </div>
                                        <p className="mt-2 text-sm text-white/45">{dataCommand.runtime.continuousIngest.currentPhase}</p>
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                                        <p className="text-xs uppercase tracking-[0.2em] text-white/35">Provider Token</p>
                                        <div className="mt-3 flex items-center gap-2">
                                            {dataCommand.runtime.tokenHealth.isValid ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-amber-400" />}
                                            <span className="text-lg font-semibold">{dataCommand.runtime.tokenHealth.isValid ? 'Healthy' : 'Issue detected'}</span>
                                        </div>
                                        {!dataCommand.runtime.tokenHealth.isValid && (
                                            <p className="mt-2 text-sm text-amber-200/80">{dataCommand.runtime.tokenHealth.error}</p>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
                                        <h2 className="text-lg font-semibold">Operator Actions</h2>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
                                            <p className="font-medium">Runtime health</p>
                                            <p className="mt-2 text-white/60">
                                                Prisma client: {dataCommand.runtime.runtimeHealth.runtime.prismaClientReady ? 'ready' : 'schema/client mismatch'}
                                            </p>
                                            {!dataCommand.runtime.runtimeHealth.runtime.prismaClientReady && (
                                                <p className="mt-2 text-amber-200/80">
                                                    Missing models: {dataCommand.runtime.runtimeHealth.runtime.missingPrismaModels.join(', ')}
                                                </p>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => runDataAction('refresh-health')} disabled={!!busyAction} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm hover:bg-white/10 disabled:opacity-50">Refresh health</button>
                                            <button onClick={() => runDataAction('start-continuous')} disabled={!!busyAction || dataCommand.runtime.continuousIngest.running} className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm hover:bg-emerald-500/20 disabled:opacity-50">Start ingest</button>
                                            <button onClick={() => runDataAction('stop-continuous')} disabled={!!busyAction || !dataCommand.runtime.continuousIngest.running} className="rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm hover:bg-white/10 disabled:opacity-50">Stop ingest</button>
                                            <button onClick={() => runDataAction('reset-market-data', { provider: 'schwab', restartContinuous: false })} disabled={!!busyAction} className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-3 text-sm hover:bg-rose-500/20 disabled:opacity-50">Reset Schwab vault</button>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-3">
                                            <p className="text-sm font-medium">Sync specific symbol gaps</p>
                                            <input value={syncForm.symbol} onChange={(event) => setSyncForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="AAPL" />
                                            <input value={syncForm.timeframe} onChange={(event) => setSyncForm((current) => ({ ...current, timeframe: event.target.value }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="1d" />
                                            <button onClick={() => runDataAction('sync-gaps', syncForm)} disabled={!!busyAction} className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-black disabled:opacity-50">
                                                Sync gaps
                                            </button>
                                        </div>
                                    </div>

                                    <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                        <div className="px-5 py-4 border-b border-white/10">
                                            <h2 className="text-lg font-semibold">Weakest Inventory Rows</h2>
                                        </div>
                                        <div className="divide-y divide-white/5">
                                            {dataCommand.weakestInventory.length === 0 && (
                                                <div className="px-5 py-6 text-sm text-white/45">No weak inventory rows detected right now.</div>
                                            )}
                                            {dataCommand.weakestInventory.map((row) => (
                                                <div key={row.id} className="px-5 py-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-medium">{row.symbol}</span>
                                                            <span className="text-xs text-white/35">{row.timeframe}</span>
                                                            <span className="text-xs text-white/35">{row.vault?.name || 'No vault'}</span>
                                                        </div>
                                                        <p className="text-sm text-white/45 mt-1">
                                                            Health {row.healthScore.toFixed(1)}% · Coverage {row.targetCoveragePercent.toFixed(1)}% · Gaps {row.gapCount}
                                                        </p>
                                                    </div>
                                                    <button
                                                        onClick={() => runDataAction('sync-gaps', { symbol: row.symbol, timeframe: row.timeframe })}
                                                        disabled={!!busyAction}
                                                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                                                    >
                                                        Sync now
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                    <div className="px-5 py-4 border-b border-white/10">
                                        <h2 className="text-lg font-semibold">Recent Provider Events</h2>
                                    </div>
                                    <div className="max-h-[420px] overflow-y-auto divide-y divide-white/5">
                                        {dataCommand.runtime.providerEvents.length === 0 && (
                                            <div className="px-5 py-6 text-sm text-white/45">No recent provider events recorded.</div>
                                        )}
                                        {dataCommand.runtime.providerEvents.map((event) => (
                                            <div key={event.id} className="px-5 py-3 text-sm">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div className="font-medium">{event.message}</div>
                                                    <div className="text-white/35 text-xs">{formatDate(event.timestamp)}</div>
                                                </div>
                                                <div className="text-white/40 text-xs mt-1">
                                                    {[event.provider, event.symbol, event.timeframe, event.kind].filter(Boolean).join(' · ')}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </>
                )}

                {activeTab === 'di-ui' && (
                    <DiUiWorkspace refreshToken={diUiRefreshToken} />
                )}

                {activeTab === 'users' && (
                    <>
                        {!users.length && (usersState.loading || usersState.error) ? (
                            <TabStateMessage
                                loading={usersState.loading}
                                error={usersState.error}
                                empty="User oversight data is not available yet."
                            />
                        ) : (
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/10">
                                    <h2 className="text-lg font-semibold">Users</h2>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {users.map((user) => (
                                        <div key={user.id} className="px-5 py-4 grid grid-cols-1 xl:grid-cols-5 gap-3 text-sm">
                                            <div>
                                                <p className="font-medium">{user.email || user.name || user.id}</p>
                                                <p className="text-white/35">{user.role}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Brokerage</p>
                                                <p>{user.primaryBrokerageConnection ? user.primaryBrokerageConnection.status : 'Not connected'}</p>
                                                {user.primaryBrokerageConnection && (
                                                    <p className="text-white/35 text-xs mt-1">
                                                        {user.primaryBrokerageConnection.accountCount} synced account{user.primaryBrokerageConnection.accountCount === 1 ? '' : 's'}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Selected account</p>
                                                <p>{user.preferences?.selectedAccountId || 'None'}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Last page</p>
                                                <p>{user.preferences?.lastVisitedPath || 'Unknown'}</p>
                                            </div>
                                            <div>
                                                <p className="text-white/35 text-xs uppercase tracking-[0.2em]">Last sign in</p>
                                                <p>{formatDate(user.preferences?.lastSignInAt)}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {activeTab === 'audits' && (
                    <>
                        {!audits.length && (auditsState.loading || auditsState.error) ? (
                            <TabStateMessage
                                loading={auditsState.loading}
                                error={auditsState.error}
                                empty="Audit data is not available yet."
                            />
                        ) : (
                            <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                                <div className="px-5 py-4 border-b border-white/10">
                                    <h2 className="text-lg font-semibold">Audit Log</h2>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {audits.map((event) => (
                                        <div key={event.id} className="px-5 py-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="font-medium">{event.action}</div>
                                                <div className="text-xs text-white/35">{formatDate(event.createdAt)}</div>
                                            </div>
                                            <p className="text-sm text-white/45 mt-1">
                                                Actor: {event.actorUser.email || event.actorUser.name || 'Unknown'}
                                                {event.targetUser ? ` · Target: ${event.targetUser.email || event.targetUser.name}` : ''}
                                            </p>
                                            {event.reason && <p className="text-sm text-amber-200/80 mt-1">Reason: {event.reason}</p>}
                                            {event.metadata && (
                                                <pre className="mt-2 rounded-xl bg-black/20 p-3 text-xs text-white/55 whitespace-pre-wrap break-all">
                                                    {event.metadata}
                                                </pre>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {revealTarget && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
                    <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#11141c] p-6 flex flex-col gap-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-semibold">Break-glass credential reveal</h3>
                                <p className="text-sm text-white/45 mt-1">
                                    This action is audited. Provide a reason, then the credential will be revealed briefly for operational recovery only.
                                </p>
                            </div>
                            <button onClick={() => { setRevealTarget(null); setRevealReason(''); setRevealedCredential(null) }} className="text-white/50 hover:text-white">
                                Close
                            </button>
                        </div>

                        <textarea
                            value={revealReason}
                            onChange={(event) => setRevealReason(event.target.value)}
                            className="min-h-28 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                            placeholder="Why is secret access required?"
                        />

                        <div className="flex gap-3">
                            <button
                                onClick={revealCredential}
                                disabled={!revealReason.trim() || !!busyAction}
                                className="rounded-2xl bg-amber-400 px-4 py-3 text-sm font-medium text-black disabled:opacity-50"
                            >
                                {busyAction?.startsWith('reveal-') ? 'Revealing...' : 'Reveal credential'}
                            </button>
                        </div>

                        {revealedCredential?.credential && (
                            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
                                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">Reveal grant</p>
                                <p className="text-sm mt-1">{revealedCredential.revealGrantId}</p>
                                {revealedCredential.recentAuthAt && (
                                    <>
                                        <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80 mt-4">Recent auth verified</p>
                                        <p className="text-sm mt-1">{formatDate(revealedCredential.recentAuthAt)}</p>
                                    </>
                                )}
                                <p className="text-xs uppercase tracking-[0.2em] text-amber-200/80 mt-4">Reveal expires</p>
                                <p className="text-sm mt-1">{formatDate(revealedCredential.revealExpiresAt)}</p>
                                <pre className="mt-4 rounded-xl bg-black/30 p-4 text-xs text-amber-50 whitespace-pre-wrap break-all">
                                    {JSON.stringify(revealedCredential.credential, null, 2)}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
