'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  Database,
  Pause,
  Play,
  Radar,
  RefreshCw,
  ShieldCheck,
  Workflow,
} from 'lucide-react'
import { parseResponseError } from '@/lib/app-errors'

type DiUiSection = 'scheduler' | 'caller' | 'processor' | 'verification' | 'storage'

interface RemoteState<T> {
  data: T | null
  loading: boolean
  loaded: boolean
  error: string | null
}

const emptyState = <T,>(): RemoteState<T> => ({
  data: null,
  loading: false,
  loaded: false,
  error: null,
})

const sectionConfig: Array<{ id: DiUiSection; label: string; icon: typeof Radar; accent: string }> = [
  { id: 'scheduler', label: 'Scheduler', icon: Radar, accent: 'from-cyan-500/20 to-blue-500/10' },
  { id: 'caller', label: 'Caller', icon: Activity, accent: 'from-emerald-500/20 to-cyan-500/10' },
  { id: 'processor', label: 'Processor', icon: Workflow, accent: 'from-violet-500/20 to-indigo-500/10' },
  { id: 'verification', label: 'Verification', icon: ShieldCheck, accent: 'from-amber-500/20 to-orange-500/10' },
  { id: 'storage', label: 'Storage', icon: Database, accent: 'from-fuchsia-500/20 to-rose-500/10' },
]

interface SchedulerResponse {
  runtimeHealth: {
    ok: boolean
    runtime: {
      prismaClientReady: boolean
      missingPrismaModels: string[]
      diUiPrismaClientReady: boolean
      missingDiUiPrismaModels: string[]
      hasDedicatedAppSecretKey: boolean
      platformData: {
        canonicalBarSource?: string
        parquetRouteStatus?: string
        inventoryAuthority?: string
      }
    }
  }
  scheduler: {
    profile: {
      id: string
      name: string
      label: string | null
      description: string | null
      status: string
        providerBudgets: Array<{
          provider: string
          maxCallsPerMinute: number
          enabled: boolean
          runtimeAvailable?: boolean
          note?: string
          usedLastMinute: number
        errorCountLastMinute: number
        retryCountLastMinute: number
        throttledSymbols: string[]
        lastError: string | null
        remainingCalls: number
      }>
    }
    availableProfiles: Array<{
      id: string
      name: string
      label: string | null
      status: string
      isDefault: boolean
    }>
    lanes: Array<{
      id: string
      kind: string
      enabled: boolean
      priorityOrder: number
      weight: number
      reservedCallsPerMinute: number | null
      minCallsPerMinute: number | null
      targetRefreshSeconds: number | null
      providerPreference: string | null
      canonicalIntervals: string[]
      queued: number
      running: number
      completed: number
      failed: number
    }>
    targets: Array<{
      id: string
      name: string
      preset: string
      enabled: boolean
      providerPreference: string | null
      canonicalIntervals: string[]
      symbolCount: number
      previewSymbols: string[]
      symbols: Array<{
        id: string
        symbol: string
        enabled: boolean
        canonicalIntervals: string[]
      }>
    }>
    availableUniverseSymbols: string[]
    viewDemands: Array<{
      id: string
      surface: string
      symbol: string | null
      timeframe: string | null
      priorityScore: number
      refreshIntervalSeconds: number
      lastSeenAt: string
      expiresAt: string
    }>
    runtime: {
      continuousIngest: {
        running: boolean
        currentPhase: string
        intervalMs: number
        schedulerEnabled: boolean
        lastCycleSummary: {
          dispatchedIngestionJobs: number
          dispatchedVerificationJobs: number
          queuePressureMode: 'balanced' | 'one-minute-biased'
          afterHoursMode: boolean
        } | null
      }
      afterHoursMode: boolean
      queuePressureMode: 'balanced' | 'one-minute-biased'
      queueMetrics: {
        totalQueued: number
        totalRunning: number
        totalFailed: number
        oldestQueuedAt: string | null
      }
    }
    recentJobs: Array<{
      id: string
      laneKind: string
      symbol: string
      requestedTimeframe: string
      storageTimeframe: string
      provider: string
      status: string
      updatedAt: string
      scheduledFor: string
      lastError: string | null
      provenanceStatus: string | null
      verificationStatus: string | null
    }>
    recentDispatchLogs: Array<{
      id: string
      stage: string
      message: string
      provider: string | null
      symbol: string | null
      requestedTimeframe: string | null
      storageTimeframe: string | null
      createdAt: string
      metadata: string | null
    }>
    verificationSummary: {
      queued: number
      running: number
      completed: number
      failed: number
    }
  } | null
}

interface CallerResponse {
  metrics: Array<{
    provider: string
    callsPerMinute: number
    errorCount: number
    retryCount: number
    throttledSymbols: string[]
    lastError: string | null
  }>
  events: Array<{
    id: string
    timestamp: string
    kind: string
    provider?: string
    symbol?: string
    timeframe?: string
    message: string
    response?: Record<string, unknown>
  }>
}

interface ProcessorResponse {
  runtimeHealth: {
    ok: boolean
    runtime: {
      diUiPrismaClientReady: boolean
      missingDiUiPrismaModels: string[]
    }
  }
  jobs: Array<{
    id: string
    laneKind: string
    symbol: string
    requestedTimeframe: string
    storageTimeframe: string
    provider: string
    status: string
    updatedAt: string
    lastError: string | null
    resultSummary: string | null
    provenanceStatus: string | null
    verificationStatus: string | null
    vaultName: string | null
  }> | null
  logs: Array<{
    id: string
    stage: string
    message: string
    provider: string | null
    symbol: string | null
    requestedTimeframe: string | null
    storageTimeframe: string | null
    metadata: string | null
    createdAt: string
  }> | null
}

interface VerificationResponse {
  runtimeHealth: {
    ok: boolean
    runtime: {
      diUiPrismaClientReady: boolean
      missingDiUiPrismaModels: string[]
    }
  }
  jobs: Array<{
    id: string
    laneKind: string
    mode: string
    symbol: string
    timeframe: string
    sourceProvider: string | null
    comparisonProvider: string | null
    status: string
    scheduledFor: string
    completedAt: string | null
    lastError: string | null
    resultSummary: string | null
  }> | null
  observations: Array<{
    id: string
    verificationJobId: string
    barTime: string
    classification: string
    decision: string
    primaryProvider: string | null
    secondaryProvider: string | null
    primaryClose: number | null
    secondaryClose: number | null
    priceDiffBps: number | null
    volumeDiffPct: number | null
    createdAt: string
  }> | null
  statusSummary: Record<string, number>
  classificationSummary: Record<string, number>
}

interface StorageResponse {
  vaults: Array<{ id: string; name: string; type: string; isEnabled: boolean }>
  inventories: Array<{
    id: string
    symbol: string
    timeframe: string
    healthScore: number
    gapCount: number
    barCount: number
    storageClass: string
    canonicalInterval: string | null
    verificationStatus: string
    verificationMethod: string | null
    lastVerifiedAt: string | null
    vault: { name: string; type: string; isEnabled: boolean } | null
  }>
  bars: {
    bars: Array<{
      id: string
      time: number
      open: number
      high: number
      low: number
      close: number
      volume: number
      source: string | null
    }>
    totalCount: number
  }
  filters: {
    symbol: string
    timeframe: string
    vaultName: string
    verificationStatus?: string | null
    page: number
    pageSize: number
  }
}

async function fetchJsonOrThrow<T>(url: string, fallbackMessage: string) {
  const response = await fetch(url, { cache: 'no-store' })
  if (!response.ok) {
    throw await parseResponseError(response, fallbackMessage)
  }

  return response.json() as Promise<T>
}

function StateMessage({ state, empty }: { state: RemoteState<unknown>; empty: string }) {
  if (state.loading && !state.data) {
    return <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/50">Loading…</div>
  }

  if (state.error && !state.data) {
    return <div className="rounded-3xl border border-rose-500/30 bg-rose-500/10 px-5 py-6 text-sm text-rose-200">{state.error}</div>
  }

  return <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-6 text-sm text-white/45">{empty}</div>
}

function formatDate(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleString()
}

function formatPercent(value: number) {
  return `${value.toFixed(2)}%`
}

function getVerificationTone(status?: string | null) {
  switch (status) {
    case 'cross-source-verified':
      return 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
    case 'same-source-verified':
      return 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
    case 'derived-from-verified-base':
      return 'border-indigo-400/35 bg-indigo-500/15 text-indigo-100'
    case 'disputed':
      return 'border-rose-400/35 bg-rose-500/15 text-rose-100'
    case 'stale':
      return 'border-amber-400/35 bg-amber-500/15 text-amber-100'
    default:
      return 'border-white/10 bg-black/20 text-white/60'
  }
}

function getProvenanceTone(status?: string | null) {
  switch (status) {
    case 'native-cached':
    case 'native':
      return 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
    case 'derived':
      return 'border-violet-400/35 bg-violet-500/15 text-violet-100'
    default:
      return 'border-white/10 bg-black/20 text-white/60'
  }
}

function parseJsonSummary<T>(value?: string | null): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

export function DiUiWorkspace({ refreshToken = 0 }: { refreshToken?: number }) {
  const [activeSection, setActiveSection] = useState<DiUiSection>('scheduler')
  const [schedulerState, setSchedulerState] = useState<RemoteState<SchedulerResponse>>(() => ({ ...emptyState(), loading: true }))
  const [callerState, setCallerState] = useState<RemoteState<CallerResponse>>(emptyState)
  const [processorState, setProcessorState] = useState<RemoteState<ProcessorResponse>>(emptyState)
  const [verificationState, setVerificationState] = useState<RemoteState<VerificationResponse>>(emptyState)
  const [storageState, setStorageState] = useState<RemoteState<StorageResponse>>(emptyState)
  const [globalError, setGlobalError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)
  const [callerFilter, setCallerFilter] = useState({ provider: 'all', kind: 'all', search: '' })
  const [storageFilters, setStorageFilters] = useState({ symbol: 'AAPL', timeframe: '1m', vault: 'auto', verificationStatus: 'all', page: 1, pageSize: 50 })
  const [verificationForm, setVerificationForm] = useState({ symbol: 'AAPL', timeframe: '1m', mode: 'BOTH' })
  const [editableLaneState, setEditableLaneState] = useState<Record<string, { weight: number; enabled: boolean; targetRefreshSeconds: number }>>({})
  const [editableProviderBudgets, setEditableProviderBudgets] = useState<Record<string, { maxCallsPerMinute: number; enabled: boolean; note?: string }>>({})
  const [targetSymbolSearch, setTargetSymbolSearch] = useState('')
  const callerStreamRef = useRef<EventSource | null>(null)

  const loadScheduler = useCallback(async (force = false) => {
    setSchedulerState((current) => current.loaded && !force ? current : { ...current, loading: true, error: null })
    try {
      const data = await fetchJsonOrThrow<SchedulerResponse>('/api/admin/di-ui/scheduler', 'Mahita could not load the DI-UI scheduler view.')
      setSchedulerState({ data, loading: false, loaded: true, error: null })
      if (data.scheduler?.profile.id) {
        setActiveProfileId(data.scheduler.profile.id)
      }
      if (!data.scheduler) {
        setEditableLaneState({})
        setEditableProviderBudgets({})
        return
      }
      const scheduler = data.scheduler
      setEditableLaneState((current) => {
        if (Object.keys(current).length > 0 && !force) return current
        return Object.fromEntries(scheduler.lanes.map((lane) => [lane.id, {
          weight: lane.weight,
          enabled: lane.enabled,
          targetRefreshSeconds: lane.targetRefreshSeconds ?? 13,
        }]))
      })
      setEditableProviderBudgets((current) => {
        if (Object.keys(current).length > 0 && !force) return current
        return Object.fromEntries(scheduler.profile.providerBudgets.map((budget) => [budget.provider, {
          maxCallsPerMinute: budget.maxCallsPerMinute,
          enabled: budget.enabled,
          note: budget.note,
        }]))
      })
    } catch (error) {
      setSchedulerState((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded,
        error: error instanceof Error ? error.message : 'Mahita could not load the DI-UI scheduler view.',
      }))
    }
  }, [])

  const loadCaller = useCallback(async (force = false) => {
    setCallerState((current) => current.loaded && !force ? current : { ...current, loading: true, error: null })
    try {
      const data = await fetchJsonOrThrow<CallerResponse>('/api/admin/di-ui/caller', 'Mahita could not load the DI-UI caller view.')
      setCallerState({ data, loading: false, loaded: true, error: null })
    } catch (error) {
      setCallerState((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded,
        error: error instanceof Error ? error.message : 'Mahita could not load the DI-UI caller view.',
      }))
    }
  }, [])

  const loadProcessor = useCallback(async (force = false) => {
    setProcessorState((current) => current.loaded && !force ? current : { ...current, loading: true, error: null })
    try {
      const data = await fetchJsonOrThrow<ProcessorResponse>('/api/admin/di-ui/processor', 'Mahita could not load the DI-UI processor view.')
      setProcessorState({ data, loading: false, loaded: true, error: null })
    } catch (error) {
      setProcessorState((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded,
        error: error instanceof Error ? error.message : 'Mahita could not load the DI-UI processor view.',
      }))
    }
  }, [])

  const loadVerification = useCallback(async (force = false) => {
    setVerificationState((current) => current.loaded && !force ? current : { ...current, loading: true, error: null })
    try {
      const data = await fetchJsonOrThrow<VerificationResponse>('/api/admin/di-ui/verification', 'Mahita could not load the DI-UI verification view.')
      setVerificationState({ data, loading: false, loaded: true, error: null })
    } catch (error) {
      setVerificationState((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded,
        error: error instanceof Error ? error.message : 'Mahita could not load the DI-UI verification view.',
      }))
    }
  }, [])

  const loadStorage = useCallback(async (force = false) => {
    setStorageState((current) => current.loaded && !force ? current : { ...current, loading: true, error: null })
    try {
      const params = new URLSearchParams({
        symbol: storageFilters.symbol,
        timeframe: storageFilters.timeframe,
        vault: storageFilters.vault,
        page: String(storageFilters.page),
        pageSize: String(storageFilters.pageSize),
      })
      if (storageFilters.verificationStatus !== 'all') {
        params.set('verificationStatus', storageFilters.verificationStatus)
      }
      const data = await fetchJsonOrThrow<StorageResponse>(`/api/admin/di-ui/storage?${params.toString()}`, 'Mahita could not load the DI-UI storage view.')
      setStorageState({ data, loading: false, loaded: true, error: null })
    } catch (error) {
      setStorageState((current) => ({
        ...current,
        loading: false,
        loaded: current.loaded,
        error: error instanceof Error ? error.message : 'Mahita could not load the DI-UI storage view.',
      }))
    }
  }, [storageFilters])

  useEffect(() => {
    void loadScheduler()
  }, [loadScheduler])

  useEffect(() => {
    if (activeSection === 'caller') {
      void loadCaller()
    } else if (activeSection === 'processor') {
      void loadProcessor()
    } else if (activeSection === 'verification') {
      void loadVerification()
    } else if (activeSection === 'storage') {
      void loadStorage()
    }
  }, [activeSection, loadCaller, loadProcessor, loadStorage, loadVerification])

  useEffect(() => {
    if (activeSection !== 'caller') {
      callerStreamRef.current?.close()
      callerStreamRef.current = null
      return
    }

    const source = new EventSource('/api/admin/di-ui/caller/stream')
    callerStreamRef.current = source

    source.addEventListener('snapshot', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data)
        if (!Array.isArray(payload?.events)) return
        setCallerState((current) => ({
          ...current,
          data: {
            metrics: current.data?.metrics ?? [],
            events: payload.events,
          },
        }))
      } catch (error) {
        console.warn('Mahita could not parse DI-UI caller snapshot:', error)
      }
    })

    source.addEventListener('provider', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data)
        setCallerState((current) => {
          const existing = current.data?.events ?? []
          const nextEvents = [...existing, payload].slice(-300)
          return {
            ...current,
            data: {
              metrics: current.data?.metrics ?? [],
              events: nextEvents,
            },
          }
        })
      } catch (error) {
        console.warn('Mahita could not parse DI-UI caller event:', error)
      }
    })

    source.onerror = () => {
      source.close()
      callerStreamRef.current = null
    }

    return () => {
      source.close()
      callerStreamRef.current = null
    }
  }, [activeSection])

  useEffect(() => {
    void loadScheduler(true)
    if (activeSection === 'caller') {
      void loadCaller(true)
      return
    }
    if (activeSection === 'processor') {
      void loadProcessor(true)
      return
    }
    if (activeSection === 'verification') {
      void loadVerification(true)
      return
    }
    if (activeSection === 'storage') {
      void loadStorage(true)
    }
  }, [activeSection, loadCaller, loadProcessor, loadScheduler, loadStorage, loadVerification, refreshToken])

  useEffect(() => {
    const intervalMs = activeSection === 'storage' ? 10_000 : 5_000
    const interval = window.setInterval(() => {
      if (activeSection === 'scheduler') {
        void loadScheduler(true)
        return
      }
      if (activeSection === 'caller') {
        void loadCaller(true)
        return
      }
      if (activeSection === 'processor') {
        void loadProcessor(true)
        return
      }
      if (activeSection === 'verification') {
        void loadVerification(true)
        return
      }
      if (activeSection === 'storage') {
        void loadStorage(true)
      }
    }, intervalMs)

    return () => window.clearInterval(interval)
  }, [activeSection, loadCaller, loadProcessor, loadScheduler, loadStorage, loadVerification])

  const runSchedulerAction = useCallback(async (body: Record<string, unknown>) => {
    setBusyAction(String(body.action))
    setGlobalError(null)
    try {
      const response = await fetch('/api/admin/di-ui/scheduler/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        throw await parseResponseError(response, 'Mahita could not complete the DI-UI scheduler action.')
      }
      const payload = await response.json().catch(() => ({ success: true }))
      if (payload && payload.success === false) {
        setGlobalError(payload.failure || payload.error || 'Mahita could not complete the DI-UI scheduler action.')
      }
      await Promise.all([loadScheduler(true), loadProcessor(true), loadVerification(true)])
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Mahita could not complete the DI-UI scheduler action.')
    } finally {
      setBusyAction(null)
    }
  }, [loadProcessor, loadScheduler, loadVerification])

  const runVerificationAction = useCallback(async (body: Record<string, unknown>) => {
    setBusyAction(String(body.action))
    setGlobalError(null)
    try {
      const response = await fetch('/api/admin/di-ui/verification/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        throw await parseResponseError(response, 'Mahita could not complete the DI-UI verification action.')
      }
      const payload = await response.json().catch(() => ({ success: true }))
      if (payload && payload.success === false) {
        setGlobalError(payload.failure || payload.error || 'Mahita could not complete the DI-UI verification action.')
      }
      await Promise.all([loadVerification(true), loadScheduler(true), loadProcessor(true)])
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Mahita could not complete the DI-UI verification action.')
    } finally {
      setBusyAction(null)
    }
  }, [loadProcessor, loadScheduler, loadVerification])

  const schedulerData = schedulerState.data?.scheduler ?? null
  const customTarget = schedulerData?.targets.find((target) => target.preset === 'CUSTOM') ?? null
  const filteredUniverseSymbols = useMemo(() => {
    const available = schedulerData?.availableUniverseSymbols ?? []
    if (!targetSymbolSearch.trim()) {
      return available.slice(0, 80)
    }
    const search = targetSymbolSearch.trim().toUpperCase()
    return available.filter((symbol) => symbol.includes(search)).slice(0, 80)
  }, [schedulerData?.availableUniverseSymbols, targetSymbolSearch])

  const toggleTargetInterval = useCallback(async (targetId: string, intervals: string[], interval: string) => {
    const nextIntervals = intervals.includes(interval)
      ? intervals.filter((item) => item !== interval)
      : [...intervals, interval].sort()

    await runSchedulerAction({
      action: 'save-profile',
      profileId: activeProfileId,
      targetUpdates: [{ targetId, canonicalIntervals: nextIntervals.length > 0 ? nextIntervals : ['1m'] }],
    })
  }, [activeProfileId, runSchedulerAction])

  const toggleCustomSymbol = useCallback(async (symbol: string, enabled: boolean, canonicalIntervals: string[] = ['1m']) => {
    if (!customTarget || !activeProfileId) return
    await runSchedulerAction({
      action: 'save-profile',
      profileId: activeProfileId,
      targetSymbolUpdates: [{
        targetId: customTarget.id,
        symbol,
        enabled,
        canonicalIntervals,
      }],
    })
  }, [activeProfileId, customTarget, runSchedulerAction])

  const filteredCallerEvents = useMemo(() => {
    const events = callerState.data?.events ?? []
    return events.filter((event) => {
      if (callerFilter.provider !== 'all' && event.provider !== callerFilter.provider) return false
      if (callerFilter.kind !== 'all' && event.kind !== callerFilter.kind) return false
      if (!callerFilter.search) return true
      const search = callerFilter.search.toLowerCase()
      return [event.symbol, event.timeframe, event.message, event.provider].some((value) => value?.toLowerCase().includes(search))
    })
  }, [callerFilter, callerState.data?.events])


  const sectionBody = () => {
    if (activeSection === 'scheduler') {
      const state = schedulerState
      const data = state.data
      if (!data) {
        return <StateMessage state={state} empty="Scheduler data is not available yet." />
      }
      if (!data.scheduler) {
        return (
          <div className="flex flex-col gap-6 animate-[di-ui-enter_260ms_ease-out]">
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-5 text-sm text-amber-100">
              <div className="font-medium">DI-UI runtime needs attention.</div>
              <div className="mt-2 text-amber-100/85">
                Mahita can see the admin runtime, but the DI-UI scheduler and verification Prisma models are not ready yet.
              </div>
              <div className="mt-3 text-xs text-amber-100/70">
                Missing models: {data.runtimeHealth.runtime.missingDiUiPrismaModels.join(', ') || 'none'}
              </div>
            </div>
          </div>
        )
      }
      const scheduler = data.scheduler

      return (
        <div className="flex flex-col gap-6 animate-[di-ui-enter_260ms_ease-out]">
          {!data.runtimeHealth.runtime.diUiPrismaClientReady && (
            <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-5 text-sm text-amber-100">
              DI-UI Prisma models are not fully ready. Missing: {data.runtimeHealth.runtime.missingDiUiPrismaModels.join(', ')}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Scheduler</p>
              <div className="mt-3 flex items-center gap-2">
                {scheduler.runtime.continuousIngest.running ? <Play className="w-5 h-5 text-emerald-400" /> : <Pause className="w-5 h-5 text-white/35" />}
                <span className="text-xl font-semibold">{scheduler.runtime.continuousIngest.running ? 'Running' : 'Stopped'}</span>
              </div>
              <p className="mt-2 text-sm text-white/45">{scheduler.runtime.continuousIngest.currentPhase}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">After Hours Bias</p>
              <p className="mt-3 text-xl font-semibold">{scheduler.runtime.afterHoursMode ? 'Verification window' : 'Freshness window'}</p>
              <p className="mt-2 text-sm text-white/45">{scheduler.runtime.queuePressureMode === 'one-minute-biased' ? '1m backlog prioritized' : 'Realtime and 1m balanced'}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Dispatch Last Cycle</p>
              <p className="mt-3 text-xl font-semibold">
                {scheduler.runtime.continuousIngest.lastCycleSummary?.dispatchedIngestionJobs ?? 0} ingest / {scheduler.runtime.continuousIngest.lastCycleSummary?.dispatchedVerificationJobs ?? 0} verify
              </p>
              <p className="mt-2 text-sm text-white/45">Interval {Math.round(scheduler.runtime.continuousIngest.intervalMs / 1000)}s</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Runtime Truth</p>
              <p className="mt-3 text-xl font-semibold">{data.runtimeHealth.runtime.platformData.canonicalBarSource || 'vault-sqlite'}</p>
              <p className="mt-2 text-sm text-white/45">
                Inventory authority: {data.runtimeHealth.runtime.platformData.inventoryAuthority || 'main-prisma-db'}
              </p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Queue Backlog</p>
              <p className="mt-3 text-xl font-semibold">
                {scheduler.runtime.queueMetrics.totalQueued} queued · {scheduler.runtime.queueMetrics.totalRunning} running
              </p>
              <p className="mt-2 text-sm text-white/45">
                oldest {scheduler.runtime.queueMetrics.oldestQueuedAt ? formatDate(scheduler.runtime.queueMetrics.oldestQueuedAt) : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold">Live Scheduler Policy</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${
                      scheduler.profile.status === 'ACTIVE'
                        ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-amber-400/30 bg-amber-500/10 text-amber-100'
                    }`}>
                      {scheduler.profile.status}
                    </span>
                  </div>
                  <p className="text-sm text-white/45 mt-1">{scheduler.profile.label || scheduler.profile.name}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={activeProfileId || scheduler.profile.id}
                    onChange={(event) => setActiveProfileId(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                  >
                    {scheduler.availableProfiles.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {(profile.label || profile.name)}{profile.isDefault ? ' · active' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => activeProfileId && runSchedulerAction({ action: 'set-active-profile', profileId: activeProfileId })}
                    disabled={!activeProfileId || activeProfileId === scheduler.profile.id || busyAction === 'set-active-profile'}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    Use profile
                  </button>
                  <button
                    onClick={() => runSchedulerAction({ action: 'start-scheduler', profileId: scheduler.profile.id })}
                    disabled={busyAction === 'start-scheduler'}
                    className="rounded-2xl bg-emerald-500/15 px-4 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-50"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => runSchedulerAction({ action: 'stop-scheduler', profileId: scheduler.profile.id })}
                    disabled={busyAction === 'stop-scheduler'}
                    className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-50"
                  >
                    Stop
                  </button>
                  <button
                    onClick={() => runSchedulerAction({
                      action: 'save-profile',
                      profileId: scheduler.profile.id,
                      laneWeights: scheduler.lanes.map((lane) => ({
                        laneId: lane.id,
                        weight: editableLaneState[lane.id]?.weight ?? lane.weight,
                        enabled: editableLaneState[lane.id]?.enabled ?? lane.enabled,
                        targetRefreshSeconds: editableLaneState[lane.id]?.targetRefreshSeconds ?? lane.targetRefreshSeconds ?? 13,
                      })),
                      providerBudgets: scheduler.profile.providerBudgets.map((budget) => ({
                        provider: budget.provider,
                        maxCallsPerMinute: editableProviderBudgets[budget.provider]?.maxCallsPerMinute ?? budget.maxCallsPerMinute,
                        enabled: editableProviderBudgets[budget.provider]?.enabled ?? budget.enabled,
                        note: editableProviderBudgets[budget.provider]?.note ?? budget.note,
                      })),
                    })}
                    disabled={busyAction === 'save-profile'}
                    className="rounded-2xl bg-primary px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
                  >
                    Save policy
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {scheduler.profile.providerBudgets.map((budget) => {
                  const editable = editableProviderBudgets[budget.provider] || {
                    maxCallsPerMinute: budget.maxCallsPerMinute,
                    enabled: budget.enabled,
                    note: budget.note,
                  }
                  return (
                    <div key={budget.provider} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium uppercase tracking-[0.2em] text-white/60">{budget.provider}</p>
                          <p className="text-xs text-white/35 mt-1">
                            {editable.note || 'Provider budget'}{budget.runtimeAvailable === false ? ' · runtime unavailable' : ''}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-white/60">
                          <input
                            type="checkbox"
                            checked={editable.enabled}
                            onChange={(event) => setEditableProviderBudgets((current) => ({
                              ...current,
                              [budget.provider]: {
                                ...editable,
                                enabled: event.target.checked,
                              },
                            }))}
                          />
                          Enabled
                        </label>
                      </div>
                      <div className="mt-4 flex items-end justify-between gap-4">
                        <div>
                          <p className="text-3xl font-semibold">{budget.usedLastMinute}/{editable.maxCallsPerMinute}</p>
                          <p className="text-sm text-white/45">calls this minute</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-semibold text-cyan-200">{budget.remainingCalls}</p>
                          <p className="text-xs text-white/45">remaining</p>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          onClick={() => setEditableProviderBudgets((current) => ({
                            ...current,
                            [budget.provider]: {
                              ...editable,
                              maxCallsPerMinute: Math.max(1, editable.maxCallsPerMinute - 1),
                            },
                          }))}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                        >
                          -
                        </button>
                        <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-sm">
                          {editable.maxCallsPerMinute} calls/min
                        </div>
                        <button
                          onClick={() => setEditableProviderBudgets((current) => ({
                            ...current,
                            [budget.provider]: {
                              ...editable,
                              maxCallsPerMinute: editable.maxCallsPerMinute + 1,
                            },
                          }))}
                          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                        >
                          +
                        </button>
                      </div>
                      {(budget.lastError || budget.throttledSymbols.length > 0) && (
                        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-xs text-amber-100/85">
                          {budget.lastError || `${budget.throttledSymbols.length} throttled symbols`}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Active View Demand</h3>
                <p className="text-sm text-white/45 mt-1">Currently visible user surfaces that can pull the scheduler toward live freshness.</p>
              </div>
              <div className="space-y-3">
                {scheduler.viewDemands.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 px-4 py-5 text-sm text-white/45">
                    No active view-demand signals are registered right now.
                  </div>
                )}
                {scheduler.viewDemands.map((demand) => (
                  <div key={demand.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{demand.surface}</p>
                        <p className="text-sm text-white/45">{demand.symbol || 'surface-wide'} {demand.timeframe ? `· ${demand.timeframe}` : ''}</p>
                      </div>
                      <div className="text-right text-xs text-white/45">
                        <div>{demand.refreshIntervalSeconds}s refresh</div>
                        <div>expires {formatDate(demand.expiresAt)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold">Lane Allocations</h3>
              </div>
              <div className="divide-y divide-white/5">
                {scheduler.lanes.map((lane) => {
                  const editable = editableLaneState[lane.id] || {
                    weight: lane.weight,
                    enabled: lane.enabled,
                    targetRefreshSeconds: lane.targetRefreshSeconds ?? 13,
                  }
                  return (
                    <div key={lane.id} className="px-5 py-4 flex flex-col gap-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{lane.kind}</span>
                            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{lane.providerPreference || 'auto'}</span>
                          </div>
                          <p className="text-sm text-white/45 mt-1">
                            queued {lane.queued} · running {lane.running} · completed {lane.completed} · failed {lane.failed}
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 text-xs text-white/60">
                          <input
                            type="checkbox"
                            checked={editable.enabled}
                            onChange={(event) => setEditableLaneState((current) => ({
                              ...current,
                              [lane.id]: {
                                ...editable,
                                enabled: event.target.checked,
                              },
                            }))}
                          />
                          Enabled
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/35">Weight</p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => setEditableLaneState((current) => ({
                                ...current,
                                [lane.id]: {
                                  ...editable,
                                  weight: Math.max(0.05, Number((editable.weight - 0.05).toFixed(2))),
                                },
                              }))}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            >
                              -
                            </button>
                            <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-sm">
                              {editable.weight.toFixed(2)}
                            </div>
                            <button
                              onClick={() => setEditableLaneState((current) => ({
                                ...current,
                                [lane.id]: {
                                  ...editable,
                                  weight: Number((editable.weight + 0.05).toFixed(2)),
                                },
                              }))}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/35">Refresh target</p>
                          <div className="mt-3 flex items-center gap-2">
                            <button
                              onClick={() => setEditableLaneState((current) => ({
                                ...current,
                                [lane.id]: {
                                  ...editable,
                                  targetRefreshSeconds: Math.max(3, editable.targetRefreshSeconds - 1),
                                },
                              }))}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            >
                              -
                            </button>
                            <div className="flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-center text-sm">
                              {editable.targetRefreshSeconds}s
                            </div>
                            <button
                              onClick={() => setEditableLaneState((current) => ({
                                ...current,
                                [lane.id]: {
                                  ...editable,
                                  targetRefreshSeconds: editable.targetRefreshSeconds + 1,
                                },
                              }))}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                          <p className="text-xs uppercase tracking-[0.2em] text-white/35">Canonical intervals</p>
                          <p className="mt-3 text-sm text-white">{lane.canonicalIntervals.join(', ') || 'None'}</p>
                          <p className="mt-1 text-xs text-white/45">
                            reserved {lane.reservedCallsPerMinute ?? 0} · min {lane.minCallsPerMinute ?? 0}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold">Universe Control</h3>
              </div>
              <div className="divide-y divide-white/5">
                {scheduler.targets.map((target) => (
                  <div key={target.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{target.name}</span>
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{target.preset}</span>
                        </div>
                        <p className="text-sm text-white/45 mt-1">
                          {target.symbolCount} symbols · {target.canonicalIntervals.join(', ')}
                        </p>
                      </div>
                      <button
                        onClick={() => runSchedulerAction({
                          action: 'save-profile',
                          profileId: activeProfileId || scheduler.profile.id,
                          targetUpdates: [{ targetId: target.id, enabled: !target.enabled }],
                        })}
                        disabled={busyAction === 'save-profile'}
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs hover:bg-white/10 disabled:opacity-50"
                      >
                        {target.enabled ? 'Disable' : 'Enable'}
                      </button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {['1m', '1h', '1w'].map((interval) => {
                        const enabled = target.canonicalIntervals.includes(interval)
                        return (
                          <button
                            key={interval}
                            onClick={() => void toggleTargetInterval(target.id, target.canonicalIntervals, interval)}
                            className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] transition ${enabled ? 'border-cyan-400/40 bg-cyan-400/15 text-cyan-100' : 'border-white/10 bg-black/20 text-white/45 hover:bg-white/10'}`}
                          >
                            {interval}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-xs text-white/45 leading-6">{target.previewSymbols.join(' · ') || 'No symbols enabled yet.'}</p>

                    {target.preset === 'CUSTOM' && (
                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">Custom symbol control</p>
                            <p className="text-xs text-white/45 mt-1">Search the current starter universe and enable symbols for custom ingestion.</p>
                          </div>
                          <input
                            value={targetSymbolSearch}
                            onChange={(event) => setTargetSymbolSearch(event.target.value.toUpperCase())}
                            placeholder="Search symbol"
                            className="w-48 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
                          {filteredUniverseSymbols.map((symbol) => {
                            const current = target.symbols.find((item) => item.symbol === symbol)
                            const enabled = current?.enabled ?? false
                            return (
                              <button
                                key={symbol}
                                onClick={() => void toggleCustomSymbol(symbol, !enabled, current?.canonicalIntervals || target.canonicalIntervals)}
                                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${enabled ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100' : 'border-white/10 bg-black/30 text-white/70 hover:bg-white/10'}`}
                              >
                                {symbol}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (activeSection === 'caller') {
      const state = callerState
      const data = state.data
      if (!data) {
        return <StateMessage state={state} empty="Caller data is not available yet." />
      }

      return (
        <div className="flex flex-col gap-6 animate-[di-ui-enter_260ms_ease-out]">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {(data.metrics.length ? data.metrics : [{ provider: 'No provider data yet', callsPerMinute: 0, errorCount: 0, retryCount: 0, throttledSymbols: [], lastError: null }]).map((metric) => (
              <div key={metric.provider} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-white/35">{metric.provider}</p>
                <p className="mt-3 text-3xl font-semibold">{metric.callsPerMinute}</p>
                <p className="mt-1 text-sm text-white/45">calls / min</p>
                <p className="mt-4 text-sm text-white/60">errors {metric.errorCount} · retries {metric.retryCount}</p>
                {metric.throttledSymbols.length > 0 && (
                  <p className="mt-2 text-xs text-amber-100/80">throttled {metric.throttledSymbols.slice(0, 4).join(', ')}</p>
                )}
                {metric.lastError && (
                  <p className="mt-2 text-xs text-rose-200/85">{metric.lastError}</p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-lg font-semibold">Live Request Stream</h3>
                <p className="text-sm text-white/45 mt-1">Recent request, response, error, and control traffic emitted by the provider bus.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={callerFilter.provider}
                  onChange={(event) => setCallerFilter((current) => ({ ...current, provider: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <option value="all">All providers</option>
                  {Array.from(new Set((callerState.data?.events ?? []).map((event) => event.provider).filter(Boolean))).map((provider) => (
                    <option key={provider} value={provider}>{provider}</option>
                  ))}
                </select>
                <select
                  value={callerFilter.kind}
                  onChange={(event) => setCallerFilter((current) => ({ ...current, kind: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <option value="all">All event kinds</option>
                  <option value="request">Request</option>
                  <option value="response">Response</option>
                  <option value="error">Error</option>
                  <option value="control">Control</option>
                  <option value="verification">Verification</option>
                </select>
                <input
                  value={callerFilter.search}
                  onChange={(event) => setCallerFilter((current) => ({ ...current, search: event.target.value }))}
                  placeholder="Search symbol or message"
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="max-h-[620px] overflow-auto divide-y divide-white/5">
                {filteredCallerEvents.length === 0 && (
                  <div className="px-5 py-8 text-sm text-white/45">No events match the current filters.</div>
                )}
                {filteredCallerEvents.map((event) => (
                  <div key={event.id} className="px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{event.kind}</span>
                        <span className="font-medium">{event.provider || 'system'}</span>
                        {event.symbol && <span className="text-sm text-cyan-200">{event.symbol}</span>}
                        {event.timeframe && <span className="text-sm text-white/45">{event.timeframe}</span>}
                      </div>
                      <span className="text-xs text-white/35">{formatDate(event.timestamp)}</span>
                    </div>
                    <p className="mt-2 text-sm text-white/80">{event.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )
    }

    if (activeSection === 'processor') {
      const state = processorState
      const data = state.data
      if (!data) {
        return <StateMessage state={state} empty="Processor data is not available yet." />
      }
      if (!data.jobs || !data.logs) {
        return (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-100">
            DI-UI processor models are not ready yet. Missing: {data.runtimeHealth.runtime.missingDiUiPrismaModels.join(', ') || 'none'}
          </div>
        )
      }

      return (
        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6 animate-[di-ui-enter_260ms_ease-out]">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Ingestion Jobs</h3>
            </div>
            <div className="max-h-[720px] overflow-auto divide-y divide-white/5">
              {data.jobs.length === 0 && (
                <div className="px-5 py-6 text-sm text-white/45">No ingestion jobs have been recorded yet.</div>
              )}
              {data.jobs.map((job) => (
                <div key={job.id} className="px-5 py-4">
                  {(() => {
                    const summary = parseJsonSummary<{ persistedBars?: number; healthScore?: number; targetCoveragePercent?: number }>(job.resultSummary)
                    return (
                      <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{job.symbol}</span>
                      <span className="text-sm text-white/45">{job.requestedTimeframe} → {job.storageTimeframe}</span>
                    </div>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{job.status}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/70">{job.laneKind}</span>
                    <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/70">{job.provider}</span>
                    <span className={`rounded-full border px-2 py-1 ${getProvenanceTone(job.provenanceStatus)}`}>{job.provenanceStatus || 'pending provenance'}</span>
                    <span className={`rounded-full border px-2 py-1 ${getVerificationTone(job.verificationStatus)}`}>{job.verificationStatus || 'unverified'}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/45">
                    {job.vaultName || 'pending vault'} · updated {formatDate(job.updatedAt)}
                    {summary?.persistedBars != null ? ` · persisted ${summary.persistedBars.toLocaleString()} bars` : ''}
                  </p>
                  {summary?.healthScore != null && (
                    <p className="mt-2 text-xs text-white/45">
                      health {summary.healthScore.toFixed(1)}%{summary.targetCoveragePercent != null ? ` · coverage ${summary.targetCoveragePercent.toFixed(1)}%` : ''}
                    </p>
                  )}
                  {job.lastError && <p className="mt-2 text-xs text-rose-200/90">{job.lastError}</p>}
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Processor Timeline</h3>
            </div>
            <div className="max-h-[720px] overflow-auto divide-y divide-white/5">
              {data.logs.length === 0 && (
                <div className="px-5 py-6 text-sm text-white/45">No processor events have been recorded yet.</div>
              )}
              {data.logs.map((log) => (
                <div key={log.id} className="px-5 py-4">
                  {(() => {
                    const metadata = parseJsonSummary<Record<string, unknown>>(log.metadata)
                    return (
                      <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{log.stage}</span>
                      {log.symbol && <span className="font-medium">{log.symbol}</span>}
                      {log.requestedTimeframe && <span className="text-sm text-white/45">{log.requestedTimeframe}</span>}
                    </div>
                    <span className="text-xs text-white/35">{formatDate(log.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm text-white/80">{log.message}</p>
                  {log.provider && (
                    <p className="mt-2 text-xs text-white/45">
                      provider {log.provider}{log.storageTimeframe ? ` · stored as ${log.storageTimeframe}` : ''}
                    </p>
                  )}
                  {metadata?.summary && (
                    <p className="mt-2 text-xs text-white/45">
                      {(() => {
                        const summary = metadata.summary as { persistedBars?: number; fetchedBars?: number } | undefined
                        if (!summary) return null
                        return `persisted ${summary.persistedBars ?? 0} bars${summary.fetchedBars != null ? ` · fetched ${summary.fetchedBars}` : ''}`
                      })()}
                    </p>
                  )}
                      </>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }

    if (activeSection === 'verification') {
      const state = verificationState
      const data = state.data
      if (!data) {
        return <StateMessage state={state} empty="Verification data is not available yet." />
      }
      if (!data.jobs || !data.observations) {
        return (
          <div className="rounded-3xl border border-amber-500/30 bg-amber-500/10 px-5 py-6 text-sm text-amber-100">
            DI-UI verification models are not ready yet. Missing: {data.runtimeHealth.runtime.missingDiUiPrismaModels.join(', ') || 'none'}
          </div>
        )
      }

      return (
        <div className="flex flex-col gap-6 animate-[di-ui-enter_260ms_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Queued</p>
              <p className="mt-3 text-3xl font-semibold">{data.statusSummary.QUEUED || 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Running</p>
              <p className="mt-3 text-3xl font-semibold">{data.statusSummary.RUNNING || 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Completed</p>
              <p className="mt-3 text-3xl font-semibold">{data.statusSummary.COMPLETED || 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Failed</p>
              <p className="mt-3 text-3xl font-semibold">{data.statusSummary.FAILED || 0}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Same-source trust</p>
              <p className="mt-3 text-3xl font-semibold">{(data.classificationSummary.EXACT_MATCH || 0) + (data.classificationSummary.WITHIN_TOLERANCE || 0)}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Disputed</p>
              <p className="mt-3 text-3xl font-semibold">{data.classificationSummary.MATERIAL_DIFFERENCE || 0}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-lg font-semibold">Verification Controls</h3>
                <p className="text-sm text-white/45 mt-1">Run repeat-download or after-hours verification against the canonical stored bars.</p>
              </div>
              <button
                onClick={() => runVerificationAction({ action: 'run-after-hours-verification' })}
                disabled={busyAction === 'run-after-hours-verification'}
                className="rounded-2xl bg-amber-500/15 px-4 py-3 text-sm font-medium text-amber-100 hover:bg-amber-500/25 disabled:opacity-50"
              >
                Trigger after-hours verification cycle
              </button>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4 flex flex-col gap-3">
                <input
                  value={verificationForm.symbol}
                  onChange={(event) => setVerificationForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  placeholder="AAPL"
                />
                <input
                  value={verificationForm.timeframe}
                  onChange={(event) => setVerificationForm((current) => ({ ...current, timeframe: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                  placeholder="1m"
                />
                <select
                  value={verificationForm.mode}
                  onChange={(event) => setVerificationForm((current) => ({ ...current, mode: event.target.value }))}
                  className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
                >
                  <option value="BOTH">Same-source + cross-source</option>
                  <option value="SAME_SOURCE">Same-source only</option>
                  <option value="CROSS_SOURCE">Cross-source only</option>
                </select>
                <button
                  onClick={() => runVerificationAction({
                    action: 'run-repeat-verification',
                    symbol: verificationForm.symbol,
                    timeframe: verificationForm.timeframe,
                    verificationMode: verificationForm.mode,
                  })}
                  disabled={busyAction === 'run-repeat-verification'}
                  className="rounded-xl bg-primary px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
                >
                  Run repeat verification
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-6">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="text-lg font-semibold">Verification Jobs</h3>
                </div>
                <div className="max-h-[680px] overflow-auto divide-y divide-white/5">
                  {data.jobs.length === 0 && (
                    <div className="px-5 py-6 text-sm text-white/45">No verification jobs have been recorded yet.</div>
                  )}
                  {data.jobs.map((job) => (
                    <div key={job.id} className="px-5 py-4">
                      {(() => {
                        const summary = parseJsonSummary<{ verificationStatus?: string; verificationMethod?: string; actualMode?: string; barsCompared?: number }>(job.resultSummary)
                        return (
                          <>
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{job.symbol}</span>
                          <span className="text-sm text-white/45">{job.timeframe}</span>
                        </div>
                        <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{job.status}</span>
                      </div>
                      <p className="mt-2 text-sm text-white/45">
                        {job.mode} · {job.sourceProvider || 'schwab'} vs {job.comparisonProvider || '—'}
                      </p>
                      {summary?.verificationStatus && (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className={`rounded-full border px-2 py-1 ${getVerificationTone(summary.verificationStatus)}`}>{summary.verificationStatus}</span>
                          {summary.verificationMethod && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/60">{summary.verificationMethod}</span>
                          )}
                          {summary.actualMode && (
                            <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-white/60">{summary.actualMode}</span>
                          )}
                        </div>
                      )}
                      {summary?.barsCompared != null && (
                        <p className="mt-2 text-xs text-white/45">bars compared {summary.barsCompared}</p>
                      )}
                      {job.lastError && <p className="mt-2 text-xs text-rose-200/90">{job.lastError}</p>}
                          </>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="text-lg font-semibold">Observation Timeline</h3>
                </div>
                <div className="max-h-[680px] overflow-auto divide-y divide-white/5">
                  {data.observations.length === 0 && (
                    <div className="px-5 py-6 text-sm text-white/45">No verification observations yet.</div>
                  )}
                  {data.observations.map((observation) => (
                    <div key={observation.id} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/45">{observation.classification}</span>
                          <span className="text-sm text-white/45">{formatDate(observation.barTime)}</span>
                        </div>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] ${getVerificationTone(observation.classification === 'MATERIAL_DIFFERENCE' ? 'disputed' : observation.classification === 'PROVIDER_GAP' ? 'stale' : 'same-source-verified')}`}>{observation.decision}</span>
                      </div>
                      <p className="mt-2 text-sm text-white/80">
                        {observation.primaryProvider || 'primary'} {observation.primaryClose ?? '—'} vs {observation.secondaryProvider || 'secondary'} {observation.secondaryClose ?? '—'}
                      </p>
                      <p className="mt-2 text-xs text-white/45">
                        diff {observation.priceDiffBps != null ? formatPercent(observation.priceDiffBps / 100) : '—'} · volume Δ {observation.volumeDiffPct != null ? `${observation.volumeDiffPct.toFixed(2)}%` : '—'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    const state = storageState
    const data = state.data
    if (!data) {
      return <StateMessage state={state} empty="Storage data is not available yet." />
    }

    return (
      <div className="flex flex-col gap-6 animate-[di-ui-enter_260ms_ease-out]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Vault Browser</h3>
              <p className="text-sm text-white/45 mt-1">Inspect raw cached bars, inventory metadata, provenance, and verification state.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select value={storageFilters.vault} onChange={(event) => setStorageFilters((current) => ({ ...current, vault: event.target.value, page: 1 }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm">
                <option value="auto">Auto-select vault</option>
                {data.vaults.map((vault) => (
                  <option key={vault.id} value={vault.name}>{vault.name}</option>
                ))}
              </select>
              <input value={storageFilters.symbol} onChange={(event) => setStorageFilters((current) => ({ ...current, symbol: event.target.value.toUpperCase(), page: 1 }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="AAPL" />
              <input value={storageFilters.timeframe} onChange={(event) => setStorageFilters((current) => ({ ...current, timeframe: event.target.value, page: 1 }))} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm" placeholder="1m" />
              <select
                value={storageFilters.verificationStatus}
                onChange={(event) => setStorageFilters((current) => ({ ...current, verificationStatus: event.target.value, page: 1 }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <option value="all">All verification states</option>
                <option value="single-source-unverified">Single-source unverified</option>
                <option value="same-source-verified">Same-source verified</option>
                <option value="cross-source-verified">Cross-source verified</option>
                <option value="disputed">Disputed</option>
                <option value="stale">Stale</option>
              </select>
              <select
                value={String(storageFilters.pageSize)}
                onChange={(event) => setStorageFilters((current) => ({ ...current, pageSize: Number(event.target.value), page: 1 }))}
                className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm"
              >
                <option value="25">25 rows</option>
                <option value="50">50 rows</option>
                <option value="100">100 rows</option>
                <option value="200">200 rows</option>
              </select>
              <button onClick={() => void loadStorage(true)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                Refresh
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-6">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <h3 className="text-lg font-semibold">Inventory Metadata</h3>
            </div>
            <div className="max-h-[680px] overflow-auto divide-y divide-white/5">
              {data.inventories.length === 0 && (
                <div className="px-5 py-6 text-sm text-white/45">No inventory rows matched the current filters.</div>
              )}
              {data.inventories.map((row) => (
                <div key={row.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{row.symbol}</span>
                      <span className="text-sm text-white/45">{row.timeframe}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.2em]">
                      <span className={`rounded-full border px-2 py-0.5 ${getVerificationTone(row.verificationStatus)}`}>{row.verificationStatus}</span>
                      <span className={`rounded-full border px-2 py-0.5 ${getProvenanceTone(row.storageClass)}`}>{row.storageClass}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/45">
                    {row.vault?.name || 'unknown vault'} · {row.barCount.toLocaleString()} bars · {row.gapCount} gaps · health {row.healthScore.toFixed(1)}%
                  </p>
                  <p className="mt-2 text-xs text-white/45">
                    {row.storageClass} · canonical {row.canonicalInterval || row.timeframe} · method {row.verificationMethod || 'none'}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">Raw Bars</h3>
              <div className="text-right">
                <div className="text-xs text-white/45">{data.bars.totalCount.toLocaleString()} total rows</div>
                <div className="mt-1 text-[11px] text-white/45">
                  vault {data.filters.vaultName}
                </div>
                {data.inventories[0] && (
                  <div className="mt-1 text-[11px] text-white/45">
                    {data.inventories[0].storageClass} · {data.inventories[0].verificationStatus}
                  </div>
                )}
              </div>
            </div>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-black/20 text-white/45 uppercase tracking-[0.18em] text-[10px]">
                  <tr>
                    <th className="px-4 py-3 text-left">Time</th>
                    <th className="px-4 py-3 text-right">Open</th>
                    <th className="px-4 py-3 text-right">High</th>
                    <th className="px-4 py-3 text-right">Low</th>
                    <th className="px-4 py-3 text-right">Close</th>
                    <th className="px-4 py-3 text-right">Volume</th>
                    <th className="px-4 py-3 text-left">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.bars.bars.map((bar) => (
                    <tr key={bar.id}>
                      <td className="px-4 py-3 text-white/80">{formatDate(new Date(bar.time * 1000).toISOString())}</td>
                      <td className="px-4 py-3 text-right text-white/70">{bar.open.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{bar.high.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{bar.low.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white">{bar.close.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right text-white/70">{Math.round(bar.volume).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                          {bar.source || 'unknown'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-4 border-t border-white/10 flex items-center justify-between gap-3">
              <button
                onClick={() => setStorageFilters((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Previous
              </button>
              <div className="text-sm text-white/45">Page {storageFilters.page}</div>
              <button
                onClick={() => setStorageFilters((current) => ({ ...current, page: current.page + 1 }))}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-[28px] border border-white/10 bg-[#0f1218] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.3em] text-white/35">Data Ingestion Interface</p>
            <h2 className="text-3xl font-semibold tracking-tight mt-2">DI-UI</h2>
            <p className="text-sm text-white/45 mt-2 max-w-3xl">
              Live scheduler control, provider traffic, processing flow, verification, and raw storage browsing for Mahita’s market-data runtime.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                void loadScheduler(true)
                if (activeSection === 'caller') void loadCaller(true)
                if (activeSection === 'processor') void loadProcessor(true)
                if (activeSection === 'verification') void loadVerification(true)
                if (activeSection === 'storage') void loadStorage(true)
              }}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh section
            </button>
          </div>
        </div>
      </div>

      {globalError && (
        <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {globalError}
        </div>
      )}

      {schedulerState.data && !schedulerState.data.runtimeHealth.runtime.diUiPrismaClientReady && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          DI-UI runtime models are not fully ready. Missing: {schedulerState.data.runtimeHealth.runtime.missingDiUiPrismaModels.join(', ') || 'none'}.
        </div>
      )}

      <div className="rounded-[28px] border border-white/10 bg-[#0f1218] p-3">
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
          {sectionConfig.map((section) => {
            const Icon = section.icon
            const active = section.id === activeSection
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`group relative overflow-hidden rounded-2xl border px-4 py-4 text-left transition-all duration-300 ${active
                  ? 'border-primary/40 bg-primary/12 text-white shadow-[0_0_0_1px_rgba(59,130,246,0.14)]'
                  : 'border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.06] hover:text-white'
                  }`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${section.accent} ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-300`} />
                <div className="relative flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{section.label}</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {sectionBody()}
    </div>
  )
}
