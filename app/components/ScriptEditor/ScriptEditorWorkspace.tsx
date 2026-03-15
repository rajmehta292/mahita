'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    AlertTriangle,
    CheckCircle2,
    Copy,
    Download,
    FileCode2,
    Loader2,
    Play,
    Plus,
    Save,
    Trash2,
} from 'lucide-react'
import { MainLayout } from '@/app/components/Layout/MainLayout'
import { AuthEntryCta } from '@/app/components/Auth/AuthEntryCta'
import { ClientPaneErrorBoundary } from '@/app/components/Error/ClientPaneErrorBoundary'
import { MahitaCodeEditor } from '@/app/components/Backtest/MahitaCodeEditor'
import type { ParityBatchFixtureResult, ParityFixtureManifest, ParityFixtureStatus, StrategyRunSettings } from '@/app/services/trading-engine/types'

interface ScriptDraftDocument {
    id: string
    name: string
    description: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    lastParityStatus: string | null
    linkedFixtureId: string | null
    runSettings?: StrategyRunSettings | null
    createdAt: string
    updatedAt: string
    lastOpenedAt: string | null
}

interface ParityFixtureDocument {
    id: string
    fixtureKey: string
    name: string
    symbol: string
    timeframe: string
    status: ParityFixtureStatus
    manifest?: ParityFixtureManifest | null
    lastParityReport?: ParityBatchFixtureResult | null
}

interface ValidationDiagnostics {
    strategySettings?: {
        name: string
        pyramiding: number
        initialCapital: number
        defaultQtyType: 'cash' | 'fixed' | 'percent_of_equity'
        defaultQtyValue: number
    }
    activeRunSettings?: StrategyRunSettings
}

const FALLBACK_TEMPLATE = `//@version=6
strategy("Mahita Strategy", overlay=true)

fastEma = ta.ema(close, 9)
slowEma = ta.ema(close, 21)
rsiValue = ta.rsi(close, 14)

longEntry = ta.crossover(fastEma, slowEma) and rsiValue < 70
longExit = ta.crossunder(fastEma, slowEma) or rsiValue > 70

if longEntry
    strategy.entry("Long", strategy.long)

if longExit
    strategy.close("Long")

plot(fastEma, "Fast EMA", color=color.green)
plot(slowEma, "Slow EMA", color=color.red)
`

function buildSnapshot(input: {
    id: string | null
    name: string
    description: string
    symbol: string
    timeframe: string
    linkedFixtureId: string
    source: string
}) {
    return JSON.stringify(input)
}

export function ScriptEditorWorkspace() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const searchParams = useSearchParams()
    const requestedScriptId = searchParams.get('script')

    const [drafts, setDrafts] = useState<ScriptDraftDocument[]>([])
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [name, setName] = useState('Untitled Script')
    const [description, setDescription] = useState('')
    const [symbol, setSymbol] = useState('AAPL')
    const [timeframe, setTimeframe] = useState('1d')
    const [source, setSource] = useState(FALLBACK_TEMPLATE)
    const [linkedFixtureId, setLinkedFixtureId] = useState('')
    const [defaultTemplate, setDefaultTemplate] = useState(FALLBACK_TEMPLATE)
    const [fixtures, setFixtures] = useState<ParityFixtureDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [validating, setValidating] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [validateMessage, setValidateMessage] = useState<string | null>(null)
    const [validateStatus, setValidateStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [validationDiagnostics, setValidationDiagnostics] = useState<ValidationDiagnostics | null>(null)
    const [savedSnapshot, setSavedSnapshot] = useState('')

    const currentSnapshot = useMemo(
        () =>
            buildSnapshot({
                id: selectedId,
                name,
                description,
                symbol,
                timeframe,
                linkedFixtureId,
                source,
            }),
        [description, linkedFixtureId, name, selectedId, source, symbol, timeframe]
    )
    const isDirty = currentSnapshot !== savedSnapshot
    const currentDraft = drafts.find((draft) => draft.id === selectedId) ?? null
    const linkedFixture = linkedFixtureId
        ? fixtures.find((fixture) => fixture.id === linkedFixtureId) ?? null
        : null
    const activeRunSettings = linkedFixture?.manifest?.runSettings ?? currentDraft?.runSettings ?? null

    function resetToTemplate(nextTemplate: string = defaultTemplate) {
        setSelectedId(null)
        setName('Untitled Script')
        setDescription('')
        setSymbol('AAPL')
        setTimeframe('1d')
        setLinkedFixtureId('')
        setSource(nextTemplate)
        setValidateMessage(null)
        setValidateStatus('idle')
        setValidationDiagnostics(null)
        const snapshot = buildSnapshot({
            id: null,
            name: 'Untitled Script',
            description: '',
            symbol: 'AAPL',
            timeframe: '1d',
            linkedFixtureId: '',
            source: nextTemplate,
        })
        setSavedSnapshot(snapshot)
        router.replace('/script-editor', { scroll: false })
    }

    function applyDraft(draft: ScriptDraftDocument) {
        setSelectedId(draft.id)
        setName(draft.name)
        setDescription(draft.description ?? '')
        setSymbol(draft.symbol)
        setTimeframe(draft.timeframe)
        setLinkedFixtureId(draft.linkedFixtureId ?? '')
        setSource(draft.source)
        setValidateMessage(null)
        setValidateStatus('idle')
        setValidationDiagnostics(null)
        setSavedSnapshot(
            buildSnapshot({
                id: draft.id,
                name: draft.name,
                description: draft.description ?? '',
                symbol: draft.symbol,
                timeframe: draft.timeframe,
                linkedFixtureId: draft.linkedFixtureId ?? '',
                source: draft.source,
            })
        )
        router.replace(`/script-editor?script=${encodeURIComponent(draft.id)}`, { scroll: false })
    }

    useEffect(() => {
        if (status !== 'authenticated') {
            setLoading(false)
            return
        }

        let cancelled = false

        async function loadDrafts() {
            setLoading(true)
            setError(null)

            try {
                const response = await fetch('/api/script-editor/scripts', { cache: 'no-store' })
                if (!response.ok) {
                    throw new Error('Failed to load saved scripts.')
                }

                const json = await response.json()
                if (cancelled) {
                    return
                }

                const nextDrafts = json.drafts ?? []
                const nextTemplate = json.defaultTemplate ?? FALLBACK_TEMPLATE
                setDrafts(nextDrafts)
                setDefaultTemplate(nextTemplate)

                if (requestedScriptId) {
                    const responseForRequested = await fetch(`/api/script-editor/scripts/${encodeURIComponent(requestedScriptId)}`, {
                        cache: 'no-store',
                    })

                    if (responseForRequested.ok) {
                        const requestedJson = await responseForRequested.json()
                        if (!cancelled && requestedJson.draft) {
                            applyDraft(requestedJson.draft)
                            return
                        }
                    }
                }

                if (nextDrafts.length > 0) {
                    applyDraft(nextDrafts[0])
                } else {
                    resetToTemplate(nextTemplate)
                }
            } catch (loadError) {
                if (!cancelled) {
                    setError(loadError instanceof Error ? loadError.message : 'Failed to load saved scripts.')
                }
            } finally {
                if (!cancelled) {
                    setLoading(false)
                }
            }
        }

        void loadDrafts()

        return () => {
            cancelled = true
        }
    }, [requestedScriptId, router, status])

    useEffect(() => {
        if (status !== 'authenticated') {
            return
        }

        let cancelled = false

        async function loadFixtures() {
            try {
                const response = await fetch('/api/script-editor/fixtures', { cache: 'no-store' })
                if (!response.ok) {
                    return
                }

                const json = await response.json()
                if (!cancelled) {
                    setFixtures(json.fixtures ?? [])
                }
            } catch (fixtureError) {
                console.warn('Failed to load parity fixtures for script editor:', fixtureError)
            }
        }

        void loadFixtures()

        return () => {
            cancelled = true
        }
    }, [status])

    async function saveDraft() {
        setSaving(true)
        setError(null)

        try {
            const response = await fetch('/api/script-editor/scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedId,
                    name,
                    description,
                    symbol,
                    timeframe,
                    engineMode: 'pinets',
                    linkedFixtureId: linkedFixtureId || null,
                    runSettings: activeRunSettings,
                    source,
                }),
            })

            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to save script.')
            }

            const savedDraft = json.draft as ScriptDraftDocument
            setDrafts((current) => {
                const withoutSaved = current.filter((draft) => draft.id !== savedDraft.id)
                return [savedDraft, ...withoutSaved]
            })
            applyDraft(savedDraft)
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : 'Failed to save script.')
        } finally {
            setSaving(false)
        }
    }

    async function validateDraft() {
        setValidating(true)
        setValidateMessage(null)
        setValidateStatus('idle')

        try {
            const response = await fetch('/api/trading/compile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    script: source,
                    runSettings: activeRunSettings,
                }),
            })
            const json = await response.json()

            if (!response.ok || json.success === false) {
                throw new Error(json.error || 'Mahita could not validate this Pine source.')
            }

            setValidateStatus('success')
            setValidateMessage(json.message || 'Mahita accepted this PineTS-backed script.')
            setValidationDiagnostics(json.diagnostics ?? null)
        } catch (validationError) {
            setValidateStatus('error')
            setValidateMessage(validationError instanceof Error ? validationError.message : 'Mahita could not validate this script.')
            setValidationDiagnostics(null)
        } finally {
            setValidating(false)
        }
    }

    async function deleteDraft() {
        if (!selectedId) {
            return
        }

        if (!window.confirm(`Delete "${name}"?`)) {
            return
        }

        setDeleting(true)
        setError(null)

        try {
            const response = await fetch(`/api/script-editor/scripts/${encodeURIComponent(selectedId)}`, {
                method: 'DELETE',
            })
            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to delete script.')
            }

            const remaining = drafts.filter((draft) => draft.id !== selectedId)
            setDrafts(remaining)
            if (remaining.length > 0) {
                applyDraft(remaining[0])
            } else {
                resetToTemplate()
            }
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete script.')
        } finally {
            setDeleting(false)
        }
    }

    async function copySource() {
        await navigator.clipboard.writeText(source)
    }

    function downloadSource() {
        const blob = new Blob([source], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${name.trim().replace(/\s+/g, '_').toLowerCase() || 'mahita_script'}.pine`
        link.click()
        URL.revokeObjectURL(url)
    }

    function openInBacktester() {
        if (!selectedId) {
            setError('Save the script first, then open it in the backtester.')
            return
        }

        router.push(`/backtest?script=${encodeURIComponent(selectedId)}`)
    }

    if (status === 'loading' || loading) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center bg-[#131722] text-gray-300">
                    <div className="flex items-center gap-3">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Loading script editor...</span>
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
            <div className="flex h-full bg-[#131722] text-white">
                <aside className="hidden w-72 shrink-0 border-r border-[#2A2E39] bg-[#171a24] xl:flex xl:flex-col">
                    <div className="flex items-center justify-between border-b border-[#2A2E39] px-4 py-4">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Saved Scripts</p>
                            <h2 className="mt-1 text-lg font-semibold text-white">Workspace</h2>
                        </div>
                        <button
                            onClick={() => resetToTemplate()}
                            className="inline-flex items-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-gray-300 transition hover:bg-[#202433]"
                        >
                            <Plus className="h-4 w-4" />
                            <span>New</span>
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                        <div className="space-y-2">
                            {drafts.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[#343847] bg-[#131722] px-4 py-6 text-sm text-gray-500">
                                    No saved scripts yet. Start with the default Pine template and save it here.
                                </div>
                            ) : (
                                drafts.map((draft) => (
                                    <button
                                        key={draft.id}
                                        onClick={() => applyDraft(draft)}
                                        className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                                            draft.id === selectedId
                                                ? 'border-blue-500/50 bg-blue-500/10'
                                                : 'border-[#2A2E39] bg-[#131722] hover:bg-[#202433]'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <FileCode2 className="h-4 w-4 text-blue-300" />
                                            <span className="font-medium text-white">{draft.name}</span>
                                        </div>
                                        <p className="mt-2 text-xs text-gray-400">
                                            {draft.symbol} • {draft.timeframe} • {new Date(draft.updatedAt).toLocaleString()}
                                        </p>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <div className="border-b border-[#2A2E39] bg-[#171a24] px-6 py-5">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                            <div className="max-w-3xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-gray-500">Script Editor</p>
                                <h1 className="mt-2 text-3xl font-black tracking-tight text-white">Saved Pine Workspace</h1>
                                <p className="mt-3 text-sm text-gray-400">
                                    Mahita now saves Pine source verbatim, validates it against the PineTS-backed runtime,
                                    links drafts to TradingView fixture datasets, and opens the same draft in the backtester.
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    onClick={() => void validateDraft()}
                                    disabled={validating}
                                    className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-sm text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {validating ? 'Validating...' : 'Validate'}
                                </button>
                                <button
                                    onClick={() => void saveDraft()}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-sm text-blue-200 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4" />
                                    <span>{saving ? 'Saving...' : 'Save'}</span>
                                </button>
                                <button
                                    onClick={openInBacktester}
                                    className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200 transition hover:bg-emerald-500/20"
                                >
                                    <Play className="h-4 w-4" />
                                    <span>Open In Backtester</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="flex min-h-0 flex-col border-r border-[#2A2E39]">
                            <div className="grid grid-cols-1 gap-3 border-b border-[#2A2E39] bg-[#1E222D] px-6 py-4 md:grid-cols-2 xl:grid-cols-4">
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Name</span>
                                    <input
                                        value={name}
                                        onChange={(event) => setName(event.target.value)}
                                        className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Symbol</span>
                                    <input
                                        value={symbol}
                                        onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                                        className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Timeframe</span>
                                    <select
                                        value={timeframe}
                                        onChange={(event) => setTimeframe(event.target.value)}
                                        className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    >
                                        {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map((value) => (
                                            <option key={value} value={value}>
                                                {value}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className="flex flex-col gap-2">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Description</span>
                                    <input
                                        value={description}
                                        onChange={(event) => setDescription(event.target.value)}
                                        className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                </label>
                                <label className="flex flex-col gap-2 md:col-span-2 xl:col-span-4">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Parity Fixture</span>
                                    <select
                                        value={linkedFixtureId}
                                        onChange={(event) => setLinkedFixtureId(event.target.value)}
                                        className="rounded-xl border border-[#343847] bg-[#131722] px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    >
                                        <option value="">No fixture linked</option>
                                        {fixtures.map((fixture) => (
                                            <option key={fixture.id} value={fixture.id}>
                                                {fixture.name} ({fixture.symbol} {fixture.timeframe}, {fixture.status})
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            {error && (
                                <div className="border-b border-[#5a2630] bg-[#32161c] px-6 py-3 text-sm text-red-200">
                                    {error}
                                </div>
                            )}

                            <div className="min-h-0 flex-1 bg-[#0d0e12]">
                                <ClientPaneErrorBoundary title="Script editor unavailable">
                                    <MahitaCodeEditor value={source} onChange={setSource} />
                                </ClientPaneErrorBoundary>
                            </div>
                        </div>

                        <aside className="flex min-h-0 flex-col bg-[#171a24]">
                            <div className="border-b border-[#2A2E39] px-5 py-4">
                                <h2 className="text-lg font-semibold text-white">Actions</h2>
                                <p className="mt-1 text-sm text-gray-400">
                                    Save, validate, export, and move this exact Pine source between Mahita and TradingView.
                                </p>
                            </div>

                            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
                                <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-semibold text-white">Draft status</h3>
                                        <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                                            isDirty ? 'bg-amber-500/10 text-amber-200' : 'bg-emerald-500/10 text-emerald-200'
                                        }`}>
                                            {isDirty ? 'Unsaved' : 'Saved'}
                                        </span>
                                    </div>
                                    <p className="mt-3 text-sm text-gray-400">
                                        {selectedId ? 'This draft is stored in your Mahita workspace and can be reopened later.' : 'This is a new draft. Save it to make it reusable.'}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                                        <span className="rounded-full bg-blue-500/10 px-2 py-1 text-blue-200">
                                            {(currentDraft?.engineMode ?? 'pinets').toUpperCase()}
                                        </span>
                                        <span className="rounded-full bg-[#202433] px-2 py-1 text-gray-300">
                                            {linkedFixtureId ? 'Fixture linked' : 'No fixture'}
                                        </span>
                                        {currentDraft?.lastParityStatus && (
                                            <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">
                                                {currentDraft.lastParityStatus}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <h3 className="text-sm font-semibold text-white">Validation</h3>
                                    <div className="mt-3 flex items-start gap-3 text-sm">
                                        {validateStatus === 'success' ? (
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                                        ) : validateStatus === 'error' ? (
                                            <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-300" />
                                        ) : (
                                            <FileCode2 className="mt-0.5 h-4 w-4 text-gray-500" />
                                        )}
                                        <p className={validateStatus === 'error' ? 'text-rose-100' : 'text-gray-400'}>
                                            {validateMessage || 'Run Validate to check whether this source compiles in Mahita’s PineTS-backed runtime.'}
                                        </p>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <h3 className="text-sm font-semibold text-white">Run settings</h3>
                                    <div className="mt-3 space-y-3 text-sm text-gray-400">
                                        <div className="rounded-xl border border-[#2A2E39] bg-[#171a24] px-3 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-500">Script header defaults</p>
                                            <p className="mt-2 text-white">
                                                {validationDiagnostics?.strategySettings
                                                    ? `$${validationDiagnostics.strategySettings.defaultQtyValue} ${validationDiagnostics.strategySettings.defaultQtyType} • ${validationDiagnostics.strategySettings.pyramiding} pyramids • $${validationDiagnostics.strategySettings.initialCapital} capital`
                                                    : 'Validate the script to inspect parsed source defaults.'}
                                            </p>
                                        </div>
                                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-3">
                                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-200">Active execution override</p>
                                            <p className="mt-2 text-white">
                                                {activeRunSettings
                                                    ? `$${activeRunSettings.defaultQtyValue} ${activeRunSettings.defaultQtyType} • ${activeRunSettings.pyramiding} pyramids • ${activeRunSettings.source ?? 'override'}`
                                                    : 'No linked fixture or saved run override.'}
                                            </p>
                                            {linkedFixture?.manifest && (
                                                <p className="mt-2 text-xs text-blue-100/70">
                                                    {linkedFixture.name} is tagged {linkedFixture.status}. Its manifest overrides stay authoritative for fixture-backed parity runs even if the script header differs.
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <h3 className="text-sm font-semibold text-white">Fixture linkage</h3>
                                    <p className="mt-3 text-sm text-gray-400">
                                        {linkedFixtureId
                                            ? `This draft will open against ${linkedFixture?.name ?? 'the selected fixture'} in the backtester.`
                                            : 'Link a TradingView-exported fixture above if you want deterministic parity comparisons in the backtester.'}
                                    </p>
                                    {linkedFixture?.manifest && (
                                        <p className="mt-2 text-xs text-gray-500">
                                            Validation: {linkedFixture.manifest.validation.errors.length === 0 ? 'fixture verified' : linkedFixture.manifest.validation.errors[0]}
                                            {linkedFixture.lastParityReport ? ` • batch ${linkedFixture.lastParityReport.status}` : ''}
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => void copySource()}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-4 py-3 text-sm text-gray-200 transition hover:bg-[#202433]"
                                    >
                                        <Copy className="h-4 w-4" />
                                        <span>Copy</span>
                                    </button>
                                    <button
                                        onClick={downloadSource}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-4 py-3 text-sm text-gray-200 transition hover:bg-[#202433]"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span>Export</span>
                                    </button>
                                    <button
                                        onClick={() => resetToTemplate()}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#343847] bg-[#131722] px-4 py-3 text-sm text-gray-200 transition hover:bg-[#202433]"
                                    >
                                        <Plus className="h-4 w-4" />
                                        <span>New</span>
                                    </button>
                                    <button
                                        onClick={() => void deleteDraft()}
                                        disabled={!selectedId || deleting}
                                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>{deleting ? 'Deleting...' : 'Delete'}</span>
                                    </button>
                                </div>

                                <div className="rounded-2xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <h3 className="text-sm font-semibold text-white">Engine note</h3>
                                    <p className="mt-3 text-sm leading-6 text-gray-400">
                                        PineTS is now the primary execution engine inside Mahita. Exact parity claims are made only for fixture-backed runs where the imported TradingView candles and trade exports line up with the script and strategy properties.
                                    </p>
                                </div>
                            </div>
                        </aside>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
