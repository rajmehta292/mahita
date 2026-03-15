'use client'

import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import {
    ChevronDown,
    Filter,
    Loader2,
    Pin,
    PinOff,
    RotateCcw,
    Save,
    Search,
    Star,
    Table2,
    X,
} from 'lucide-react'
import { MainLayout } from '@/app/components/Layout/MainLayout'
import { AuthEntryCta } from '@/app/components/Auth/AuthEntryCta'
import { useUserPreferences } from '@/app/hooks/use-user-preferences'
import { parseStoredStringArray, serializeStringArray } from '@/lib/preferences-serialization'
import type {
    ScreenerFieldDefinition,
    ScreenerPresetDocument,
    ScreenerQueryRequest,
    ScreenerQueryResponse,
    ScreenerResultColumn,
    ScreenerResultTabDefinition,
} from '@/lib/screener/types'

interface ScreenerConfigPayload {
    groupTabs: Array<{ key: string; label: string }>
    resultTabs: ScreenerResultTabDefinition[]
    fields: ScreenerFieldDefinition[]
    builtInPresets: ScreenerPresetDocument[]
    userPresets: ScreenerPresetDocument[]
    orderOptions: Array<{ value: string; label: string }>
    signals: Array<{ value: string; label: string }>
}

const DEFAULT_QUERY: ScreenerQueryRequest = {
    groupTab: 'descriptive',
    resultTab: 'overview',
    orderKey: 'symbol',
    orderDirection: 'asc',
    signal: 'none',
    tickerQuery: '',
    filters: [],
    page: 1,
    pageSize: 20,
}

function getNestedValue(target: Record<string, unknown>, key: string) {
    return key.split('.').reduce<unknown>((acc, segment) => {
        if (acc == null || typeof acc !== 'object') {
            return null
        }

        return (acc as Record<string, unknown>)[segment]
    }, target)
}

function formatValue(value: unknown, format?: ScreenerResultColumn['format']) {
    if (value == null || value === '') return '—'

    if (format === 'price') {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : '—'
    }

    if (format === 'percent') {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : '—'
    }

    if (format === 'number') {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric.toFixed(2) : '—'
    }

    if (format === 'volume') {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric.toLocaleString() : '—'
    }

    if (format === 'marketCap') {
        const numeric = Number(value)
        if (!Number.isFinite(numeric)) return '—'
        if (numeric >= 1_000_000_000_000) return `${(numeric / 1_000_000_000_000).toFixed(2)}T`
        if (numeric >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(2)}B`
        if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`
        return numeric.toLocaleString()
    }

    return String(value)
}

function buildPresetKey(preset: ScreenerPresetDocument) {
    return preset.id ? `user:${preset.id}` : `builtin:${preset.name}`
}

function buildPresetMap(config: ScreenerConfigPayload | null) {
    if (!config) return new Map<string, ScreenerPresetDocument>()
    const entries: Array<[string, ScreenerPresetDocument]> = [...config.builtInPresets, ...config.userPresets].map((preset) => [
        buildPresetKey(preset),
        preset,
    ])
    return new Map(entries)
}

export function ScreenerWorkspace({ initialPreset = null }: { initialPreset?: string | null }) {
    const { data: session, status } = useSession()
    const router = useRouter()
    const { preferences, updatePreferences } = useUserPreferences()
    const [config, setConfig] = useState<ScreenerConfigPayload | null>(null)
    const [query, setQuery] = useState<ScreenerQueryRequest>(DEFAULT_QUERY)
    const [response, setResponse] = useState<ScreenerQueryResponse | null>(null)
    const [loadingConfig, setLoadingConfig] = useState(true)
    const [loadingResults, setLoadingResults] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [drawerOpen, setDrawerOpen] = useState(true)
    const [drawerPinned, setDrawerPinned] = useState(false)
    const [activeGroupTab, setActiveGroupTab] = useState<string>('descriptive')
    const [fieldSearch, setFieldSearch] = useState('')
    const [selectedPresetKey, setSelectedPresetKey] = useState<string>('builtin:All Stocks')
    const [savingPreset, setSavingPreset] = useState(false)

    const presetMap = useMemo(() => buildPresetMap(config), [config])
    const currentColumns = useMemo(
        () => config?.resultTabs.find((tab) => tab.key === query.resultTab)?.columns ?? [],
        [config, query.resultTab]
    )
    const visibleFields = useMemo(() => {
        const normalized = fieldSearch.trim().toLowerCase()
        return (config?.fields ?? [])
            .filter((field) => activeGroupTab === 'all' || field.group === activeGroupTab)
            .filter((field) => {
                if (!normalized) return true
                return (
                    field.label.toLowerCase().includes(normalized) ||
                    field.key.toLowerCase().includes(normalized)
                )
            })
    }, [activeGroupTab, config, fieldSearch])

    useEffect(() => {
        if (status !== 'authenticated') {
            setLoadingConfig(false)
            return
        }

        let cancelled = false

        async function loadConfig() {
            setLoadingConfig(true)
            setError(null)

            try {
                const result = await fetch('/api/screener/config', { cache: 'no-store' })
                if (!result.ok) {
                    throw new Error('Failed to load screener configuration.')
                }

                const json = await result.json()
                if (cancelled) return

                const nextConfig: ScreenerConfigPayload = {
                    groupTabs: json.groupTabs ?? [],
                    resultTabs: json.resultTabs ?? [],
                    fields: json.fields ?? [],
                    builtInPresets: json.builtInPresets ?? [],
                    userPresets: json.userPresets ?? [],
                    orderOptions: json.orderOptions ?? [],
                    signals: json.signals ?? [],
                }

                setConfig(nextConfig)

                const requestedPreset = initialPreset
                if (requestedPreset) {
                    const builtInMatch = nextConfig.builtInPresets.find((preset) => preset.name === requestedPreset)
                    const userMatch = nextConfig.userPresets.find((preset) => preset.id === requestedPreset)
                    const matched = builtInMatch ?? userMatch
                    if (matched) {
                        const presetKey = buildPresetKey(matched)
                        setSelectedPresetKey(presetKey)
                        setActiveGroupTab(matched.groupTab)
                        setQuery((current) => ({
                            ...current,
                            ...matched,
                            filters: matched.filters ?? [],
                            page: 1,
                            pageSize: current.pageSize,
                        }))
                        return
                    }
                }

                const defaultPreset = nextConfig.builtInPresets[0]
                if (defaultPreset) {
                    setSelectedPresetKey(buildPresetKey(defaultPreset))
                    setActiveGroupTab(defaultPreset.groupTab)
                    setQuery((current) => ({
                        ...current,
                        ...defaultPreset,
                        filters: defaultPreset.filters ?? [],
                        page: 1,
                        pageSize: current.pageSize,
                    }))
                }
            } catch (configError) {
                if (!cancelled) {
                    setError(configError instanceof Error ? configError.message : 'Failed to load screener.')
                }
            } finally {
                if (!cancelled) {
                    setLoadingConfig(false)
                }
            }
        }

        void loadConfig()
        return () => {
            cancelled = true
        }
    }, [initialPreset, status])

    useEffect(() => {
        if (status !== 'authenticated' || !config) {
            return
        }

        const timer = setTimeout(async () => {
            setLoadingResults(true)
            setError(null)

            try {
                const result = await fetch('/api/screener/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(query),
                })

                if (!result.ok) {
                    throw new Error('Failed to load screener results.')
                }

                const json = await result.json()
                setResponse({
                    rows: json.rows ?? [],
                    totalCount: json.totalCount ?? 0,
                    page: json.page ?? 1,
                    pageSize: json.pageSize ?? query.pageSize,
                    freshness: json.freshness ?? { asOf: null, source: 'unknown', universeSize: 0 },
                })
            } catch (queryError) {
                setError(queryError instanceof Error ? queryError.message : 'Failed to load screener results.')
                setResponse(null)
            } finally {
                setLoadingResults(false)
            }
        }, 220)

        return () => clearTimeout(timer)
    }, [config, query, status])

    const activeWatchlist = useMemo(
        () => parseStoredStringArray(preferences?.watchlistSymbols),
        [preferences?.watchlistSymbols]
    )

    async function toggleWatchlist(symbol: string) {
        const nextSymbols = activeWatchlist.includes(symbol)
            ? activeWatchlist.filter((entry) => entry !== symbol)
            : [...activeWatchlist, symbol]

        try {
            await updatePreferences({
                watchlistSymbols: serializeStringArray(nextSymbols),
            })
        } catch (watchlistError) {
            console.warn('Failed to update watchlist from screener:', watchlistError)
        }
    }

    function setFilterValue(fieldKey: string, value: string) {
        setQuery((current) => {
            const remaining = current.filters.filter((filter) => filter.field !== fieldKey)
            const nextFilters = value === 'any'
                ? remaining
                : [...remaining, { field: fieldKey, value }]

            return {
                ...current,
                filters: nextFilters,
                page: 1,
            }
        })
    }

    function applyPreset(preset: ScreenerPresetDocument, presetKey: string) {
        setSelectedPresetKey(presetKey)
        setActiveGroupTab(preset.groupTab)
        setQuery((current) => ({
            ...current,
            groupTab: preset.groupTab,
            resultTab: preset.resultTab,
            orderKey: preset.orderKey,
            orderDirection: preset.orderDirection,
            signal: preset.signal,
            filters: preset.filters ?? [],
            page: 1,
        }))
    }

    async function savePreset(mode: 'save-as' | 'update') {
        const basePreset = presetMap.get(selectedPresetKey)
        const existingName = mode === 'update' && basePreset?.id ? basePreset.name : ''
        const name = window.prompt(
            mode === 'update' ? 'Update preset name' : 'Save current screen as preset',
            existingName || 'My Screener Preset'
        )

        if (!name?.trim()) return

        const payload: ScreenerPresetDocument = {
            id: mode === 'update' && basePreset?.id ? basePreset.id : undefined,
            name: name.trim(),
            groupTab: query.groupTab,
            resultTab: query.resultTab,
            orderKey: query.orderKey,
            orderDirection: query.orderDirection,
            signal: query.signal,
            filters: query.filters,
        }

        setSavingPreset(true)
        try {
            const result = await fetch('/api/screener/presets', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            })

            if (!result.ok) {
                throw new Error('Failed to save preset.')
            }

            const json = await result.json()
            const savedPreset = json.preset as ScreenerPresetDocument
            setConfig((current) => {
                if (!current) return current
                const withoutExisting = current.userPresets.filter((preset) => preset.id !== savedPreset.id)
                return {
                    ...current,
                    userPresets: [{ ...savedPreset }, ...withoutExisting],
                }
            })
            setSelectedPresetKey(`user:${savedPreset.id}`)
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save preset.')
        } finally {
            setSavingPreset(false)
        }
    }

    async function deletePreset() {
        const preset = presetMap.get(selectedPresetKey)
        if (!preset?.id) return
        if (!window.confirm(`Delete preset "${preset.name}"?`)) return

        try {
            const result = await fetch(`/api/screener/presets/${preset.id}`, { method: 'DELETE' })
            if (!result.ok) {
                throw new Error('Failed to delete preset.')
            }

            setConfig((current) => {
                if (!current) return current
                return {
                    ...current,
                    userPresets: current.userPresets.filter((entry) => entry.id !== preset.id),
                }
            })

            const fallback = config?.builtInPresets[0]
            if (fallback) {
                applyPreset(fallback, buildPresetKey(fallback))
            }
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete preset.')
        }
    }

    async function saveCurrentPageToWatchlist() {
        if (!response?.rows.length) return

        const nextSymbols = Array.from(new Set([...activeWatchlist, ...response.rows.map((row) => row.symbol)]))

        try {
            await updatePreferences({
                watchlistSymbols: serializeStringArray(nextSymbols),
            })
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save the current screen to your watchlist.')
        }
    }

    function createAlertPlaceholder() {
        window.alert('Alert creation from screener views is queued for the next alerting tranche. The current screen is ready for export and watchlist save now.')
    }

    function exportRows() {
        if (!response?.rows.length) return

        const rows = response.rows.map((row) =>
            currentColumns.reduce<Record<string, string>>((accumulator, column) => {
                const value = getNestedValue(row as unknown as Record<string, unknown>, column.key)
                accumulator[column.label] = formatValue(value, column.format)
                return accumulator
            }, {})
        )

        const headers = currentColumns.map((column) => column.label)
        const csv = [
            headers.join(','),
            ...rows.map((row) => headers.map((header) => JSON.stringify(row[header] ?? '')).join(',')),
        ].join('\n')

        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `mahita_screener_${query.resultTab}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }

    function handleRowNavigation(
        event: MouseEvent<HTMLTableRowElement> | KeyboardEvent<HTMLTableRowElement>,
        symbol: string
    ) {
        const target = event.target as HTMLElement | null
        if (target?.closest('a,button,input,select,textarea,label')) {
            return
        }

        router.push(`/chart?symbol=${encodeURIComponent(symbol)}&timeframe=1d`)
    }

    const totalPages = response ? Math.max(1, Math.ceil(response.totalCount / response.pageSize)) : 1

    if (status === 'loading' || loadingConfig) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center bg-[#131722]">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading screener workspace...</span>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center bg-[#131722]">
                    <AuthEntryCta className="bg-blue-500 text-white hover:bg-blue-600" />
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <div className="relative flex h-full flex-col overflow-hidden bg-[#131722]">
                <div className="border-b border-[#2A2E39] bg-[#1E222D] px-4 py-3">
                    <div className="relative flex flex-wrap items-center gap-3">
                        <div className="min-w-[180px] flex-1 md:flex-none">
                            <select
                                value={selectedPresetKey}
                                onChange={(event) => {
                                    const preset = presetMap.get(event.target.value)
                                    if (preset) {
                                        applyPreset(preset, event.target.value)
                                    }
                                }}
                                className="w-full rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                                <optgroup label="Built-in">
                                    {(config?.builtInPresets ?? []).map((preset) => (
                                        <option key={buildPresetKey(preset)} value={buildPresetKey(preset)}>
                                            {preset.name}
                                        </option>
                                    ))}
                                </optgroup>
                                <optgroup label="My Presets">
                                    {(config?.userPresets ?? []).map((preset) => (
                                        <option key={buildPresetKey(preset)} value={buildPresetKey(preset)}>
                                            {preset.name}
                                        </option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        <div className="min-w-[180px] flex-1 md:flex-none">
                            <select
                                value={query.orderKey}
                                onChange={(event) => setQuery((current) => ({ ...current, orderKey: event.target.value, page: 1 }))}
                                className="w-full rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                                {(config?.orderOptions ?? []).map((option) => (
                                    <option key={option.value} value={option.value}>
                                        Order by {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="w-[110px]">
                            <select
                                value={query.orderDirection}
                                onChange={(event) =>
                                    setQuery((current) => ({
                                        ...current,
                                        orderDirection: event.target.value === 'desc' ? 'desc' : 'asc',
                                        page: 1,
                                    }))
                                }
                                className="w-full rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                                <option value="asc">Asc</option>
                                <option value="desc">Desc</option>
                            </select>
                        </div>

                        <div className="min-w-[200px] flex-1 md:flex-none">
                            <select
                                value={query.signal}
                                onChange={(event) => setQuery((current) => ({ ...current, signal: event.target.value, page: 1 }))}
                                className="w-full rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                            >
                                {(config?.signals ?? []).map((signal) => (
                                    <option key={signal.value} value={signal.value}>
                                        Signal {signal.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="relative min-w-[220px] flex-1">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                            <input
                                value={query.tickerQuery || ''}
                                onChange={(event) => setQuery((current) => ({ ...current, tickerQuery: event.target.value, page: 1 }))}
                                placeholder="Tickers"
                                className="w-full rounded-xl border border-[#343847] bg-[#131722] py-2 pl-9 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                            />
                        </div>

                        <div className="ml-auto flex items-center gap-2">
                            <button
                                onClick={() => setDrawerOpen((current) => !current)}
                                className="inline-flex items-center gap-2 rounded-xl border border-[#343847] bg-[#2A2E39] px-3 py-2 text-sm text-white transition hover:bg-[#343847]"
                            >
                                <Filter className="h-4 w-4" />
                                <span>Filters</span>
                                <ChevronDown className={`h-4 w-4 transition-transform ${drawerOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <button
                                onClick={() => void savePreset(selectedPresetKey.startsWith('user:') ? 'update' : 'save-as')}
                                disabled={savingPreset}
                                className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Save className="h-4 w-4" />
                                <span>{selectedPresetKey.startsWith('user:') ? 'Update' : 'Save'}</span>
                            </button>
                            {selectedPresetKey.startsWith('user:') && (
                                <button
                                    onClick={() => void deletePreset()}
                                    className="inline-flex items-center gap-2 rounded-xl border border-[#5a2630] bg-[#32161c] px-3 py-2 text-sm text-red-300 transition hover:bg-[#4a202a]"
                                >
                                    <X className="h-4 w-4" />
                                    <span>Delete</span>
                                </button>
                            )}
                        </div>

                        <div className="w-full text-xs text-gray-400">
                            {response ? (
                                <span>
                                    {response.totalCount.toLocaleString()} matches
                                    {response.freshness.asOf ? ` • Updated ${new Date(response.freshness.asOf).toLocaleString()}` : ''}
                                    {` • Source ${response.freshness.source}`}
                                </span>
                            ) : (
                                <span>Building your market list...</span>
                            )}
                        </div>

                        {(drawerOpen || drawerPinned) && (
                            <div className="absolute left-0 top-full z-20 mt-3 w-full rounded-2xl border border-[#2A2E39] bg-[#1A1D27]/98 p-4 shadow-2xl shadow-black/40 backdrop-blur transition-all duration-200">
                                <div className="mb-4 flex flex-wrap items-center gap-3">
                                    <div className="flex items-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300">
                                        <Search className="h-4 w-4 text-gray-500" />
                                        <input
                                            value={fieldSearch}
                                            onChange={(event) => setFieldSearch(event.target.value)}
                                            placeholder="Search filters..."
                                            className="w-48 bg-transparent text-sm text-white placeholder:text-gray-500 focus:outline-none"
                                        />
                                    </div>

                                    {(config?.groupTabs ?? []).map((tab) => (
                                        <button
                                            key={tab.key}
                                            onClick={() => {
                                                setActiveGroupTab(tab.key)
                                                setQuery((current) => ({ ...current, groupTab: tab.key as ScreenerQueryRequest['groupTab'], page: 1 }))
                                            }}
                                            className={`rounded-xl border px-3 py-2 text-sm transition ${
                                                activeGroupTab === tab.key
                                                    ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                                    : 'border-[#343847] bg-[#131722] text-gray-300 hover:bg-[#202433]'
                                            }`}
                                        >
                                            {tab.label}
                                        </button>
                                    ))}

                                    <div className="ml-auto flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setQuery((current) => ({ ...current, filters: [], signal: 'none', page: 1 }))
                                                setFieldSearch('')
                                            }}
                                            className="inline-flex items-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433]"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                            <span>Reset</span>
                                        </button>
                                        <button
                                            onClick={() => setDrawerPinned((current) => !current)}
                                            className="inline-flex items-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433]"
                                        >
                                            {drawerPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                                            <span>{drawerPinned ? 'Unpin' : 'Pin'}</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="grid max-h-[52vh] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-4">
                                    {visibleFields.map((field) => {
                                        const currentFilter = query.filters.find((filter) => filter.field === field.key)?.value ?? 'any'
                                        const isTextFilter = field.valueType === 'string'

                                        return (
                                            <label key={field.key} className="flex flex-col gap-2 rounded-2xl border border-[#242836] bg-[#131722] p-3">
                                                <span className="text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                                    {field.label}
                                                </span>
                                                {isTextFilter ? (
                                                    <input
                                                        value={currentFilter === 'any' ? '' : currentFilter}
                                                        onChange={(event) => setFilterValue(field.key, event.target.value.trim() || 'any')}
                                                        placeholder={`Filter ${field.label.toLowerCase()}`}
                                                        className="rounded-xl border border-[#343847] bg-[#0f1118] px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-blue-500 focus:outline-none"
                                                    />
                                                ) : (
                                                    <select
                                                        value={currentFilter}
                                                        onChange={(event) => setFilterValue(field.key, event.target.value)}
                                                        className="rounded-xl border border-[#343847] bg-[#0f1118] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                                    >
                                                        {field.options.map((option) => (
                                                            <option key={`${field.key}:${option.value}`} value={option.value}>
                                                                {option.label}
                                                            </option>
                                                        ))}
                                                    </select>
                                                )}
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className={`border-b border-[#2A2E39] bg-[#191C26] px-4 py-2 transition-all ${drawerOpen || drawerPinned ? 'mt-[460px] md:mt-[360px] xl:mt-[280px]' : ''}`}>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {(config?.resultTabs ?? []).map((tab) => (
                            <button
                                key={tab.key}
                                onClick={() => setQuery((current) => ({ ...current, resultTab: tab.key, page: 1 }))}
                                className={`shrink-0 rounded-xl border px-3 py-2 text-sm transition ${
                                    query.resultTab === tab.key
                                        ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                        : 'border-[#343847] bg-[#131722] text-gray-300 hover:bg-[#202433]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-hidden px-4 py-4">
                    <div className="flex h-full flex-col rounded-2xl border border-[#2A2E39] bg-[#1A1D27]">
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#2A2E39] px-4 py-3">
                            <div className="flex items-center gap-2 text-sm text-gray-300">
                                <Table2 className="h-4 w-4" />
                                <span>
                                    {config?.resultTabs.find((tab) => tab.key === query.resultTab)?.label ?? 'Results'} • Page {response?.page ?? 1} of {totalPages}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => void saveCurrentPageToWatchlist()}
                                    disabled={!response?.rows.length}
                                    className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Save page
                                </button>
                                <button
                                    onClick={createAlertPlaceholder}
                                    disabled={!response?.rows.length}
                                    className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-sm text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Create alert
                                </button>
                                <button
                                    onClick={exportRows}
                                    disabled={!response?.rows.length}
                                    className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Export
                                </button>
                                <button
                                    onClick={() => setQuery((current) => ({ ...current, page: Math.max(1, current.page - 1) }))}
                                    disabled={!response || response.page <= 1}
                                    className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => setQuery((current) => ({ ...current, page: Math.min(totalPages, current.page + 1) }))}
                                    disabled={!response || response.page >= totalPages}
                                    className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Next
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="mx-4 mt-4 rounded-2xl border border-[#5a2630] bg-[#32161c] px-4 py-3 text-sm text-red-200">
                                {error}
                            </div>
                        )}

                        <div className="min-h-0 flex-1 overflow-auto">
                            <table className="min-w-full border-separate border-spacing-0">
                                <thead className="sticky top-0 z-10 bg-[#1A1D27]">
                                    <tr>
                                        {currentColumns.map((column) => (
                                            <th
                                                key={column.key}
                                                className={`border-b border-[#2A2E39] px-4 py-3 text-xs font-medium uppercase tracking-[0.16em] text-gray-500 ${
                                                    column.align === 'right' ? 'text-right' : 'text-left'
                                                }`}
                                            >
                                                <button
                                                    onClick={() =>
                                                        setQuery((current) => ({
                                                            ...current,
                                                            orderKey: column.key,
                                                            orderDirection:
                                                                current.orderKey === column.key && current.orderDirection === 'asc'
                                                                    ? 'desc'
                                                                    : 'asc',
                                                            page: 1,
                                                        }))
                                                    }
                                                    className="inline-flex items-center gap-2"
                                                >
                                                    <span>{column.label}</span>
                                                    {query.orderKey === column.key && (
                                                        <span className="text-[10px] text-blue-400">
                                                            {query.orderDirection === 'asc' ? 'ASC' : 'DESC'}
                                                        </span>
                                                    )}
                                                </button>
                                            </th>
                                        ))}
                                        <th className="border-b border-[#2A2E39] px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.16em] text-gray-500">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loadingResults ? (
                                        <tr>
                                            <td colSpan={currentColumns.length + 1} className="px-4 py-12 text-center text-sm text-gray-400">
                                                <div className="inline-flex items-center gap-3">
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>Updating market list...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : !response?.rows.length ? (
                                        <tr>
                                            <td colSpan={currentColumns.length + 1} className="px-4 py-12 text-center text-sm text-gray-400">
                                                No rows matched the current screener filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        response.rows.map((row) => (
                                            <tr
                                                key={row.symbol}
                                                tabIndex={0}
                                                onClick={(event) => handleRowNavigation(event, row.symbol)}
                                                onKeyDown={(event) => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        handleRowNavigation(event, row.symbol)
                                                    }
                                                }}
                                                className="cursor-pointer border-b border-[#242836] odd:bg-[#171a23] even:bg-[#1b1f2a] transition hover:bg-[#202433] focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                                            >
                                                {currentColumns.map((column) => {
                                                    const rawValue = getNestedValue(row as unknown as Record<string, unknown>, column.key)
                                                    const isNavigationColumn = column.key === 'symbol' || column.key === 'name'
                                                    return (
                                                        <td
                                                            key={`${row.symbol}:${column.key}`}
                                                            className={`px-4 py-3 text-sm ${
                                                                column.align === 'right' ? 'text-right' : 'text-left'
                                                            }`}
                                                        >
                                                            {isNavigationColumn ? (
                                                                <Link
                                                                    href={`/chart?symbol=${encodeURIComponent(row.symbol)}&timeframe=1d`}
                                                                    onClick={(event) => event.stopPropagation()}
                                                                    className="font-medium text-blue-300 transition hover:text-blue-200"
                                                                >
                                                                    {formatValue(rawValue, column.format)}
                                                                </Link>
                                                            ) : (
                                                                <span className="text-gray-200">{formatValue(rawValue, column.format)}</span>
                                                            )}
                                                        </td>
                                                    )
                                                })}
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <Link
                                                            href={`/chart?symbol=${encodeURIComponent(row.symbol)}&timeframe=1d`}
                                                            onClick={(event) => event.stopPropagation()}
                                                            className="rounded-lg border border-[#343847] bg-[#131722] px-2.5 py-1.5 text-xs text-gray-300 transition hover:bg-[#202433]"
                                                        >
                                                            Chart
                                                        </Link>
                                                        <button
                                                            onClick={(event) => {
                                                                event.stopPropagation()
                                                                void toggleWatchlist(row.symbol)
                                                            }}
                                                            className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                                                                activeWatchlist.includes(row.symbol)
                                                                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                                                                    : 'border-[#343847] bg-[#131722] text-gray-300 hover:bg-[#202433]'
                                                            }`}
                                                        >
                                                            <span className="inline-flex items-center gap-1">
                                                                <Star className="h-3.5 w-3.5" />
                                                                {activeWatchlist.includes(row.symbol) ? 'Saved' : 'Watchlist'}
                                                            </span>
                                                        </button>
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
            </div>
        </MainLayout>
    )
}
