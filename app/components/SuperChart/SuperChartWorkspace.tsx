'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
    Activity,
    ArrowLeft,
    BarChart3,
    BellPlus,
    Bot,
    Briefcase,
    Camera,
    CandlestickChart,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Copy,
    Crosshair,
    ExternalLink,
    EyeOff,
    Info,
    LayoutTemplate,
    ListChecks,
    Loader2,
    Lock,
    Magnet,
    Minus,
    MousePointer2,
    PenLine,
    Play,
    RefreshCw,
    Ruler,
    Save,
    Search,
    Settings2,
    ShieldCheck,
    ShoppingCart,
    Star,
    TerminalSquare,
    Trash2,
    Type,
    X,
} from 'lucide-react'
import Chart from '@/app/components/Chart'
import { MahitaCodeEditor } from '@/app/components/Backtest/MahitaCodeEditor'
import { SessionActivityTracker } from '@/app/components/Auth/SessionActivityTracker'
import { useUserPreferences } from '@/app/hooks/use-user-preferences'
import type { MarketDataPoint } from '@/app/services/market-data/types'
import type {
    BacktestResult,
    ParityFixtureManifest,
    ParityFixtureStatus,
    StrategyRunSettings,
} from '@/app/services/trading-engine/types'
import { resolveHydratedAccountId } from '@/lib/account-selection'
import { normalizeUnknownError, readJsonResponse } from '@/lib/app-errors'
import { parseStoredStringArray, serializeStringArray } from '@/lib/preferences-serialization'
import { buildOrderRequestFromDraft, createOrderDraft, type OrderDraft } from '@/lib/trading/order-draft'

type ChartType = 'Standard' | 'HeikinAshi'
type DockTab = 'editor' | 'tester' | 'trades' | 'orders' | 'positions' | 'logs' | 'trading'
type RailTab = 'watchlist' | 'details' | 'trade' | 'automation'
type LeftTool = 'pointer' | 'crosshair' | 'trendline' | 'horizontal' | 'brush' | 'text' | 'measure' | 'magnet' | 'lock' | 'hide' | 'clear'
type ProviderChoice = 'auto' | 'schwab' | 'yahoo'
type ComparisonMode = 'auto' | 'force-engine' | 'force-replay'
type RangePreset = '1D' | '5D' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'All'

interface SymbolLookupResult {
    symbol: string
    name: string
    exchange: string | null
    assetType: string
    source: string
}

interface ScriptDraftDocument {
    id: string
    name: string
    description?: string | null
    symbol: string
    timeframe: string
    source: string
    engineMode: string
    lastParityStatus?: string | null
    linkedFixtureId?: string | null
    runSettings?: StrategyRunSettings | null
}

interface ParityFixtureDocument {
    id: string
    fixtureKey: string
    name: string
    symbol: string
    timeframe: string
    source: 'tradingview-fixture' | 'schwab-snapshot'
    status: ParityFixtureStatus
    manifest?: ParityFixtureManifest | null
}

interface QuoteSnapshot {
    symbol: string
    name: string
    price: number
    change?: number
    changePercent?: number
}

interface BrokerageAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
        type?: string
    }
}

interface BrokerageOrder {
    orderId: string
    status: string
    enteredTime?: string
    orderLegCollection?: Array<{
        instruction?: string
        quantity?: number
        instrument?: {
            symbol?: string
        }
    }>
}

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
    liquidationValue?: number
}

interface StrategyDeploymentDocument {
    id: string
    name: string
    description?: string | null
    symbol: string
    timeframe: string
    target: string
    status: string
    linkedAccountId?: string | null
    marketDataSource: string
    webhookUrl?: string | null
    lastSignalAt?: string | null
    lastRunAt?: string | null
    lastError?: string | null
    runs?: Array<{
        id: string
        status: string
        createdAt: string
        completedAt?: string | null
    }>
    signalEvents?: Array<{
        id: string
        status: string
        eventType?: string | null
        symbol?: string | null
        action?: string | null
        receivedAt: string
    }>
    executionIntents?: Array<{
        id: string
        status: string
        mode: string
        broker: string
        symbol: string
        side: string
        quantity?: number | null
        createdAt: string
    }>
}

interface ValidationDiagnostics {
    normalizedScriptSource?: string
    strategySettings?: {
        name: string
        pyramiding: number
        initialCapital: number
        defaultQtyType: 'cash' | 'fixed' | 'percent_of_equity'
        defaultQtyValue: number
    }
    activeRunSettings?: StrategyRunSettings
}

interface StrategyVersionDocument {
    id: string
    strategyId: string
    versionNumber: number
    label: string | null
    description: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettings?: StrategyRunSettings | null
    sourceHash: string
    createdAt: string
    updatedAt: string
}

interface StrategyWorkspaceSessionDocument {
    id: string
    strategyId: string
    baseVersionId: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettings?: StrategyRunSettings | null
    autosaveRevision: number
    lastOpenedAt: string | null
    updatedAt: string
}

interface StrategyLibraryDocument {
    id: string
    name: string
    description: string | null
    symbol: string
    timeframe: string
    language: string
    engineMode: string
    favorite: boolean
    pinned: boolean
    latestVersionId: string | null
    updatedAt: string
    latestVersion: StrategyVersionDocument | null
    versions: StrategyVersionDocument[]
    workspaceSession: StrategyWorkspaceSessionDocument | null
}

interface IndicatorCatalogItem {
    id: string
    name: string
    shortLabel: string
    kind: 'indicator' | 'strategy' | 'profile' | 'pattern'
    pane: 'overlay' | 'volume' | 'oscillator'
    category: string
    description: string
    defaultParams?: Record<string, number | string | boolean>
}

type IndicatorModalTab = 'indicators' | 'strategies' | 'profiles' | 'patterns'
type ActiveOverlay = { kind: 'editor' } | { kind: 'rightPanel', tab: RailTab }

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '1d'] as const
const ORDER_TYPES = ['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT'] as const
const PROVIDERS: Array<{ value: ProviderChoice, label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'schwab', label: 'Schwab' },
    { value: 'yahoo', label: 'Yahoo' },
]
const COMPARISON_MODES: Array<{ value: ComparisonMode, label: string }> = [
    { value: 'auto', label: 'Auto' },
    { value: 'force-replay', label: 'Fixture Replay' },
    { value: 'force-engine', label: 'Engine Compare' },
]
const RANGE_PRESETS: RangePreset[] = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'All']
const LEFT_RAIL_TOOLS: Array<{ id: LeftTool, label: string, icon: typeof MousePointer2 }> = [
    { id: 'pointer', label: 'Pointer', icon: MousePointer2 },
    { id: 'crosshair', label: 'Crosshair', icon: Crosshair },
    { id: 'trendline', label: 'Trend line', icon: Activity },
    { id: 'horizontal', label: 'Horizontal line', icon: Minus },
    { id: 'brush', label: 'Brush', icon: PenLine },
    { id: 'text', label: 'Text', icon: Type },
    { id: 'measure', label: 'Measure', icon: Ruler },
    { id: 'magnet', label: 'Magnet', icon: Magnet },
    { id: 'lock', label: 'Lock', icon: Lock },
    { id: 'hide', label: 'Hide drawings', icon: EyeOff },
    { id: 'clear', label: 'Clear drawings', icon: Trash2 },
]

function formatCurrency(value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'N/A'
    }

    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value)
}

function formatPercent(value?: number | null) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return 'N/A'
    }

    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatIndicatorLabel(value: string) {
    switch (value) {
        case 'macd':
            return 'MACD'
        case 'rsi':
            return 'RSI'
        case 'ema':
            return 'EMA'
        case 'sma':
            return 'SMA'
        case 'vwap':
            return 'VWAP'
        case 'atr':
            return 'ATR'
        case 'bollinger':
            return 'Bollinger'
        case 'volume':
            return 'Volume'
        default:
            return value
    }
}

function formatDateTime(value?: string | number | null) {
    if (!value) {
        return 'N/A'
    }

    const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value)
    if (Number.isNaN(date.getTime())) {
        return 'N/A'
    }

    return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

function toUnixTimestamp(value?: string | number | null) {
    if (typeof value === 'number') {
        return value
    }

    if (!value) {
        return null
    }

    const timestamp = Math.floor(new Date(value).getTime() / 1000)
    return Number.isFinite(timestamp) ? timestamp : null
}

function formatCompactId(value?: string | null) {
    if (!value) {
        return 'Not selected'
    }

    if (value.length <= 12) {
        return value
    }

    return `${value.slice(0, 6)}...${value.slice(-4)}`
}

function getDefaultLookbackSeconds(timeframe: string) {
    switch (timeframe) {
        case '1m':
            return 14 * 24 * 60 * 60
        case '5m':
            return 45 * 24 * 60 * 60
        case '15m':
            return 90 * 24 * 60 * 60
        case '1h':
            return 365 * 24 * 60 * 60
        default:
            return 5 * 365 * 24 * 60 * 60
    }
}

function getRangePresetStartTimestamp(preset: RangePreset, latestTimestamp: number) {
    const latestDate = new Date(latestTimestamp * 1000)

    switch (preset) {
        case '1D':
            return latestTimestamp - 24 * 60 * 60
        case '5D':
            return latestTimestamp - 5 * 24 * 60 * 60
        case '1M':
            return latestTimestamp - 30 * 24 * 60 * 60
        case '3M':
            return latestTimestamp - 90 * 24 * 60 * 60
        case '6M':
            return latestTimestamp - 180 * 24 * 60 * 60
        case 'YTD':
            return Math.floor(new Date(latestDate.getFullYear(), 0, 1).getTime() / 1000)
        case '1Y':
            return latestTimestamp - 365 * 24 * 60 * 60
        case 'All':
        default:
            return null
    }
}

function getEditorOverlayWidthBounds(viewportWidth: number) {
    const reservedWidth = 56 + 8 + 8 + 24
    const maxWidth = Math.max(420, Math.min(1120, viewportWidth - reservedWidth))
    const minWidth = Math.min(520, maxWidth)
    return { minWidth, maxWidth }
}

function clampEditorOverlayWidth(width: number, viewportWidth: number) {
    const { minWidth, maxWidth } = getEditorOverlayWidthBounds(viewportWidth)
    return Math.min(maxWidth, Math.max(minWidth, width))
}

const RIGHT_UTILITY_STRIP_WIDTH = 56
const OVERLAY_EDGE_GAP = 8
const OVERLAY_STRIP_GAP = 8
const OVERLAY_RIGHT_OFFSET = RIGHT_UTILITY_STRIP_WIDTH + OVERLAY_STRIP_GAP + OVERLAY_EDGE_GAP

function getRightOverlayDefaultWidth(tab: RailTab) {
    return tab === 'watchlist' || tab === 'details' ? 420 : 460
}

function getRightOverlayWidthBounds(viewportWidth: number) {
    const reservedWidth = OVERLAY_RIGHT_OFFSET + 24
    const maxWidth = Math.max(360, Math.min(680, viewportWidth - reservedWidth))
    const minWidth = Math.min(360, maxWidth)
    return { minWidth, maxWidth }
}

function clampRightOverlayWidth(width: number, viewportWidth: number) {
    const { minWidth, maxWidth } = getRightOverlayWidthBounds(viewportWidth)
    return Math.min(maxWidth, Math.max(minWidth, width))
}

export function SuperChartWorkspace() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const { preferences, updatePreferences } = useUserPreferences()
    const workspaceScrollRef = useRef<HTMLDivElement>(null)
    const workspaceViewportRef = useRef<HTMLDivElement>(null)
    const topBarRef = useRef<HTMLDivElement>(null)
    const lastAutosavedSnapshotRef = useRef('')
    const workspaceHydratedRef = useRef(false)

    const routeSymbol = (searchParams.get('symbol') || 'AAPL').trim().toUpperCase()
    const routeTimeframe = (searchParams.get('timeframe') || '1d').trim()
    const routeDraftId = searchParams.get('draft') || ''

    const [symbolInput, setSymbolInput] = useState(routeSymbol)
    const deferredSymbolInput = useDeferredValue(symbolInput)
    const [symbolResults, setSymbolResults] = useState<SymbolLookupResult[]>([])
    const [showSymbolResults, setShowSymbolResults] = useState(false)
    const [symbolLookupLoading, setSymbolLookupLoading] = useState(false)

    const [provider, setProvider] = useState<ProviderChoice>('auto')
    const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('auto')
    const [chartType, setChartType] = useState<ChartType>('Standard')
    const [indicators, setIndicators] = useState<string[]>(['volume'])
    const [dockTab, setDockTab] = useState<DockTab>('tester')
    const [dockExpanded, setDockExpanded] = useState(false)
    const [activeOverlay, setActiveOverlay] = useState<ActiveOverlay | null>(null)
    const [editorOverlayWidth, setEditorOverlayWidth] = useState(760)
    const [rightOverlayWidths, setRightOverlayWidths] = useState<Record<RailTab, number>>({
        watchlist: getRightOverlayDefaultWidth('watchlist'),
        details: getRightOverlayDefaultWidth('details'),
        trade: getRightOverlayDefaultWidth('trade'),
        automation: getRightOverlayDefaultWidth('automation'),
    })
    const [overlayResizing, setOverlayResizing] = useState<'editor' | RailTab | null>(null)
    const [leftTool, setLeftTool] = useState<LeftTool>('crosshair')
    const [rangePreset, setRangePreset] = useState<RangePreset>('All')
    const [indicatorModalOpen, setIndicatorModalOpen] = useState(false)
    const [indicatorModalTab, setIndicatorModalTab] = useState<IndicatorModalTab>('indicators')
    const [indicatorQuery, setIndicatorQuery] = useState('')
    const [topBarHeight, setTopBarHeight] = useState(72)

    const [chartData, setChartData] = useState<MarketDataPoint[]>([])
    const [marketDataLoading, setMarketDataLoading] = useState(false)
    const [marketDataError, setMarketDataError] = useState<string | null>(null)

    const [drafts, setDrafts] = useState<ScriptDraftDocument[]>([])
    const [defaultTemplate, setDefaultTemplate] = useState('')
    const [selectedDraftId, setSelectedDraftId] = useState('')
    const [draftName, setDraftName] = useState('')
    const [draftDescription, setDraftDescription] = useState('')
    const [scriptSource, setScriptSource] = useState('')
    const [linkedFixtureId, setLinkedFixtureId] = useState('')
    const [draftRunSettings, setDraftRunSettings] = useState<StrategyRunSettings | null>(null)
    const [draftSaving, setDraftSaving] = useState(false)
    const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
    const [validationLoading, setValidationLoading] = useState(false)
    const [validationDiagnostics, setValidationDiagnostics] = useState<ValidationDiagnostics | null>(null)
    const [validationError, setValidationError] = useState<string | null>(null)
    const [strategyLibrary, setStrategyLibrary] = useState<StrategyLibraryDocument[]>([])
    const [currentStrategyDetail, setCurrentStrategyDetail] = useState<StrategyLibraryDocument | null>(null)
    const [selectedVersionId, setSelectedVersionId] = useState('')
    const [versionMutationLoading, setVersionMutationLoading] = useState(false)
    const [versionFeedback, setVersionFeedback] = useState<string | null>(null)
    const [indicatorCatalog, setIndicatorCatalog] = useState<IndicatorCatalogItem[]>([])
    const [profileCatalog, setProfileCatalog] = useState<IndicatorCatalogItem[]>([])
    const [patternCatalog, setPatternCatalog] = useState<IndicatorCatalogItem[]>([])

    const [fixtures, setFixtures] = useState<ParityFixtureDocument[]>([])
    const [deployments, setDeployments] = useState<StrategyDeploymentDocument[]>([])

    const [backtestLoading, setBacktestLoading] = useState(false)
    const [backtestError, setBacktestError] = useState<string | null>(null)
    const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null)

    const [watchlistQuotes, setWatchlistQuotes] = useState<QuoteSnapshot[]>([])
    const [accounts, setAccounts] = useState<BrokerageAccount[]>([])
    const [selectedAccountId, setSelectedAccountId] = useState('')
    const [positions, setPositions] = useState<Position[]>([])
    const [orders, setOrders] = useState<BrokerageOrder[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [brokerageLoading, setBrokerageLoading] = useState(false)
    const [brokerageError, setBrokerageError] = useState<string | null>(null)

    const [orderDraft, setOrderDraft] = useState<OrderDraft>(() => createOrderDraft({ symbol: routeSymbol, side: 'BUY' }))
    const [orderSubmitting, setOrderSubmitting] = useState(false)
    const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error', message: string } | null>(null)

    const [deploymentName, setDeploymentName] = useState('')
    const [deploymentTarget, setDeploymentTarget] = useState<'paper' | 'schwab-live'>('paper')
    const [deploymentQuantity, setDeploymentQuantity] = useState('1')
    const [deploymentAutoSubmit, setDeploymentAutoSubmit] = useState(true)
    const [deploymentSubmitting, setDeploymentSubmitting] = useState(false)
    const [deploymentFeedback, setDeploymentFeedback] = useState<string | null>(null)

    const watchlistSymbols = useMemo(
        () => parseStoredStringArray(preferences?.watchlistSymbols),
        [preferences?.watchlistSymbols]
    )
    const favoriteIndicatorIds = useMemo(
        () => parseStoredStringArray(preferences?.indicatorFavorites),
        [preferences?.indicatorFavorites]
    )
    const watchlistSymbolsKey = preferences?.watchlistSymbols ?? ''
    const compatibleFixtures = fixtures.filter((fixture) => fixture.symbol === routeSymbol && fixture.timeframe === routeTimeframe)
    const linkedFixture = compatibleFixtures.find((fixture) => fixture.id === linkedFixtureId) || null
    const currentDraft = drafts.find((draft) => draft.id === selectedDraftId) || null
    const currentStrategy = strategyLibrary.find((strategy) => strategy.id === selectedDraftId) || currentStrategyDetail
    const currentVersion = currentStrategyDetail?.versions.find((version) => version.id === selectedVersionId)
        || currentStrategyDetail?.latestVersion
        || null
    const currentPosition = positions.find((position) => position.symbol === routeSymbol) || null
    const activeRightTab = activeOverlay?.kind === 'rightPanel' ? activeOverlay.tab : null
    const editorOverlayOpen = activeOverlay?.kind === 'editor'
    const brokerageSurfaceActive = activeRightTab === 'trade'
        || (dockExpanded && (dockTab === 'orders' || dockTab === 'positions' || dockTab === 'trading'))

    useEffect(() => {
        setSymbolInput(routeSymbol)
        setRangePreset('All')
        setOrderDraft((current) => createOrderDraft({
            ...current,
            symbol: routeSymbol,
            side: current.side,
            accountId: selectedAccountId || current.accountId,
        }))
    }, [routeSymbol, selectedAccountId])

    useEffect(() => {
        if (!linkedFixtureId) {
            return
        }

        const fixtureStillAvailable = fixtures.some((fixture) => (
            fixture.id === linkedFixtureId
            && fixture.symbol === routeSymbol
            && fixture.timeframe === routeTimeframe
        ))

        if (!fixtureStillAvailable) {
            setLinkedFixtureId('')
        }
    }, [fixtures, linkedFixtureId, routeSymbol, routeTimeframe])

    useEffect(() => {
        if (!routeDraftId || drafts.length === 0) {
            return
        }

        const draft = drafts.find((entry) => entry.id === routeDraftId)
        if (!draft) {
            return
        }

        setSelectedDraftId(draft.id)
        setDraftName(draft.name)
        setDraftDescription(draft.description || '')
        setScriptSource(draft.source)
        setLinkedFixtureId(draft.linkedFixtureId || '')
        setDraftRunSettings(draft.runSettings || null)
        lastAutosavedSnapshotRef.current = JSON.stringify({
            strategyId: draft.id,
            name: draft.name,
            description: draft.description || '',
            symbol: draft.symbol,
            timeframe: draft.timeframe,
            source: draft.source,
            linkedFixtureId: draft.linkedFixtureId || '',
            runSettings: draft.runSettings || null,
        })
    }, [drafts, routeDraftId])

    useEffect(() => {
        if (!selectedDraftId) {
            setCurrentStrategyDetail(null)
            setSelectedVersionId('')
            return
        }

        let cancelled = false

        async function loadStrategyDetail() {
            try {
                const response = await fetch(`/api/strategies/${encodeURIComponent(selectedDraftId)}`, {
                    cache: 'no-store',
                })
                const json = await response.json()
                if (!response.ok || !json.strategy) {
                    throw new Error(json.error || 'Failed to load strategy details.')
                }

                if (cancelled) {
                    return
                }

                const strategy = json.strategy as StrategyLibraryDocument
                setCurrentStrategyDetail(strategy)
                setSelectedVersionId(strategy.workspaceSession?.baseVersionId || strategy.latestVersionId || '')
            } catch (error) {
                if (!cancelled) {
                    setVersionFeedback(normalizeUnknownError(error, 'Failed to load strategy details.').message)
                }
            }
        }

        void loadStrategyDetail()

        return () => {
            cancelled = true
        }
    }, [selectedDraftId])

    useEffect(() => {
        if (typeof workspaceScrollRef.current?.scrollTo === 'function') {
            workspaceScrollRef.current.scrollTo({ top: 0, behavior: 'auto' })
        }
    }, [routeDraftId, routeSymbol, routeTimeframe])

    useEffect(() => {
        if (!activeOverlay) {
            return
        }

        const overlay = activeOverlay

        function syncOverlayWidth() {
            const viewportRect = workspaceViewportRef.current?.getBoundingClientRect()
            if (!viewportRect) {
                return
            }

            if (overlay.kind === 'editor') {
                setEditorOverlayWidth((current) => clampEditorOverlayWidth(current, viewportRect.width))
                return
            }

            setRightOverlayWidths((current) => ({
                ...current,
                [overlay.tab]: clampRightOverlayWidth(current[overlay.tab], viewportRect.width),
            }))
        }

        syncOverlayWidth()
        window.addEventListener('resize', syncOverlayWidth)

        return () => {
            window.removeEventListener('resize', syncOverlayWidth)
        }
    }, [activeOverlay])

    useEffect(() => {
        if (!activeOverlay) {
            return
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setActiveOverlay(null)
                setOverlayResizing(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
        }
    }, [activeOverlay])

    useEffect(() => {
        if (!overlayResizing) {
            return
        }

        function handleMouseMove(event: MouseEvent) {
            const viewportRect = workspaceViewportRef.current?.getBoundingClientRect()
            if (!viewportRect) {
                return
            }

            const resizingTarget = overlayResizing
            if (!resizingTarget) {
                return
            }
            const nextWidth = viewportRect.right - OVERLAY_RIGHT_OFFSET - event.clientX
            if (resizingTarget === 'editor') {
                setEditorOverlayWidth(clampEditorOverlayWidth(nextWidth, viewportRect.width))
                return
            }

            setRightOverlayWidths((current) => ({
                ...current,
                [resizingTarget]: clampRightOverlayWidth(nextWidth, viewportRect.width),
            }))
        }

        function stopResizing() {
            setOverlayResizing(null)
        }

        const previousCursor = document.body.style.cursor
        const previousUserSelect = document.body.style.userSelect

        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', stopResizing)

        return () => {
            document.body.style.cursor = previousCursor
            document.body.style.userSelect = previousUserSelect
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', stopResizing)
        }
    }, [overlayResizing])

    useEffect(() => {
        const element = topBarRef.current
        if (!element) {
            return
        }

        const syncTopBarHeight = () => {
            setTopBarHeight(element.getBoundingClientRect().height || 72)
        }

        syncTopBarHeight()

        const observer = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => syncTopBarHeight())
            : null

        observer?.observe(element)
        window.addEventListener('resize', syncTopBarHeight)

        return () => {
            observer?.disconnect()
            window.removeEventListener('resize', syncTopBarHeight)
        }
    }, [])

    useEffect(() => {
        if (!workspaceHydratedRef.current) {
            return
        }

        const source = (scriptSource || defaultTemplate).trim()
        if (!source) {
            return
        }

        const snapshot = JSON.stringify({
            strategyId: selectedDraftId || null,
            name: draftName || `${routeSymbol} Strategy`,
            description: draftDescription || '',
            symbol: routeSymbol,
            timeframe: routeTimeframe,
            source,
            linkedFixtureId: linkedFixtureId || '',
            runSettings: draftRunSettings || null,
        })

        if (snapshot === lastAutosavedSnapshotRef.current) {
            return
        }

        const timeoutId = window.setTimeout(() => {
            triggerAutosaveWorkspace()
        }, 1200)

        return () => {
            window.clearTimeout(timeoutId)
        }
    }, [
        defaultTemplate,
        draftDescription,
        draftName,
        draftRunSettings,
        linkedFixtureId,
        routeSymbol,
        routeTimeframe,
        scriptSource,
        selectedDraftId,
    ])

    useEffect(() => {
        let cancelled = false

        async function loadWorkspaceData() {
            try {
                const [draftResponse, fixtureResponse, deploymentResponse, strategyResponse, indicatorResponse] = await Promise.all([
                    fetch('/api/script-editor/scripts', { cache: 'no-store' }),
                    fetch('/api/script-editor/fixtures', { cache: 'no-store' }),
                    fetch('/api/trading/deployments', { cache: 'no-store' }),
                    fetch('/api/strategies', { cache: 'no-store' }),
                    fetch('/api/indicators/catalog', { cache: 'no-store' }),
                ])

                const [draftJson, fixtureJson, deploymentJson, strategyJson, indicatorJson] = await Promise.all([
                    draftResponse.json(),
                    fixtureResponse.json(),
                    deploymentResponse.json(),
                    strategyResponse.json(),
                    indicatorResponse.json(),
                ])

                if (cancelled) {
                    return
                }

                const nextDrafts = (draftJson.drafts ?? []) as ScriptDraftDocument[]
                setDrafts(nextDrafts)
                setDefaultTemplate(draftJson.defaultTemplate ?? '')
                setFixtures((fixtureJson.fixtures ?? []) as ParityFixtureDocument[])
                setDeployments((deploymentJson.deployments ?? []) as StrategyDeploymentDocument[])
                setStrategyLibrary((strategyJson.strategies ?? []) as StrategyLibraryDocument[])
                setIndicatorCatalog((indicatorJson.indicators ?? []) as IndicatorCatalogItem[])
                setProfileCatalog((indicatorJson.profiles ?? []) as IndicatorCatalogItem[])
                setPatternCatalog((indicatorJson.patterns ?? []) as IndicatorCatalogItem[])

                if (routeDraftId) {
                    workspaceHydratedRef.current = true
                    return
                }

                if (!selectedDraftId && nextDrafts.length > 0) {
                    const first = nextDrafts[0]
                    setSelectedDraftId(first.id)
                    setDraftName(first.name)
                    setDraftDescription(first.description || '')
                    setScriptSource(first.source)
                    setLinkedFixtureId(first.linkedFixtureId || '')
                    setDraftRunSettings(first.runSettings || null)
                    lastAutosavedSnapshotRef.current = JSON.stringify({
                        strategyId: first.id,
                        name: first.name,
                        description: first.description || '',
                        symbol: first.symbol,
                        timeframe: first.timeframe,
                        source: first.source,
                        linkedFixtureId: first.linkedFixtureId || '',
                        runSettings: first.runSettings || null,
                    })
                } else if (!selectedDraftId && draftJson.defaultTemplate) {
                    setDraftName(`${routeSymbol} Strategy`)
                    setScriptSource(draftJson.defaultTemplate)
                }
                workspaceHydratedRef.current = true
            } catch (error) {
                if (!cancelled) {
                    setValidationError(normalizeUnknownError(error, 'Failed to load saved scripts and fixtures.').message)
                }
            }
        }

        void loadWorkspaceData()

        return () => {
            cancelled = true
        }
    }, [routeDraftId, routeSymbol, selectedDraftId])

    useEffect(() => {
        let cancelled = false
        const trimmed = deferredSymbolInput.trim()

        if (!showSymbolResults || trimmed.length === 0) {
            setSymbolResults([])
            setSymbolLookupLoading(false)
            return
        }

        setSymbolLookupLoading(true)
        const timeoutId = window.setTimeout(async () => {
            try {
                const response = await fetch(`/api/search/symbols?q=${encodeURIComponent(trimmed)}`, {
                    cache: 'no-store',
                })
                const json = await response.json()
                if (!cancelled) {
                    setSymbolResults((json.results ?? []) as SymbolLookupResult[])
                }
            } catch {
                if (!cancelled) {
                    setSymbolResults([])
                }
            } finally {
                if (!cancelled) {
                    setSymbolLookupLoading(false)
                }
            }
        }, 140)

        return () => {
            cancelled = true
            window.clearTimeout(timeoutId)
        }
    }, [deferredSymbolInput, showSymbolResults])

    useEffect(() => {
        let cancelled = false

        async function loadMarketData() {
            setMarketDataLoading(true)
            setMarketDataError(null)

            try {
                const response = await fetch(`/api/trading/market-data?symbol=${encodeURIComponent(routeSymbol)}&timeframe=${encodeURIComponent(routeTimeframe)}${provider !== 'auto' ? `&provider=${provider}` : ''}`, {
                    cache: 'no-store',
                })
                const json = await readJsonResponse<{ data?: MarketDataPoint[] }>(response, 'Failed to load chart data.')

                if (!cancelled) {
                    setChartData((json.data ?? []) as MarketDataPoint[])
                }
            } catch (error) {
                if (!cancelled) {
                    setChartData([])
                    setMarketDataError(normalizeUnknownError(error, 'Failed to load chart data.').message)
                }
            } finally {
                if (!cancelled) {
                    setMarketDataLoading(false)
                }
            }
        }

        void loadMarketData()

        return () => {
            cancelled = true
        }
    }, [provider, routeSymbol, routeTimeframe])

    useEffect(() => {
        if (watchlistSymbols.length === 0) {
            setWatchlistQuotes((current) => (current.length === 0 ? current : []))
            return
        }

        let cancelled = false

        async function loadWatchlistQuotes() {
            try {
                const response = await fetch(`/api/trading/quotes?symbols=${encodeURIComponent(watchlistSymbols.join(','))}`, {
                    cache: 'no-store',
                })
                const json = await response.json()
                if (!cancelled) {
                    setWatchlistQuotes((json.quotes ?? []) as QuoteSnapshot[])
                }
            } catch {
                if (!cancelled) {
                    setWatchlistQuotes([])
                }
            }
        }

        void loadWatchlistQuotes()
        return () => {
            cancelled = true
        }
    }, [watchlistSymbolsKey, watchlistSymbols])

    useEffect(() => {
        if (!brokerageSurfaceActive) {
            return
        }

        let cancelled = false

        async function loadAccounts() {
            try {
                const response = await fetch('/api/schwab/accounts', { cache: 'no-store' })
                const json = await response.json()
                if (!response.ok) {
                    return
                }
                if (!cancelled) {
                    setAccounts((json.accounts ?? []) as BrokerageAccount[])
                }
            } catch {
                if (!cancelled) {
                    setAccounts([])
                }
            }
        }

        void loadAccounts()
        return () => {
            cancelled = true
        }
    }, [brokerageSurfaceActive])

    useEffect(() => {
        const nextAccountId = resolveHydratedAccountId(accounts, selectedAccountId, preferences?.selectedAccountId || null)
        if (nextAccountId && nextAccountId !== selectedAccountId) {
            setSelectedAccountId(nextAccountId)
        }
    }, [accounts, preferences?.selectedAccountId, selectedAccountId])

    useEffect(() => {
        if (!selectedAccountId) {
            return
        }

        if (preferences?.selectedAccountId === selectedAccountId) {
            return
        }

        updatePreferences({ selectedAccountId }).catch(() => undefined)
    }, [preferences?.selectedAccountId, selectedAccountId, updatePreferences])

    useEffect(() => {
        if (!brokerageSurfaceActive) {
            return
        }

        if (!selectedAccountId) {
            setPositions([])
            setOrders([])
            setBalance(null)
            return
        }

        let cancelled = false

        async function loadBrokerageData() {
            setBrokerageLoading(true)
            setBrokerageError(null)
            try {
                const [positionsResponse, ordersResponse] = await Promise.all([
                    fetch(`/api/schwab/positions?accountId=${encodeURIComponent(selectedAccountId)}`, { cache: 'no-store' }),
                    fetch(`/api/schwab/orders?accountId=${encodeURIComponent(selectedAccountId)}`, { cache: 'no-store' }),
                ])

                const [positionsJson, ordersJson] = await Promise.all([
                    positionsResponse.json(),
                    ordersResponse.json(),
                ])

                if (!positionsResponse.ok || !ordersResponse.ok) {
                    throw new Error(positionsJson.error || ordersJson.error || 'Failed to load brokerage data.')
                }

                if (!cancelled) {
                    setPositions((positionsJson.positions ?? []) as Position[])
                    setBalance((positionsJson.balance ?? null) as AccountBalance | null)
                    setOrders((ordersJson.orders ?? []) as BrokerageOrder[])
                }
            } catch (error) {
                if (!cancelled) {
                    setBrokerageError(normalizeUnknownError(error, 'Failed to load Schwab account data.').message)
                }
            } finally {
                if (!cancelled) {
                    setBrokerageLoading(false)
                }
            }
        }

        void loadBrokerageData()
        return () => {
            cancelled = true
        }
    }, [brokerageSurfaceActive, selectedAccountId])

    async function refreshDeployments() {
        const response = await fetch('/api/trading/deployments', { cache: 'no-store' })
        const json = await response.json()
        setDeployments((json.deployments ?? []) as StrategyDeploymentDocument[])
    }

    async function refreshStrategyLibrary(focusStrategyId?: string) {
        const response = await fetch('/api/strategies', { cache: 'no-store' })
        const json = await response.json()
        const strategies = (json.strategies ?? []) as StrategyLibraryDocument[]
        setStrategyLibrary(strategies)

        const targetId = focusStrategyId || selectedDraftId
        if (targetId) {
            const detailResponse = await fetch(`/api/strategies/${encodeURIComponent(targetId)}`, { cache: 'no-store' })
            const detailJson = await detailResponse.json()
            if (detailResponse.ok && detailJson.strategy) {
                const strategy = detailJson.strategy as StrategyLibraryDocument
                setCurrentStrategyDetail(strategy)
                setSelectedVersionId(strategy.workspaceSession?.baseVersionId || strategy.latestVersionId || '')
            }
        }
    }

    function buildWorkspaceSnapshot() {
        return JSON.stringify({
            strategyId: selectedDraftId || null,
            name: draftName || `${routeSymbol} Strategy`,
            description: draftDescription || '',
            symbol: routeSymbol,
            timeframe: routeTimeframe,
            source: scriptSource || defaultTemplate,
            linkedFixtureId: linkedFixtureId || '',
            runSettings: draftRunSettings || null,
        })
    }

    const triggerAutosaveWorkspace = useEffectEvent(() => {
        void handleAutosaveWorkspace()
    })

    async function handleAutosaveWorkspace() {
        const source = (scriptSource || defaultTemplate).trim()
        const name = (draftName || `${routeSymbol} Strategy`).trim()

        if (!source || !name) {
            return null
        }

        const snapshot = buildWorkspaceSnapshot()
        if (snapshot === lastAutosavedSnapshotRef.current) {
            return currentStrategyDetail
        }

        setAutosaveState('saving')

        try {
            const response = await fetch(
                selectedDraftId
                    ? `/api/strategies/${encodeURIComponent(selectedDraftId)}/workspace`
                    : '/api/strategies',
                {
                    method: selectedDraftId ? 'PATCH' : 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        strategyId: selectedDraftId || null,
                        name,
                        description: draftDescription || null,
                        symbol: routeSymbol,
                        timeframe: routeTimeframe,
                        source,
                        engineMode: 'pinets',
                        linkedFixtureId: linkedFixtureId || null,
                        runSettings: draftRunSettings,
                        createInitialVersion: true,
                    }),
                }
            )
            const json = await response.json()
            if (!response.ok || !json.strategy) {
                throw new Error(json.error || 'Autosave failed.')
            }

            const strategy = json.strategy as StrategyLibraryDocument
            setSelectedDraftId(strategy.id)
            setDraftName(strategy.name)
            setDraftDescription(strategy.description || '')
            setScriptSource(strategy.workspaceSession?.source || strategy.latestVersion?.source || source)
            setLinkedFixtureId(strategy.workspaceSession?.linkedFixtureId || strategy.latestVersion?.linkedFixtureId || '')
            setDraftRunSettings(strategy.workspaceSession?.runSettings || strategy.latestVersion?.runSettings || null)
            setCurrentStrategyDetail(strategy)
            setSelectedVersionId(strategy.workspaceSession?.baseVersionId || strategy.latestVersionId || '')
            setDrafts((current) => {
                const nextDraft: ScriptDraftDocument = {
                    id: strategy.id,
                    name: strategy.name,
                    description: strategy.description || null,
                    symbol: strategy.workspaceSession?.symbol || strategy.symbol,
                    timeframe: strategy.workspaceSession?.timeframe || strategy.timeframe,
                    source: strategy.workspaceSession?.source || strategy.latestVersion?.source || source,
                    engineMode: strategy.workspaceSession?.engineMode || strategy.engineMode,
                    linkedFixtureId: strategy.workspaceSession?.linkedFixtureId || strategy.latestVersion?.linkedFixtureId || null,
                    runSettings: strategy.workspaceSession?.runSettings || strategy.latestVersion?.runSettings || null,
                }

                return [nextDraft, ...current.filter((entry) => entry.id !== nextDraft.id)]
            })
            setStrategyLibrary((current) => {
                const nextEntry = strategy
                return [nextEntry, ...current.filter((entry) => entry.id !== nextEntry.id)]
            })
            lastAutosavedSnapshotRef.current = JSON.stringify({
                strategyId: strategy.id,
                name: strategy.name,
                description: strategy.description || '',
                symbol: strategy.workspaceSession?.symbol || strategy.symbol,
                timeframe: strategy.workspaceSession?.timeframe || strategy.timeframe,
                source: strategy.workspaceSession?.source || strategy.latestVersion?.source || source,
                linkedFixtureId: strategy.workspaceSession?.linkedFixtureId || strategy.latestVersion?.linkedFixtureId || '',
                runSettings: strategy.workspaceSession?.runSettings || strategy.latestVersion?.runSettings || null,
            })
            setAutosaveState('saved')

            if (!routeDraftId || routeDraftId !== strategy.id) {
                updateWorkspaceRoute(routeSymbol, routeTimeframe, strategy.id)
            }
            return strategy
        } catch (error) {
            setAutosaveState('error')
            setVersionFeedback(normalizeUnknownError(error, 'Autosave failed.').message)
            return null
        }
    }

    async function handleSaveVersion() {
        const strategyId = selectedDraftId
        if (!strategyId) {
            await handleAutosaveWorkspace()
        }

        const nextStrategyId = strategyId || selectedDraftId
        if (!nextStrategyId) {
            return
        }

        setVersionMutationLoading(true)
        setVersionFeedback(null)
        try {
            const response = await fetch(`/api/strategies/${encodeURIComponent(nextStrategyId)}/versions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: currentStrategyDetail?.versions.length ? `v${currentStrategyDetail.versions.length + 1}` : 'v1',
                    description: draftDescription || null,
                    source: scriptSource || defaultTemplate,
                    symbol: routeSymbol,
                    timeframe: routeTimeframe,
                    linkedFixtureId: linkedFixtureId || null,
                    runSettings: draftRunSettings,
                    diagnostics: validationDiagnostics,
                    updateWorkspace: true,
                }),
            })
            const json = await response.json()
            if (!response.ok || !json.strategy) {
                throw new Error(json.error || 'Failed to save immutable version.')
            }

            const strategy = json.strategy as StrategyLibraryDocument
            setCurrentStrategyDetail(strategy)
            setSelectedVersionId(strategy.latestVersionId || strategy.workspaceSession?.baseVersionId || '')
            await refreshStrategyLibrary(strategy.id)
            setVersionFeedback(`Saved ${strategy.latestVersion?.label || 'new version'} for ${strategy.name}.`)
        } catch (error) {
            setVersionFeedback(normalizeUnknownError(error, 'Failed to save immutable version.').message)
        } finally {
            setVersionMutationLoading(false)
        }
    }

    async function createVersionForDeployment(strategyId: string) {
        const response = await fetch(`/api/strategies/${encodeURIComponent(strategyId)}/versions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label: `Deploy ${new Date().toLocaleString('en-US', { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                description: draftDescription || null,
                source: scriptSource || defaultTemplate,
                symbol: routeSymbol,
                timeframe: routeTimeframe,
                linkedFixtureId: linkedFixtureId || null,
                runSettings: draftRunSettings,
                diagnostics: validationDiagnostics,
                updateWorkspace: true,
            }),
        })
        const json = await response.json()
        if (!response.ok || !json.strategy) {
            throw new Error(json.error || 'Failed to create deployment version.')
        }
        const strategy = json.strategy as StrategyLibraryDocument
        setCurrentStrategyDetail(strategy)
        setSelectedVersionId(strategy.latestVersionId || strategy.workspaceSession?.baseVersionId || '')
        await refreshStrategyLibrary(strategy.id)
        return strategy
    }

    async function handleRestoreVersion(versionId: string) {
        if (!selectedDraftId) {
            return
        }

        setVersionMutationLoading(true)
        setVersionFeedback(null)
        try {
            const response = await fetch(`/api/strategies/${encodeURIComponent(selectedDraftId)}/versions/${encodeURIComponent(versionId)}/restore`, {
                method: 'POST',
            })
            const json = await response.json()
            if (!response.ok || !json.strategy) {
                throw new Error(json.error || 'Failed to restore version.')
            }
            const strategy = json.strategy as StrategyLibraryDocument
            setCurrentStrategyDetail(strategy)
            setSelectedVersionId(versionId)
            setDraftName(strategy.name)
            setDraftDescription(strategy.description || '')
            setScriptSource(strategy.workspaceSession?.source || '')
            setLinkedFixtureId(strategy.workspaceSession?.linkedFixtureId || '')
            setDraftRunSettings(strategy.workspaceSession?.runSettings || null)
            await refreshStrategyLibrary(strategy.id)
            setVersionFeedback(`Restored ${strategy.versions.find((version) => version.id === versionId)?.label || 'version'} into the workspace.`)
        } catch (error) {
            setVersionFeedback(normalizeUnknownError(error, 'Failed to restore version.').message)
        } finally {
            setVersionMutationLoading(false)
        }
    }

    async function handleDeleteVersion(versionId: string) {
        if (!selectedDraftId) {
            return
        }

        setVersionMutationLoading(true)
        setVersionFeedback(null)
        try {
            const response = await fetch(`/api/strategies/${encodeURIComponent(selectedDraftId)}/versions/${encodeURIComponent(versionId)}`, {
                method: 'DELETE',
            })
            const json = await response.json()
            if (!response.ok || !json.strategy) {
                throw new Error(json.error || 'Failed to delete version.')
            }
            const strategy = json.strategy as StrategyLibraryDocument
            setCurrentStrategyDetail(strategy)
            setSelectedVersionId(strategy.workspaceSession?.baseVersionId || strategy.latestVersionId || '')
            await refreshStrategyLibrary(strategy.id)
            setVersionFeedback('Deleted immutable version.')
        } catch (error) {
            setVersionFeedback(normalizeUnknownError(error, 'Failed to delete version.').message)
        } finally {
            setVersionMutationLoading(false)
        }
    }

    async function handleSelectStrategyFromLibrary(strategyId: string) {
        const response = await fetch(`/api/strategies/${encodeURIComponent(strategyId)}`, { cache: 'no-store' })
        const json = await response.json()
        if (!response.ok || !json.strategy) {
            setVersionFeedback(json.error || 'Failed to attach strategy to MahaCharts.')
            return
        }

        const strategy = json.strategy as StrategyLibraryDocument
        setSelectedDraftId(strategy.id)
        setDraftName(strategy.name)
        setDraftDescription(strategy.description || '')
        setScriptSource(strategy.workspaceSession?.source || strategy.latestVersion?.source || defaultTemplate)
        setLinkedFixtureId(strategy.workspaceSession?.linkedFixtureId || strategy.latestVersion?.linkedFixtureId || '')
        setDraftRunSettings(strategy.workspaceSession?.runSettings || strategy.latestVersion?.runSettings || null)
        setCurrentStrategyDetail(strategy)
        setSelectedVersionId(strategy.workspaceSession?.baseVersionId || strategy.latestVersionId || '')
        updateWorkspaceRoute(strategy.workspaceSession?.symbol || strategy.symbol, strategy.workspaceSession?.timeframe || strategy.timeframe, strategy.id)
        setIndicatorModalOpen(false)
    }

    async function ensureDraftSaved() {
        if (selectedDraftId) {
            return selectedDraftId
        }

        const strategy = await handleAutosaveWorkspace()
        const resolvedStrategyId = strategy?.id || selectedDraftId
        if (!resolvedStrategyId) {
            throw new Error('Failed to save the current strategy before continuing.')
        }
        return resolvedStrategyId
    }

    function updateWorkspaceRoute(nextSymbol: string, nextTimeframe = routeTimeframe, nextDraftId = selectedDraftId || routeDraftId) {
        const params = new URLSearchParams()
        params.set('symbol', nextSymbol)
        params.set('timeframe', nextTimeframe)
        if (nextDraftId) {
            params.set('draft', nextDraftId)
        }
        startTransition(() => {
            router.replace(`/superchart?${params.toString()}`)
        })
    }

    function openEditorOverlay() {
        setActiveOverlay((current) => current?.kind === 'editor' ? null : { kind: 'editor' })
        setOverlayResizing(null)
    }

    function openRightOverlay(tab: RailTab) {
        setActiveOverlay((current) => (
            current?.kind === 'rightPanel' && current.tab === tab
                ? null
                : { kind: 'rightPanel', tab }
        ))
        setOverlayResizing(null)
    }

    function handleSymbolSubmit(nextSymbol?: string) {
        const value = (nextSymbol || symbolInput).trim().toUpperCase()
        if (!value) {
            return
        }
        setShowSymbolResults(false)
        updateWorkspaceRoute(value)
    }

    async function toggleWatchlistSymbol(symbol: string) {
        const nextSymbols = watchlistSymbols.includes(symbol)
            ? watchlistSymbols.filter((entry) => entry !== symbol)
            : [...watchlistSymbols, symbol]

        await updatePreferences({
            watchlistSymbols: serializeStringArray(nextSymbols),
        })
    }

    async function handleSaveDraft() {
        setDraftSaving(true)
        setValidationError(null)
        try {
            const strategy = await handleAutosaveWorkspace()
            if (!strategy) {
                throw new Error('Failed to save strategy workspace.')
            }
            await refreshStrategyLibrary(strategy.id)
            updateWorkspaceRoute(routeSymbol, routeTimeframe, strategy.id)
        } catch (error) {
            setValidationError(normalizeUnknownError(error, 'Failed to save script draft.').message)
        } finally {
            setDraftSaving(false)
        }
    }

    async function handleValidateScript() {
        setValidationLoading(true)
        setValidationError(null)
        try {
            const response = await fetch('/api/trading/compile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    script: scriptSource || defaultTemplate,
                    runSettings: draftRunSettings,
                }),
            })
            const json = await response.json()
            if (!response.ok || !json.success) {
                throw new Error(json.error || 'Failed to validate the Pine source.')
            }
            setValidationDiagnostics((json.diagnostics ?? null) as ValidationDiagnostics | null)
        } catch (error) {
            setValidationDiagnostics(null)
            setValidationError(normalizeUnknownError(error, 'Failed to validate the Pine source.').message)
        } finally {
            setValidationLoading(false)
        }
    }

    async function handleRunBacktest() {
        setBacktestLoading(true)
        setBacktestError(null)
        try {
            const endTime = linkedFixture?.manifest?.candleWindow.lastBarTime
                ? linkedFixture.manifest.candleWindow.lastBarTime
                : Math.floor(Date.now() / 1000)
            const startTime = linkedFixture?.manifest?.candleWindow.firstBarTime
                ? linkedFixture.manifest.candleWindow.firstBarTime
                : endTime - getDefaultLookbackSeconds(routeTimeframe)

            const response = await fetch('/api/trading/backtest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    strategy: {
                        id: selectedDraftId || 'superchart',
                        name: draftName || `${routeSymbol} Strategy`,
                        asset: routeSymbol,
                        timeframe: routeTimeframe,
                        script: scriptSource || defaultTemplate,
                        riskManagement: {
                            positionSizingPercent: 100,
                        },
                    },
                    startTime,
                    endTime,
                    fixtureId: linkedFixtureId || undefined,
                    runSettings: draftRunSettings || undefined,
                    comparisonMode,
                    providerOverride: provider === 'auto' ? undefined : provider,
                    marketDataSource: linkedFixture?.source === 'schwab-snapshot'
                        ? 'schwab-snapshot'
                        : linkedFixture
                            ? 'tradingview-fixture'
                            : 'live-market-data',
                }),
            })
            const json = await response.json()
            if (!response.ok && !json.results) {
                throw new Error(json.error || 'Backtest failed.')
            }
            const results = (json.results ?? json) as BacktestResult
            setBacktestResult(results)
            setDockTab('tester')
            setDockExpanded(true)
        } catch (error) {
            setBacktestError(normalizeUnknownError(error, 'Failed to run the strategy tester.').message)
        } finally {
            setBacktestLoading(false)
        }
    }

    async function handleSubmitOrder() {
        setOrderSubmitting(true)
        setOrderFeedback(null)
        try {
            const payload = buildOrderRequestFromDraft(orderDraft, currentPosition?.quantity)
            const response = await fetch('/api/schwab/orders', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: selectedAccountId,
                    order: payload,
                }),
            })
            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to submit order.')
            }

            setOrderFeedback({
                type: 'success',
                message: `Order submitted successfully (${json.orderId || 'pending confirmation'}).`,
            })

            const ordersResponse = await fetch(`/api/schwab/orders?accountId=${encodeURIComponent(selectedAccountId)}`, { cache: 'no-store' })
            const ordersJson = await ordersResponse.json()
            if (ordersResponse.ok) {
                setOrders((ordersJson.orders ?? []) as BrokerageOrder[])
            }
        } catch (error) {
            setOrderFeedback({
                type: 'error',
                message: normalizeUnknownError(error, 'Failed to submit order.').message,
            })
        } finally {
            setOrderSubmitting(false)
        }
    }

    async function handleCreateDeployment() {
        setDeploymentSubmitting(true)
        setDeploymentFeedback(null)
        try {
            const strategyId = await ensureDraftSaved()
            let strategyVersionId = selectedVersionId || currentStrategyDetail?.latestVersionId || ''

            if (!strategyVersionId) {
                const strategyAfterVersion = await createVersionForDeployment(strategyId)
                strategyVersionId = strategyAfterVersion?.latestVersionId || strategyAfterVersion?.workspaceSession?.baseVersionId || ''
            }

            const response = await fetch('/api/trading/deployments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    linkedScriptDraftId: strategyId,
                    strategyId,
                    strategyVersionId: strategyVersionId || null,
                    name: deploymentName.trim() || `${draftName || routeSymbol} • ${routeSymbol} ${routeTimeframe}`,
                    description: draftDescription || null,
                    symbol: routeSymbol,
                    timeframe: routeTimeframe,
                    target: deploymentTarget,
                    linkedAccountId: deploymentTarget === 'schwab-live' ? selectedAccountId || null : null,
                    marketDataSource: linkedFixture
                        ? linkedFixture.source === 'schwab-snapshot'
                            ? 'schwab-snapshot'
                            : 'exact-fixture-replay'
                        : provider === 'schwab'
                            ? 'schwab-snapshot'
                            : 'live-data-dependent',
                    runSettings: draftRunSettings,
                    executionConfig: {
                        defaultQuantity: Number(deploymentQuantity) || 1,
                        autoSubmit: deploymentAutoSubmit,
                        orderType: 'MARKET',
                    },
                }),
            })
            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to create deployment.')
            }

            setDeploymentFeedback(`Deployment ready. Webhook: ${json.deployment.webhookUrl}`)
            setDeploymentName('')
            await refreshDeployments()
            setActiveOverlay({ kind: 'rightPanel', tab: 'automation' })
            setOverlayResizing(null)
        } catch (error) {
            setDeploymentFeedback(normalizeUnknownError(error, 'Failed to create deployment.').message)
        } finally {
            setDeploymentSubmitting(false)
        }
    }

    async function handleToggleDeployment(deployment: StrategyDeploymentDocument) {
        const nextStatus = deployment.status === 'active' ? 'paused' : 'active'
        await fetch(`/api/trading/deployments/${deployment.id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: nextStatus }),
        })
        await refreshDeployments()
    }

    async function handleDeleteDeployment(deploymentId: string) {
        if (!window.confirm('Delete this strategy deployment and its webhook endpoint?')) {
            return
        }
        await fetch(`/api/trading/deployments/${deploymentId}`, {
            method: 'DELETE',
        })
        await refreshDeployments()
    }

    async function handleCopy(text: string | null | undefined) {
        if (!text) {
            return
        }
        await navigator.clipboard.writeText(text)
    }

    const latestBar = chartData.length > 0 ? chartData[chartData.length - 1] : null
    const latestTimestamp = toUnixTimestamp(latestBar?.time ?? null)
    const displayChartData = useMemo(() => {
        if (chartData.length === 0 || latestTimestamp === null) {
            return chartData
        }

        const startTimestamp = getRangePresetStartTimestamp(rangePreset, latestTimestamp)
        if (startTimestamp === null) {
            return chartData
        }

        const filtered = chartData.filter((point) => {
            const timestamp = toUnixTimestamp(point.time)
            return timestamp !== null && timestamp >= startTimestamp
        })

        return filtered.length > 0 ? filtered : chartData
    }, [chartData, latestTimestamp, rangePreset])
    const visibleBar = displayChartData.length > 0 ? displayChartData[displayChartData.length - 1] : latestBar
    const visibleBarTimestamp = toUnixTimestamp(visibleBar?.time ?? null)
    const lastPrice = latestBar?.close ?? null
    const previousPrice = chartData.length > 1 ? chartData[chartData.length - 2]?.close : null
    const dayChange = lastPrice !== null && previousPrice !== null ? lastPrice - previousPrice : null
    const dayChangePercent = lastPrice !== null && previousPrice ? ((lastPrice - previousPrice) / previousPrice) * 100 : null
    const isSymbolSaved = watchlistSymbols.includes(routeSymbol)
    const workspaceDraftLabel = currentDraft?.name || draftName || 'Unsaved workspace'
    const workspaceFeedLabel = linkedFixture ? linkedFixture.name : provider === 'schwab' ? 'Schwab live' : provider === 'yahoo' ? 'Yahoo live' : 'Auto live'
    const workspaceCompareLabel = backtestResult?.parityComparison?.exactMatch ? 'Exact parity' : linkedFixture ? 'Replay active' : 'Live data'
    const chartStatusLabel = linkedFixture ? 'Fixture replay' : marketDataLoading ? 'Loading' : marketDataError ? 'Data error' : 'Live market'
    const previewOrder = (() => {
        try {
            return buildOrderRequestFromDraft(orderDraft, currentPosition?.quantity)
        } catch {
            return null
        }
    })()
    const logRows = [
        ...(backtestResult?.diagnostics?.warnings ?? []).map((warning) => ({
            id: `warning:${warning}`,
            kind: 'warning',
            time: formatDateTime(Date.now()),
            message: warning,
        })),
        ...deployments.flatMap((deployment) => (deployment.signalEvents ?? []).slice(0, 3).map((event) => ({
            id: event.id,
            kind: 'signal',
            time: formatDateTime(event.receivedAt),
            message: `${deployment.name}: ${event.action || 'signal'} ${event.symbol || deployment.symbol} (${event.status})`,
        }))),
        ...deployments.flatMap((deployment) => (deployment.executionIntents ?? []).slice(0, 3).map((intent) => ({
            id: intent.id,
            kind: 'execution',
            time: formatDateTime(intent.createdAt),
            message: `${deployment.name}: ${intent.side} ${intent.symbol} ${intent.quantity || ''} (${intent.status})`,
        }))),
    ].slice(0, 20)

    const editorPanel = (
        <div data-testid="mahacharts-editor-panel" className="grid h-full min-h-0 gap-0 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="h-full min-h-[220px]">
                <MahitaCodeEditor value={scriptSource || defaultTemplate} onChange={setScriptSource} />
            </div>
            <div className="overflow-y-auto border-l border-white/10 bg-[#0a0d13] p-4">
                <div className="space-y-4">
                    <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Saved script</label>
                        <select
                            value={selectedDraftId}
                            onChange={(event) => {
                                const nextDraft = drafts.find((draft) => draft.id === event.target.value)
                                setSelectedDraftId(event.target.value)
                                if (nextDraft) {
                                    setDraftName(nextDraft.name)
                                    setDraftDescription(nextDraft.description || '')
                                    setScriptSource(nextDraft.source)
                                    setLinkedFixtureId(nextDraft.linkedFixtureId || '')
                                    setDraftRunSettings(nextDraft.runSettings || null)
                                    updateWorkspaceRoute(routeSymbol, routeTimeframe, nextDraft.id)
                                }
                            }}
                            className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none"
                        >
                            <option value="">Unsaved workspace</option>
                            {drafts.map((draft) => (
                                <option key={draft.id} value={draft.id}>{draft.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Draft name</label>
                        <input value={draftName} onChange={(event) => setDraftName(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
                    </div>
                    <div>
                        <label className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Description</label>
                        <textarea value={draftDescription} onChange={(event) => setDraftDescription(event.target.value)} className="mt-2 h-24 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none" />
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button onClick={() => void handleSaveDraft()} disabled={draftSaving} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/15 disabled:opacity-40">
                            {draftSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Save Workspace
                        </button>
                        <button onClick={() => void handleValidateScript()} disabled={validationLoading} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">
                            {validationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                            Validate
                        </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <button onClick={() => void handleSaveVersion()} disabled={versionMutationLoading || !scriptSource.trim()} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-40">
                            {versionMutationLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
                            Save Version
                        </button>
                        <div className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold ${
                            autosaveState === 'error'
                                ? 'bg-rose-500/10 text-rose-200'
                                : autosaveState === 'saving'
                                    ? 'bg-amber-500/10 text-amber-200'
                                    : autosaveState === 'saved'
                                        ? 'bg-emerald-500/10 text-emerald-200'
                                        : 'bg-white/5 text-slate-400'
                        }`}>
                            {autosaveState === 'saving' ? 'Autosaving…' : autosaveState === 'saved' ? 'Autosaved' : autosaveState === 'error' ? 'Autosave failed' : 'Autosave idle'}
                        </div>
                    </div>
                    {validationError ? (
                        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100">{validationError}</div>
                    ) : null}
                    {versionFeedback ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">{versionFeedback}</div>
                    ) : null}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Runtime settings</div>
                        <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <div>Linked fixture: <span className="font-semibold text-white">{linkedFixture?.name || 'None'}</span></div>
                            <div>Script header: <span className="font-semibold text-white">{validationDiagnostics?.strategySettings ? `${validationDiagnostics.strategySettings.defaultQtyType} ${validationDiagnostics.strategySettings.defaultQtyValue}` : 'Validate to inspect'}</span></div>
                            <div>Active override: <span className="font-semibold text-white">{validationDiagnostics?.activeRunSettings ? `${validationDiagnostics.activeRunSettings.defaultQtyType} ${validationDiagnostics.activeRunSettings.defaultQtyValue}` : 'Using saved/default settings'}</span></div>
                        </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                        <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Version history</div>
                            <div className="text-xs text-slate-400">{currentStrategyDetail?.versions.length || 0} versions</div>
                        </div>
                        <div className="mt-3 space-y-2">
                            {currentStrategyDetail?.versions.length ? currentStrategyDetail.versions.map((version) => (
                                <div key={version.id} className={`rounded-2xl border p-3 ${selectedVersionId === version.id ? 'border-indigo-500/30 bg-indigo-500/10' : 'border-white/10 bg-[#0a0d13]'}`}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold text-white">{version.label || `v${version.versionNumber}`}</div>
                                            <div className="mt-1 text-xs text-slate-400">{formatDateTime(version.createdAt)}</div>
                                        </div>
                                        <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{version.versionNumber}</div>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-2">
                                        <button onClick={() => setSelectedVersionId(version.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/5 hover:text-white">
                                            Inspect
                                        </button>
                                        <button onClick={() => void handleRestoreVersion(version.id)} className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/5 hover:text-white">
                                            Restore
                                        </button>
                                        <button onClick={() => void handleDeleteVersion(version.id)} className="rounded-xl border border-rose-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200 transition hover:bg-rose-500/10">
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-sm text-slate-400">Autosave creates a workspace lane immediately. Use “Save Version” when you want a durable, deployable snapshot.</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )

    const rightOverlayTitle = activeRightTab === 'watchlist'
        ? 'Watchlist'
        : activeRightTab === 'details'
            ? 'Symbol Details'
            : activeRightTab === 'trade'
                ? 'Trade Ticket'
                : activeRightTab === 'automation'
                    ? 'Automation'
                    : ''

    const rightOverlayPanel = activeRightTab === 'watchlist' ? (
        <div data-testid="mahacharts-watchlist-rail" className="space-y-2">
            {watchlistQuotes.length ? (
                watchlistQuotes.map((quote) => (
                    <div
                        key={quote.symbol}
                        data-testid="mahacharts-watchlist-card"
                        onClick={() => updateWorkspaceRoute(quote.symbol, routeTimeframe, routeDraftId)}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                                event.preventDefault()
                                updateWorkspaceRoute(quote.symbol, routeTimeframe, routeDraftId)
                            }
                        }}
                        role="button"
                        tabIndex={0}
                        aria-pressed={quote.symbol === routeSymbol}
                        className={`cursor-pointer rounded-2xl border px-4 py-3 transition focus:outline-none focus:ring-2 focus:ring-blue-400/60 ${quote.symbol === routeSymbol ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="text-base font-bold text-white">{quote.symbol}</div>
                                <div className="truncate text-xs text-slate-400">{quote.name}</div>
                            </div>
                            <button
                                onClick={(event) => {
                                    event.stopPropagation()
                                    toggleWatchlistSymbol(quote.symbol).catch(() => undefined)
                                }}
                                data-testid="mahacharts-watchlist-remove"
                                aria-label={`Remove ${quote.symbol} from watchlist`}
                                className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
                            >
                                <Star className="h-4 w-4 fill-current text-amber-300" />
                            </button>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-3">
                            <div className="text-lg font-bold text-white">{formatCurrency(quote.price)}</div>
                            <div className={`text-xs font-semibold ${(quote.changePercent ?? 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(quote.changePercent)}</div>
                        </div>
                    </div>
                ))
            ) : (
                <EmptyState title="Watchlist is empty" description="Save a symbol from the toolbar and it will appear here with live quotes and one-click navigation." />
            )}
        </div>
    ) : activeRightTab === 'details' ? (
        <div data-testid="mahacharts-details-rail" className="space-y-3">
            <PanelCard title="Symbol context">
                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Price</span>
                        <span className="font-semibold text-white">{formatCurrency(lastPrice)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Change</span>
                        <span className={`font-semibold ${typeof dayChange === 'number' && dayChange >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                            {dayChange !== null ? `${dayChange >= 0 ? '+' : ''}${formatCurrency(dayChange)} • ${formatPercent(dayChangePercent)}` : 'N/A'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Workspace</span>
                        <span className="font-semibold text-white">{workspaceDraftLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Feed</span>
                        <span className="font-semibold text-white">{workspaceFeedLabel}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Compare</span>
                        <span className="font-semibold text-white">{workspaceCompareLabel}</span>
                    </div>
                </div>
            </PanelCard>
            <PanelCard title="Linked routes">
                <div className="grid gap-2">
                    <Link href={`/chart?symbol=${encodeURIComponent(routeSymbol)}&timeframe=${encodeURIComponent(routeTimeframe)}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                        Open focused chart
                    </Link>
                    <Link href={`/backtest?strategy=${encodeURIComponent(selectedDraftId || '')}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                        Open backtester
                    </Link>
                    <Link href={`/script-editor?strategy=${encodeURIComponent(selectedDraftId || '')}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                        Open script editor
                    </Link>
                    <Link href={`/active-trader?symbol=${encodeURIComponent(routeSymbol)}`} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.06]">
                        Open Active Trader
                    </Link>
                </div>
            </PanelCard>
        </div>
    ) : activeRightTab === 'trade' ? (
        <div data-testid="mahacharts-trade-rail" className="space-y-3">
            <PanelCard title="Account context">
                <div className="space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Account</span>
                        <span className="font-semibold text-white">{selectedAccountId ? formatCompactId(selectedAccountId) : 'Not selected'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Buying power</span>
                        <span className="font-semibold text-white">{formatCurrency(balance?.buyingPower)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-slate-400">Position</span>
                        <span className="font-semibold text-white">{currentPosition ? `${currentPosition.quantity} shares` : 'Flat'}</span>
                    </div>
                    {brokerageError ? <div className="text-sm text-rose-300">{brokerageError}</div> : null}
                </div>
            </PanelCard>
            <PanelCard title="Order ticket">
                <div className="space-y-3">
                    <select value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none">
                        <option value="">Select account</option>
                        {accounts.map((account) => (
                            <option key={account.securitiesAccount.accountId} value={account.securitiesAccount.accountId}>
                                {formatCompactId(account.securitiesAccount.accountId)}
                            </option>
                        ))}
                    </select>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <select value={orderDraft.side} onChange={(event) => setOrderDraft((current) => createOrderDraft({ ...current, side: event.target.value as OrderDraft['side'] }))} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none">
                            <option value="BUY">Buy</option>
                            <option value="SELL">Sell</option>
                        </select>
                        <select value={orderDraft.orderType} onChange={(event) => setOrderDraft((current) => createOrderDraft({ ...current, orderType: event.target.value as OrderDraft['orderType'] }))} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none">
                            {ORDER_TYPES.map((type) => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <input value={orderDraft.quantity ?? ''} onChange={(event) => setOrderDraft((current) => createOrderDraft({ ...current, quantity: event.target.value ? Number(event.target.value) : undefined }))} placeholder="Quantity" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500" />
                        <input value={orderDraft.limitPrice ?? ''} onChange={(event) => setOrderDraft((current) => createOrderDraft({ ...current, limitPrice: event.target.value ? Number(event.target.value) : undefined }))} placeholder="Limit price" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500" />
                    </div>
                    <div data-testid="mahacharts-order-ticket" className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                        {previewOrder ? <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(previewOrder, null, 2)}</pre> : 'Configure a valid quantity to preview the Schwab order payload.'}
                    </div>
                    {orderFeedback ? (
                        <div className={`rounded-xl border p-3 text-sm ${orderFeedback.type === 'success' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/20 bg-rose-500/10 text-rose-100'}`}>
                            {orderFeedback.message}
                        </div>
                    ) : null}
                    <button onClick={() => void handleSubmitOrder()} disabled={!selectedAccountId || orderSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">
                        {orderSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
                        Submit order
                    </button>
                </div>
            </PanelCard>
            <PanelCard title="Recent orders">
                {orders.length ? (
                    <div className="space-y-2">
                        {orders.slice(0, 5).map((order) => (
                            <div key={order.orderId} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-sm text-slate-300">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="font-semibold text-white">Order {order.orderId}</span>
                                    <span className="text-xs uppercase tracking-[0.18em] text-slate-500">{order.status}</span>
                                </div>
                                <div className="mt-1 text-xs text-slate-500">{formatDateTime(order.enteredTime || null)}</div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <EmptyState title="No live orders" description="Orders submitted from the trade overlay appear here so MahaCharts and Active Trader stay in sync." />
                )}
            </PanelCard>
        </div>
    ) : activeRightTab === 'automation' ? (
        <div data-testid="mahacharts-automation-rail" className="space-y-3">
            <PanelCard title="Create deployment">
                <div data-testid="mahacharts-deployment-form" className="space-y-3">
                    <input value={deploymentName} onChange={(event) => setDeploymentName(event.target.value)} placeholder="Deployment name" className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500" />
                    <div className="grid gap-3 sm:grid-cols-2">
                        <select value={deploymentTarget} onChange={(event) => setDeploymentTarget(event.target.value as 'paper' | 'schwab-live')} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none">
                            <option value="paper">Paper</option>
                            <option value="schwab-live">Schwab live</option>
                        </select>
                        <input value={deploymentQuantity} onChange={(event) => setDeploymentQuantity(event.target.value)} placeholder="Default quantity" className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none placeholder:text-slate-500" />
                    </div>
                    <label className="flex items-center gap-3 text-sm text-slate-300">
                        <input type="checkbox" checked={deploymentAutoSubmit} onChange={(event) => setDeploymentAutoSubmit(event.target.checked)} />
                        Auto-submit execution intents
                    </label>
                    {deploymentFeedback ? (
                        <div className="rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-sm text-blue-100">{deploymentFeedback}</div>
                    ) : null}
                    <button onClick={() => void handleCreateDeployment()} disabled={deploymentSubmitting} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">
                        {deploymentSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        Create TradingView webhook deployment
                    </button>
                </div>
            </PanelCard>
            {deployments.length ? (
                <div className="space-y-2">
                    {deployments.map((deployment) => (
                        <div key={deployment.id} data-testid="mahacharts-deployment-card" className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-base font-bold text-white">{deployment.name}</div>
                                    <div className="mt-1 text-xs text-slate-400">{deployment.symbol} • {deployment.timeframe} • {deployment.target}</div>
                                </div>
                                <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${deployment.status === 'active' ? 'bg-emerald-500/15 text-emerald-300' : deployment.status === 'error' ? 'bg-rose-500/15 text-rose-300' : 'bg-white/10 text-slate-300'}`}>{deployment.status}</span>
                            </div>
                            <div className="mt-3 space-y-2 text-sm text-slate-300">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-xs text-slate-400">{deployment.webhookUrl || 'Webhook unavailable'}</span>
                                    <button onClick={() => void handleCopy(deployment.webhookUrl)} className="rounded-lg border border-white/10 p-2 text-slate-400 transition hover:bg-white/5 hover:text-white">
                                        <Copy className="h-4 w-4" />
                                    </button>
                                </div>
                                <div className="text-xs text-slate-500">Last signal: {formatDateTime(deployment.lastSignalAt || null)}</div>
                                <div className="text-xs text-slate-500">Last run: {formatDateTime(deployment.lastRunAt || null)}</div>
                                {deployment.lastError ? <div className="text-sm text-rose-300">{deployment.lastError}</div> : null}
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                                <button onClick={() => void handleToggleDeployment(deployment)} className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/5 hover:text-white">
                                    {deployment.status === 'active' ? 'Pause' : 'Resume'}
                                </button>
                                <button onClick={() => void handleDeleteDeployment(deployment.id)} className="rounded-lg border border-rose-500/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-200 transition hover:bg-rose-500/10">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <EmptyState title="No deployments yet" description="Create a webhook deployment and MahaCharts will log alerts, produce execution intents, and route them to paper or Schwab live mode." />
            )}
        </div>
    ) : null

    return (
        <>
            <SessionActivityTracker />
            <div
                ref={workspaceScrollRef}
                data-testid="mahacharts-workspace"
                className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0b0d12] text-white"
            >
                <div ref={topBarRef}>
                    <MahaChartsTopBar
                        symbolInput={symbolInput}
                        setSymbolInput={setSymbolInput}
                        deferredSymbolInput={deferredSymbolInput}
                        showSymbolResults={showSymbolResults}
                        setShowSymbolResults={setShowSymbolResults}
                        symbolLookupLoading={symbolLookupLoading}
                        symbolResults={symbolResults}
                        routeSymbol={routeSymbol}
                        routeTimeframe={routeTimeframe}
                        chartType={chartType}
                        indicators={indicators}
                        favoriteIndicatorIds={favoriteIndicatorIds}
                        strategyLibrary={strategyLibrary}
                        provider={provider}
                        comparisonMode={comparisonMode}
                        linkedFixtureId={linkedFixtureId}
                        compatibleFixtures={compatibleFixtures}
                        isSymbolSaved={isSymbolSaved}
                        draftSaving={draftSaving}
                        backtestLoading={backtestLoading}
                        onSelectTimeframe={(value) => updateWorkspaceRoute(routeSymbol, value, routeDraftId)}
                        onSubmitSymbol={handleSymbolSubmit}
                        onSetChartType={(value) => setChartType(value as ChartType)}
                        onSetProvider={(value) => setProvider(value as ProviderChoice)}
                        onSetComparisonMode={(value) => setComparisonMode(value as ComparisonMode)}
                        onSetLinkedFixture={setLinkedFixtureId}
                        onOpenIndicators={() => {
                            setIndicatorModalTab('indicators')
                            setIndicatorModalOpen(true)
                        }}
                        onOpenStrategies={() => {
                            setIndicatorModalTab('strategies')
                            setIndicatorModalOpen(true)
                        }}
                        onToggleIndicator={(indicatorId) => {
                            setIndicators((current) => current.includes(indicatorId)
                                ? current.filter((entry) => entry !== indicatorId)
                                : [...current, indicatorId])
                        }}
                        onSelectStrategy={handleSelectStrategyFromLibrary}
                        onToggleWatchlist={() => toggleWatchlistSymbol(routeSymbol).catch(() => undefined)}
                        onOpenAutomation={() => openRightOverlay('automation')}
                        onOpenTester={() => {
                            setDockTab('tester')
                            setDockExpanded(true)
                            void handleRunBacktest()
                        }}
                        onOpenSettings={() => openRightOverlay('details')}
                        onSaveDraft={() => {
                            void handleSaveDraft()
                        }}
                        onCopySnapshot={() => void handleCopy(window.location.href)}
                    />
                </div>

                <div className="flex min-h-0 flex-1 overflow-hidden">
                    <MahaChartsLeftRail activeTool={leftTool} onSelectTool={setLeftTool} />

                    <div className="flex min-w-0 flex-1 flex-col overflow-hidden pr-[56px]">
                        <div ref={workspaceViewportRef} className="relative flex min-h-0 flex-1 overflow-hidden">
                            <MahaChartsStage
                                routeSymbol={routeSymbol}
                                routeTimeframe={routeTimeframe}
                                chartType={chartType}
                                marketStatusLabel={chartStatusLabel}
                                workspaceFeedLabel={workspaceFeedLabel}
                                workspaceDraftLabel={workspaceDraftLabel}
                                lastPrice={lastPrice}
                                dayChange={dayChange}
                                dayChangePercent={dayChangePercent}
                                activeBar={visibleBar}
                                activeBarTimestamp={visibleBarTimestamp}
                                indicators={indicators}
                                attachedStrategyName={currentStrategyDetail?.name || currentStrategy?.name || null}
                                attachedStrategyVersionLabel={currentVersion?.label || (currentVersion ? `v${currentVersion.versionNumber}` : null)}
                                rangePreset={rangePreset}
                                onRangePresetChange={setRangePreset}
                            >
                                {marketDataLoading ? (
                                    <div className="flex h-full items-center justify-center text-slate-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <Loader2 className="h-7 w-7 animate-spin text-blue-300" />
                                            <span className="text-sm font-medium">Loading market data…</span>
                                        </div>
                                    </div>
                                ) : marketDataError ? (
                                    <div className="flex h-full items-center justify-center p-6">
                                        <div className="max-w-lg rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-center">
                                            <div className="text-sm font-semibold text-rose-100">{marketDataError}</div>
                                            <button
                                                onClick={() => updateWorkspaceRoute(routeSymbol, routeTimeframe, routeDraftId)}
                                                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-rose-400/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-100 transition hover:bg-rose-500/10"
                                            >
                                                <RefreshCw className="h-4 w-4" />
                                                Retry
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <Chart
                                        key={`${routeSymbol}:${routeTimeframe}:${chartType}:${indicators.join(',')}:${rangePreset}`}
                                        data={displayChartData}
                                        trades={backtestResult?.trades}
                                        chartType={chartType}
                                        indicators={indicators}
                                    />
                                )}
                            </MahaChartsStage>

                        </div>

                        <MahaChartsBottomDock
                            dockTab={dockTab}
                            dockExpanded={dockExpanded}
                            editorOverlayOpen={editorOverlayOpen}
                            onSelectTab={(nextTab) => {
                                if (nextTab === 'editor') {
                                    openEditorOverlay()
                                    return
                                }

                                setDockTab(nextTab)
                                setDockExpanded(true)
                            }}
                            onToggleExpand={() => setDockExpanded((current) => !current)}
                        >
                            {dockTab === 'tester' ? (
                                <div data-testid="mahacharts-tester-panel" className="grid gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                                    <div className="space-y-4">
                                        <div data-testid="mahacharts-tester-metrics" className="grid gap-4 md:grid-cols-4">
                                            <div data-testid="mahacharts-metric-net-pnl">
                                                <MetricCard label="Net P&L" value={formatCurrency(backtestResult?.metrics.netProfit)} tone={(backtestResult?.metrics.netProfit ?? 0) >= 0 ? 'positive' : 'negative'} />
                                            </div>
                                            <div data-testid="mahacharts-metric-net-percent">
                                                <MetricCard label="Net %" value={formatPercent(backtestResult?.metrics.netProfitPercent)} tone={(backtestResult?.metrics.netProfitPercent ?? 0) >= 0 ? 'positive' : 'negative'} />
                                            </div>
                                            <div data-testid="mahacharts-metric-trades">
                                                <MetricCard label="Trades" value={String(backtestResult?.metrics.totalTrades ?? 0)} />
                                            </div>
                                            <div data-testid="mahacharts-metric-win-rate">
                                                <MetricCard label="Win rate" value={formatPercent(backtestResult?.metrics.winRate)} />
                                            </div>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <PanelCard title="Parity">
                                                {backtestResult?.parityComparison ? (
                                                    <div className="space-y-2 text-sm text-slate-300">
                                                        <div className={`font-semibold ${backtestResult.parityComparison.exactMatch ? 'text-emerald-300' : 'text-amber-300'}`}>
                                                            {backtestResult.parityComparison.exactMatch ? 'Exact fixture match' : 'Divergence detected'}
                                                        </div>
                                                        <div>Expected trades: {backtestResult.parityComparison.expectedTradeCount}</div>
                                                        <div>Actual trades: {backtestResult.parityComparison.actualTradeCount}</div>
                                                        <div>First divergence: {backtestResult.parityComparison.firstDivergenceMessage || 'None'}</div>
                                                    </div>
                                                ) : (
                                                    <EmptyState title="No parity reference selected" description="Link a TradingView fixture or Schwab snapshot to compare this run against a deterministic baseline." />
                                                )}
                                            </PanelCard>
                                            <PanelCard title="Execution diagnostics">
                                                <div className="space-y-2 text-sm text-slate-300">
                                                    <div>Engine: <span className="font-semibold text-white">{backtestResult?.diagnostics?.engineMode || 'pinets'}</span></div>
                                                    <div>Source: <span className="font-semibold text-white">{backtestResult?.diagnostics?.dataSource || (linkedFixture?.source || 'live-market-data')}</span></div>
                                                    <div>Mode: <span className="font-semibold text-white">{backtestResult?.diagnostics?.comparisonMode || comparisonMode}</span></div>
                                                    <div>Warnings: <span className="font-semibold text-white">{backtestResult?.diagnostics?.warnings?.length || 0}</span></div>
                                                </div>
                                            </PanelCard>
                                        </div>
                                        {backtestError ? (
                                            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-100">{backtestError}</div>
                                        ) : null}
                                    </div>
                                    <div className="rounded-3xl border border-white/10 bg-[#0a0d13] p-4">
                                        <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Tester controls</div>
                                        <div className="mt-4 space-y-3">
                                            <div>
                                                <label className="text-xs font-semibold text-slate-400">Fixture</label>
                                                <select value={linkedFixtureId} onChange={(event) => setLinkedFixtureId(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                                                    <option value="">Live / none</option>
                                                    {compatibleFixtures.map((fixture) => (
                                                        <option key={fixture.id} value={fixture.id}>{fixture.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-semibold text-slate-400">Comparison mode</label>
                                                <select value={comparisonMode} onChange={(event) => setComparisonMode(event.target.value as ComparisonMode)} className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none">
                                                    {COMPARISON_MODES.map((mode) => (
                                                        <option key={mode.value} value={mode.value}>{mode.label}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <button onClick={() => void handleRunBacktest()} disabled={backtestLoading} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-600 disabled:opacity-40">
                                                {backtestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                                Run Backtest
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {dockTab === 'trades' ? (
                                <div data-testid="mahacharts-trades-panel" className="p-4">
                                    {backtestResult?.trades?.length ? (
                                        <div className="overflow-hidden rounded-3xl border border-white/10">
                                            <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                                                <thead className="bg-white/[0.03] text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-3">Side</th>
                                                        <th className="px-4 py-3">Entry</th>
                                                        <th className="px-4 py-3">Exit</th>
                                                        <th className="px-4 py-3">Bars</th>
                                                        <th className="px-4 py-3">P&L</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/10 bg-[#0a0d13] text-slate-300">
                                                    {backtestResult.trades.map((trade) => (
                                                        <tr key={trade.id}>
                                                            <td className="px-4 py-3 font-semibold text-white">{trade.side}</td>
                                                            <td className="px-4 py-3">{formatDateTime(trade.entryTime)}</td>
                                                            <td className="px-4 py-3">{formatDateTime(trade.exitTime)}</td>
                                                            <td className="px-4 py-3">{trade.durationBars}</td>
                                                            <td className={`px-4 py-3 font-semibold ${trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatCurrency(trade.pnl)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <EmptyState title="No trades yet" description="Run the strategy tester to populate a TradingView-style list of entries, exits, and trade durations." />
                                    )}
                                </div>
                            ) : null}

                            {dockTab === 'orders' ? (
                                <div data-testid="mahacharts-orders-panel" className="p-4">
                                    {orders.length ? (
                                        <div className="grid gap-3">
                                            {orders.map((order) => (
                                                <div key={order.orderId} className="rounded-3xl border border-white/10 bg-[#0a0d13] p-4">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <div className="text-sm font-semibold text-white">Order {order.orderId}</div>
                                                        <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-slate-300">{order.status}</div>
                                                    </div>
                                                    <div className="mt-3 text-sm text-slate-400">{formatDateTime(order.enteredTime || null)}</div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <EmptyState title="No live orders" description="Orders submitted from the Trade rail appear here so MahaCharts and Active Trader stay in sync." />
                                    )}
                                </div>
                            ) : null}

                            {dockTab === 'positions' ? (
                                <div data-testid="mahacharts-positions-panel" className="grid gap-3 p-4 md:grid-cols-2">
                                    {positions.length ? positions.map((position) => (
                                        <div key={position.symbol} className="rounded-3xl border border-white/10 bg-[#0a0d13] p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="text-lg font-black text-white">{position.symbol}</div>
                                                <div className={`text-sm font-semibold ${position.unrealizedPL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{formatPercent(position.unrealizedPLPercent)}</div>
                                            </div>
                                            <div className="mt-4 grid gap-2 text-sm text-slate-300">
                                                <div>Qty: <span className="font-semibold text-white">{position.quantity}</span></div>
                                                <div>Average: <span className="font-semibold text-white">{formatCurrency(position.averagePrice)}</span></div>
                                                <div>Value: <span className="font-semibold text-white">{formatCurrency(position.marketValue)}</span></div>
                                                <div>Unrealized: <span className="font-semibold text-white">{formatCurrency(position.unrealizedPL)}</span></div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="md:col-span-2">
                                            <EmptyState title="No positions loaded" description="Select an account in the Trade rail to hydrate live Schwab positions inside the workspace." />
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {dockTab === 'logs' ? (
                                <div data-testid="mahacharts-logs-panel" className="space-y-3 p-4">
                                    {logRows.length ? logRows.map((row) => (
                                        <div key={row.id} data-testid="mahacharts-log-row" className="rounded-3xl border border-white/10 bg-[#0a0d13] p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-sm font-semibold text-white">{row.kind}</div>
                                                <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{row.time}</div>
                                            </div>
                                            <div className="mt-2 text-sm text-slate-300">{row.message}</div>
                                        </div>
                                    )) : (
                                        <EmptyState title="Logs are quiet" description="Warnings, webhook signals, and execution intents show up here once you validate scripts, run backtests, or start deployments." />
                                    )}
                                </div>
                            ) : null}

                            {dockTab === 'trading' ? (
                                <div data-testid="mahacharts-trading-panel" className="grid gap-4 p-4 lg:grid-cols-2">
                                    <PanelCard title="Account focus">
                                        <div className="space-y-2 text-sm text-slate-300">
                                            <div>Account: <span className="font-semibold text-white">{selectedAccountId ? formatCompactId(selectedAccountId) : 'Not selected'}</span></div>
                                            <div>Position: <span className="font-semibold text-white">{currentPosition ? `${currentPosition.quantity} shares` : 'Flat'}</span></div>
                                            <div>Market value: <span className="font-semibold text-white">{formatCurrency(currentPosition?.marketValue)}</span></div>
                                        </div>
                                    </PanelCard>
                                    <PanelCard title="Order preview">
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
                                            {previewOrder ? <pre className="overflow-auto whitespace-pre-wrap">{JSON.stringify(previewOrder, null, 2)}</pre> : 'Configure a valid quantity to preview the Schwab order payload.'}
                                        </div>
                                    </PanelCard>
                                </div>
                            ) : null}
                        </MahaChartsBottomDock>
                    </div>
                </div>
                <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 z-30"
                    style={{ top: `${topBarHeight}px` }}
                >
                    <div className="pointer-events-auto absolute inset-y-0 right-0">
                        <MahaChartsRightStrip activeTab={activeRightTab} onToggleTab={openRightOverlay} />
                    </div>
                    {activeRightTab ? (
                        <MahaChartsRightOverlay
                            width={rightOverlayWidths[activeRightTab]}
                            title={rightOverlayTitle}
                            subtitle={`${routeSymbol} workspace`}
                            resizing={overlayResizing === activeRightTab}
                            onStartResize={() => setOverlayResizing(activeRightTab)}
                            onClose={() => {
                                setActiveOverlay(null)
                                setOverlayResizing(null)
                            }}
                        >
                            {rightOverlayPanel}
                        </MahaChartsRightOverlay>
                    ) : null}
                    {editorOverlayOpen ? (
                        <MahaChartsEditorOverlay
                            width={editorOverlayWidth}
                            autosaveState={autosaveState}
                            draftName={draftName || currentStrategyDetail?.name || workspaceDraftLabel}
                            versionLabel={currentVersion?.label || (currentVersion ? `v${currentVersion.versionNumber}` : 'workspace')}
                            resizing={overlayResizing === 'editor'}
                            onStartResize={() => setOverlayResizing('editor')}
                            onClose={() => {
                                setActiveOverlay(null)
                                setOverlayResizing(null)
                            }}
                        >
                            {editorPanel}
                        </MahaChartsEditorOverlay>
                    ) : null}
                </div>
            </div>
            <IndicatorsStrategiesModal
                open={indicatorModalOpen}
                tab={indicatorModalTab}
                query={indicatorQuery}
                setQuery={setIndicatorQuery}
                onClose={() => setIndicatorModalOpen(false)}
                onSelectTab={setIndicatorModalTab}
                indicators={indicatorCatalog}
                profiles={profileCatalog}
                patterns={patternCatalog}
                favoriteIndicatorIds={favoriteIndicatorIds}
                activeIndicatorIds={indicators}
                strategyLibrary={strategyLibrary}
                onToggleIndicator={(indicatorId) => {
                    setIndicators((current) => current.includes(indicatorId)
                        ? current.filter((entry) => entry !== indicatorId)
                        : [...current, indicatorId])
                }}
                onToggleFavoriteIndicator={(indicatorId) => {
                    const nextFavorites = favoriteIndicatorIds.includes(indicatorId)
                        ? favoriteIndicatorIds.filter((entry) => entry !== indicatorId)
                        : [...favoriteIndicatorIds, indicatorId]
                    updatePreferences({
                        indicatorFavorites: serializeStringArray(nextFavorites),
                    }).catch(() => undefined)
                }}
                onSelectStrategy={handleSelectStrategyFromLibrary}
            />
        </>
    )
}

function MahaChartsTopBar({
    symbolInput,
    setSymbolInput,
    deferredSymbolInput,
    showSymbolResults,
    setShowSymbolResults,
    symbolLookupLoading,
    symbolResults,
    routeSymbol,
    routeTimeframe,
    chartType,
    indicators,
    favoriteIndicatorIds,
    strategyLibrary,
    provider,
    comparisonMode,
    linkedFixtureId,
    compatibleFixtures,
    isSymbolSaved,
    draftSaving,
    backtestLoading,
    onSelectTimeframe,
    onSubmitSymbol,
    onSetChartType,
    onSetProvider,
    onSetComparisonMode,
    onSetLinkedFixture,
    onOpenIndicators,
    onOpenStrategies,
    onToggleIndicator,
    onSelectStrategy,
    onToggleWatchlist,
    onOpenAutomation,
    onOpenTester,
    onOpenSettings,
    onSaveDraft,
    onCopySnapshot,
}: {
    symbolInput: string
    setSymbolInput: (value: string) => void
    deferredSymbolInput: string
    showSymbolResults: boolean
    setShowSymbolResults: (value: boolean) => void
    symbolLookupLoading: boolean
    symbolResults: SymbolLookupResult[]
    routeSymbol: string
    routeTimeframe: string
    chartType: ChartType
    indicators: string[]
    favoriteIndicatorIds: string[]
    strategyLibrary: StrategyLibraryDocument[]
    provider: ProviderChoice
    comparisonMode: ComparisonMode
    linkedFixtureId: string
    compatibleFixtures: ParityFixtureDocument[]
    isSymbolSaved: boolean
    draftSaving: boolean
    backtestLoading: boolean
    onSelectTimeframe: (value: string) => void
    onSubmitSymbol: (symbol?: string) => void
    onSetChartType: (value: string) => void
    onSetProvider: (value: string) => void
    onSetComparisonMode: (value: string) => void
    onSetLinkedFixture: (value: string) => void
    onOpenIndicators: () => void
    onOpenStrategies: () => void
    onToggleIndicator: (indicator: string) => void
    onSelectStrategy: (strategyId: string) => void
    onToggleWatchlist: () => void
    onOpenAutomation: () => void
    onOpenTester: () => void
    onOpenSettings: () => void
    onSaveDraft: () => void
    onCopySnapshot: () => void
}) {
    return (
        <header data-testid="mahacharts-topbar" className="border-b border-white/10 bg-[#0f141d]/96 px-4 py-3 backdrop-blur-xl">
            <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
                    <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white">
                        <ArrowLeft className="h-4 w-4" />
                        Terminal
                    </Link>
                    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                        <CandlestickChart className="h-4 w-4 text-blue-300" />
                        <div>
                            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">MahaCharts</div>
                            <div className="text-sm font-semibold text-white">Single-chart workspace</div>
                        </div>
                    </div>
                    <div className="relative min-w-[260px] flex-1 xl:max-w-[420px]">
                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#090c12]/70 px-4 py-3 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
                            <Search className="h-4 w-4 text-blue-300" />
                            <input
                                value={symbolInput}
                                onChange={(event) => {
                                    setSymbolInput(event.target.value)
                                    setShowSymbolResults(true)
                                }}
                                onFocus={() => setShowSymbolResults(true)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') {
                                        event.preventDefault()
                                        onSubmitSymbol()
                                    }
                                }}
                                placeholder="Search symbol or company"
                                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
                            />
                            {symbolLookupLoading ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                        </div>
                        {showSymbolResults && (symbolResults.length > 0 || deferredSymbolInput.trim()) ? (
                            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-40 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14]/95 shadow-[0_30px_70px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                                {symbolResults.length === 0 ? (
                                    <button
                                        onClick={() => onSubmitSymbol()}
                                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-slate-300 transition hover:bg-white/5"
                                    >
                                        <span>Open {symbolInput.trim().toUpperCase()} in MahaCharts</span>
                                        <ExternalLink className="h-4 w-4" />
                                    </button>
                                ) : (
                                    symbolResults.map((result) => (
                                        <button
                                            key={`${result.source}:${result.symbol}`}
                                            onClick={() => onSubmitSymbol(result.symbol)}
                                            className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-white/5"
                                        >
                                            <div>
                                                <div className="text-sm font-semibold text-white">{result.symbol}</div>
                                                <div className="text-xs text-slate-400">{result.name}</div>
                                            </div>
                                            <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                                                {result.exchange || result.source}
                                            </div>
                                        </button>
                                    ))
                                )}
                            </div>
                        ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {TIMEFRAMES.map((option) => (
                            <button
                                key={option}
                                data-testid={`mahacharts-timeframe-${option}`}
                                onClick={() => onSelectTimeframe(option)}
                                className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${routeTimeframe === option ? 'bg-blue-500 text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)]' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                            >
                                {option}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div data-testid="mahacharts-provider-select">
                        <SelectPill label="Provider" value={provider} onChange={onSetProvider} options={PROVIDERS.map((entry) => ({ value: entry.value, label: entry.label }))} />
                    </div>
                    <div data-testid="mahacharts-reference-select">
                        <SelectPill label="Reference" value={linkedFixtureId} onChange={onSetLinkedFixture} options={[{ value: '', label: 'Live / none' }, ...compatibleFixtures.map((fixture) => ({ value: fixture.id, label: fixture.name }))]} />
                    </div>
                    <div data-testid="mahacharts-compare-select">
                        <SelectPill label="Compare" value={comparisonMode} onChange={onSetComparisonMode} options={COMPARISON_MODES.map((entry) => ({ value: entry.value, label: entry.label }))} />
                    </div>
                    <div data-testid="mahacharts-chart-select">
                        <SelectPill label="Chart Type" value={chartType} onChange={onSetChartType} options={[{ value: 'Standard', label: 'Candles' }, { value: 'HeikinAshi', label: 'Heikin Ashi' }]} />
                    </div>
                    <button
                        data-testid="mahacharts-open-indicators"
                        onClick={onOpenIndicators}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                        <BarChart3 className="h-4 w-4 text-blue-300" />
                        Indicators
                        <ChevronDown className="h-4 w-4 text-slate-500" />
                    </button>
                    <button
                        data-testid="mahacharts-open-strategies"
                        onClick={onOpenStrategies}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                    >
                        <TerminalSquare className="h-4 w-4 text-indigo-300" />
                        My Strategies
                    </button>
                    {favoriteIndicatorIds.slice(0, 4).map((indicatorId) => (
                        <button
                            key={indicatorId}
                            data-testid={`mahacharts-favorite-indicator-${indicatorId}`}
                            onClick={() => onToggleIndicator(indicatorId)}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] transition ${indicators.includes(indicatorId) ? 'bg-blue-500 text-white' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
                        >
                            {formatIndicatorLabel(indicatorId)}
                        </button>
                    ))}
                    {strategyLibrary.slice(0, 2).map((strategy) => (
                        <button
                            key={strategy.id}
                            onClick={() => onSelectStrategy(strategy.id)}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                        >
                            {strategy.name}
                        </button>
                    ))}
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        <ToolbarButton label={isSymbolSaved ? 'Saved' : 'Watchlist'} onClick={onToggleWatchlist} tone={isSymbolSaved ? 'positive' : 'neutral'} icon={<Star className={`h-4 w-4 ${isSymbolSaved ? 'fill-current' : ''}`} />} />
                        <ToolbarButton label="Alert" onClick={onOpenAutomation} icon={<BellPlus className="h-4 w-4" />} />
                        <ToolbarButton label="Replay" onClick={onOpenTester} icon={backtestLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} />
                        <ToolbarButton label="Save" onClick={onSaveDraft} icon={draftSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} />
                        <IconToolbarButton label="Settings" onClick={onOpenSettings} icon={<Settings2 className="h-4 w-4" />} />
                        <IconToolbarButton label="Snapshot" onClick={onCopySnapshot} icon={<Camera className="h-4 w-4" />} />
                        <Link href={`/active-trader?symbol=${encodeURIComponent(routeSymbol)}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(59,130,246,0.35)] transition hover:bg-blue-600">
                            <ShoppingCart className="h-4 w-4" />
                            Trade
                        </Link>
                    </div>
                </div>
            </div>
        </header>
    )
}

function MahaChartsLeftRail({
    activeTool,
    onSelectTool,
}: {
    activeTool: LeftTool
    onSelectTool: (tool: LeftTool) => void
}) {
    return (
        <aside data-testid="mahacharts-left-rail" className="hidden w-[58px] shrink-0 border-r border-white/10 bg-[#0b0f16]/92 py-3 md:flex md:flex-col md:items-center md:gap-2">
            {LEFT_RAIL_TOOLS.map((tool) => {
                const Icon = tool.icon
                return (
                    <button
                        key={tool.id}
                        data-testid={`mahacharts-left-tool-${tool.id}`}
                        onClick={() => onSelectTool(tool.id)}
                        title={tool.label}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${activeTool === tool.id ? 'bg-blue-500 text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                )
            })}
        </aside>
    )
}

function MahaChartsStage({
    routeSymbol,
    routeTimeframe,
    chartType,
    marketStatusLabel,
    workspaceFeedLabel,
    workspaceDraftLabel,
    lastPrice,
    dayChange,
    dayChangePercent,
    activeBar,
    activeBarTimestamp,
    indicators,
    attachedStrategyName,
    attachedStrategyVersionLabel,
    rangePreset,
    onRangePresetChange,
    children,
}: {
    routeSymbol: string
    routeTimeframe: string
    chartType: ChartType
    marketStatusLabel: string
    workspaceFeedLabel: string
    workspaceDraftLabel: string
    lastPrice: number | null
    dayChange: number | null
    dayChangePercent: number | null
    activeBar: MarketDataPoint | null
    activeBarTimestamp: number | null
    indicators: string[]
    attachedStrategyName: string | null
    attachedStrategyVersionLabel: string | null
    rangePreset: RangePreset
    onRangePresetChange: (preset: RangePreset) => void
    children: ReactNode
}) {
    const changeTone = typeof dayChange === 'number' && dayChange >= 0 ? 'text-emerald-300' : 'text-rose-300'

    return (
        <section data-testid="mahacharts-stage" className="flex min-w-0 flex-1 flex-col overflow-hidden px-2 py-2">
            <div data-testid="mahacharts-stage-header" className="border border-white/10 border-b-0 bg-[#f8fafc] px-3 py-2 text-slate-700">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span className="text-xl font-semibold tracking-tight text-slate-900">{routeSymbol}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-medium text-slate-500">{routeTimeframe}</span>
                    <span className="font-medium text-slate-500">{workspaceFeedLabel}</span>
                    <span className={`font-semibold ${dayChange !== null ? changeTone : 'text-slate-500'}`}>
                        {dayChange !== null ? `${dayChange >= 0 ? '+' : ''}${formatCurrency(dayChange)} • ${formatPercent(dayChangePercent)}` : 'Waiting for price'}
                    </span>
                    <span className="font-medium text-slate-500">O {formatCurrency(activeBar?.open ?? null)}</span>
                    <span className="font-medium text-slate-500">H {formatCurrency(activeBar?.high ?? null)}</span>
                    <span className="font-medium text-slate-500">L {formatCurrency(activeBar?.low ?? null)}</span>
                    <span className="font-medium text-slate-500">C {formatCurrency(activeBar?.close ?? null)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{workspaceDraftLabel}</span>
                    <span className={`rounded-full px-2.5 py-1 ${marketStatusLabel === 'Live market' ? 'border border-emerald-200 bg-emerald-50 text-emerald-600' : marketStatusLabel === 'Fixture replay' ? 'border border-blue-200 bg-blue-50 text-blue-600' : 'border border-slate-200 bg-white text-slate-500'}`}>{marketStatusLabel}</span>
                    {activeBarTimestamp ? <span>{formatDateTime(activeBarTimestamp)}</span> : null}
                </div>
            </div>

            <div data-testid="mahacharts-chart-shell" className="relative flex min-h-0 flex-1 flex-col overflow-hidden border border-white/10 bg-[#f8fafc]">
                <div className="pointer-events-none absolute left-3 top-3 z-10 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5">
                    {indicators.map((indicator) => (
                        <div key={indicator} className="rounded-full border border-slate-300 bg-white/85 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600 shadow-sm">
                            {formatIndicatorLabel(indicator)}
                        </div>
                    ))}
                    {attachedStrategyName ? (
                        <div className="rounded-full border border-indigo-200 bg-indigo-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 shadow-sm">
                            {attachedStrategyName}{attachedStrategyVersionLabel ? ` • ${attachedStrategyVersionLabel}` : ''}
                        </div>
                    ) : null}
                </div>
                <div data-testid="mahacharts-chart-panel" className="min-h-0 flex-1">
                    {children}
                </div>
                <div data-testid="mahacharts-range-toolbar" className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#0f1218] px-4 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                        {RANGE_PRESETS.map((preset) => (
                            <button
                                key={preset}
                                data-testid={`mahacharts-range-${preset.toLowerCase()}`}
                                onClick={() => onRangePresetChange(preset)}
                                className={`rounded px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.18em] transition ${rangePreset === preset ? 'bg-white text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                        <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
                        <span className="text-slate-300">Go to latest</span>
                        <span className="text-slate-300">ADJ</span>
                    </div>
                </div>
            </div>
        </section>
    )
}

function MahaChartsRightStrip({
    activeTab,
    onToggleTab,
}: {
    activeTab: RailTab | null
    onToggleTab: (tab: RailTab) => void
}) {
    const tabs: Array<{ key: RailTab, label: string, icon: typeof Star, testId: string }> = [
        { key: 'watchlist', label: 'Watchlist', icon: Star, testId: 'mahacharts-right-icon-watchlist' },
        { key: 'details', label: 'Details', icon: Info, testId: 'mahacharts-right-icon-details' },
        { key: 'trade', label: 'Trade', icon: ShoppingCart, testId: 'mahacharts-right-icon-trade' },
        { key: 'automation', label: 'Automation', icon: Bot, testId: 'mahacharts-right-icon-automation' },
    ]

    return (
        <aside
            data-testid="mahacharts-right-strip"
            className="flex h-full w-[56px] shrink-0 flex-col items-center gap-4 border-l border-white/10 bg-[#0b0f16]/96 py-4"
        >
            {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                    <button
                        key={tab.key}
                        data-testid={tab.testId}
                        onClick={() => onToggleTab(tab.key)}
                        title={tab.label}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition ${activeTab === tab.key ? 'bg-blue-500 text-white shadow-[0_10px_24px_rgba(59,130,246,0.35)]' : 'text-slate-400 hover:bg-white/[0.05] hover:text-white'}`}
                    >
                        <Icon className="h-4 w-4" />
                    </button>
                )
            })}
        </aside>
    )
}

function MahaChartsOverlayShell({
    testId,
    width,
    resizeHandleTestId,
    closeButtonTestId,
    eyebrow,
    title,
    subtitle,
    resizing,
    onStartResize,
    onClose,
    headerActions,
    children,
}: {
    testId: string
    width: number
    resizeHandleTestId: string
    closeButtonTestId: string
    eyebrow: string
    title: string
    subtitle?: string
    resizing: boolean
    onStartResize: () => void
    onClose: () => void
    headerActions?: ReactNode
    children: ReactNode
}) {
    return (
        <div
            data-testid={testId}
            className="pointer-events-none absolute inset-y-2 z-40 flex"
            style={{ width: `${width}px`, right: `${OVERLAY_RIGHT_OFFSET}px`, maxWidth: `calc(100% - ${OVERLAY_RIGHT_OFFSET + 12}px)` }}
        >
            <button
                data-testid={resizeHandleTestId}
                aria-label={`Resize ${title}`}
                onMouseDown={(event) => {
                    event.preventDefault()
                    onStartResize()
                }}
                className={`pointer-events-auto absolute inset-y-0 left-0 z-10 w-3 -translate-x-1/2 cursor-col-resize rounded-full transition ${resizing ? 'bg-blue-400/50' : 'bg-transparent hover:bg-blue-400/20'}`}
            />
            <div className="pointer-events-auto flex min-w-0 flex-1 flex-col overflow-hidden rounded-[22px] border border-white/10 bg-[#06090f]/96 shadow-[0_28px_90px_rgba(0,0,0,0.58)] backdrop-blur-xl">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div className="min-w-0">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{eyebrow}</div>
                        <div className="truncate text-lg font-black text-white">{title}</div>
                        {subtitle ? <div className="mt-1 truncate text-xs text-slate-500">{subtitle}</div> : null}
                    </div>
                    <div className="flex items-center gap-2">
                        {headerActions}
                        <button
                            data-testid={closeButtonTestId}
                            onClick={onClose}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                    {children}
                </div>
            </div>
        </div>
    )
}

function MahaChartsRightOverlay({
    width,
    title,
    subtitle,
    resizing,
    onStartResize,
    onClose,
    children,
}: {
    width: number
    title: string
    subtitle: string
    resizing: boolean
    onStartResize: () => void
    onClose: () => void
    children: ReactNode
}) {
    return (
        <MahaChartsOverlayShell
            testId="mahacharts-right-overlay"
            width={width}
            resizeHandleTestId="mahacharts-right-overlay-resize-handle"
            closeButtonTestId="mahacharts-right-overlay-close"
            eyebrow="Utility Overlay"
            title={title}
            subtitle={subtitle}
            resizing={resizing}
            onStartResize={onStartResize}
            onClose={onClose}
        >
            {children}
        </MahaChartsOverlayShell>
    )
}

function MahaChartsEditorOverlay({
    width,
    autosaveState,
    draftName,
    versionLabel,
    resizing,
    onStartResize,
    onClose,
    children,
}: {
    width: number
    autosaveState: 'idle' | 'saving' | 'saved' | 'error'
    draftName: string
    versionLabel: string
    resizing: boolean
    onStartResize: () => void
    onClose: () => void
    children: ReactNode
}) {
    return (
        <MahaChartsOverlayShell
            testId="mahacharts-editor-overlay"
            width={width}
            resizeHandleTestId="mahacharts-editor-resize-handle"
            closeButtonTestId="mahacharts-editor-close"
            eyebrow="Pine Editor Overlay"
            title={draftName}
            subtitle="Editor takes precedence only when opened; otherwise the chart remains dominant."
            resizing={resizing}
            onStartResize={onStartResize}
            onClose={onClose}
            headerActions={(
                <>
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-300">
                        {versionLabel}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${
                        autosaveState === 'saved'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : autosaveState === 'saving'
                                ? 'bg-amber-500/15 text-amber-300'
                                : autosaveState === 'error'
                                    ? 'bg-rose-500/15 text-rose-300'
                                    : 'bg-white/10 text-slate-300'
                    }`}>
                        {autosaveState}
                    </span>
                </>
            )}
        >
            <div className="min-h-0 h-full overflow-hidden">
                {children}
            </div>
        </MahaChartsOverlayShell>
    )
}

function MahaChartsBottomDock({
    dockTab,
    dockExpanded,
    editorOverlayOpen,
    onSelectTab,
    onToggleExpand,
    children,
}: {
    dockTab: DockTab
    dockExpanded: boolean
    editorOverlayOpen: boolean
    onSelectTab: (tab: DockTab) => void
    onToggleExpand: () => void
    children: ReactNode
}) {
    const tabs: Array<{ key: DockTab, label: string, icon: typeof TerminalSquare }> = [
        { key: 'editor', label: 'Pine Editor', icon: TerminalSquare },
        { key: 'tester', label: 'Strategy Tester', icon: BarChart3 },
        { key: 'trades', label: 'Trades', icon: Activity },
        { key: 'orders', label: 'Orders', icon: ShoppingCart },
        { key: 'positions', label: 'Positions', icon: Briefcase },
        { key: 'logs', label: 'Logs', icon: ListChecks },
        { key: 'trading', label: 'Trading Panel', icon: ShoppingCart },
    ]

    return (
        <section data-testid="mahacharts-dock" className={`border-t border-white/10 bg-[#0c1017]/98 transition-all duration-200 ${dockExpanded ? 'h-[336px]' : 'h-[58px]'}`}>
            <div data-testid="mahacharts-dock-tabs" className="flex h-[58px] flex-wrap items-center gap-2 px-4">
                {tabs.map((tab) => {
                    const Icon = tab.icon
                    const isActive = tab.key === 'editor'
                        ? editorOverlayOpen
                        : dockExpanded && dockTab === tab.key

                    return (
                        <button
                            key={tab.key}
                            data-testid={`mahacharts-dock-tab-${tab.key}`}
                            onClick={() => onSelectTab(tab.key)}
                            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${isActive ? 'bg-white text-slate-900' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}
                        >
                            <Icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    )
                })}
                <button onClick={onToggleExpand} className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:bg-white/[0.05] hover:text-white">
                    {dockExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                </button>
            </div>
            {dockExpanded ? (
                <div data-testid="mahacharts-dock-panel" className="h-[calc(100%-58px)] overflow-y-auto border-t border-white/10">
                    {children}
                </div>
            ) : null}
        </section>
    )
}

function SelectPill({
    label,
    value,
    onChange,
    options,
}: {
    label: string
    value: string
    onChange: (value: string) => void
    options: Array<{ value: string, label: string }>
}) {
    return (
        <label className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-300">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</span>
            <div className="relative">
                <select value={value} onChange={(event) => onChange(event.target.value)} className="appearance-none bg-transparent pr-6 text-sm font-semibold text-white outline-none">
                    {options.map((option) => (
                        <option key={option.value} value={option.value} className="bg-[#11141B] text-white">
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>
        </label>
    )
}

function ToolbarButton({ label, onClick, icon, tone = 'neutral' }: { label: string, onClick: () => void, icon: ReactNode, tone?: 'neutral' | 'positive' }) {
    return (
        <button
            onClick={onClick}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${tone === 'positive' ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'}`}
        >
            {icon}
            {label}
        </button>
    )
}

function IconToolbarButton({ label, onClick, icon }: { label: string, onClick: () => void, icon: ReactNode }) {
    return (
        <button
            aria-label={label}
            title={label}
            onClick={onClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-300 transition hover:bg-white/[0.07] hover:text-white"
        >
            {icon}
        </button>
    )
}

function MetricCard({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'positive' | 'negative' }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</div>
            <div className={`mt-2 text-2xl font-black tracking-tight ${tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-white'}`}>{value}</div>
        </div>
    )
}

function PanelCard({ title, children }: { title: string, children: ReactNode }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">{title}</div>
            <div className="mt-3">{children}</div>
        </div>
    )
}

function StatusMetric({ label, value, tone = 'neutral' }: { label: string, value: string, tone?: 'neutral' | 'positive' | 'warning' }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
            <div className={`mt-2 text-sm font-semibold ${tone === 'positive' ? 'text-emerald-300' : tone === 'warning' ? 'text-amber-300' : 'text-white'}`}>{value}</div>
        </div>
    )
}

function EmptyState({ title, description }: { title: string, description: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-500">
                <LayoutTemplate className="h-5 w-5" />
            </div>
            <div className="mt-4 text-base font-bold text-white">{title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-400">{description}</div>
        </div>
    )
}

function IndicatorsStrategiesModal({
    open,
    tab,
    query,
    setQuery,
    onClose,
    onSelectTab,
    indicators,
    profiles,
    patterns,
    favoriteIndicatorIds,
    activeIndicatorIds,
    strategyLibrary,
    onToggleIndicator,
    onToggleFavoriteIndicator,
    onSelectStrategy,
}: {
    open: boolean
    tab: IndicatorModalTab
    query: string
    setQuery: (value: string) => void
    onClose: () => void
    onSelectTab: (tab: IndicatorModalTab) => void
    indicators: IndicatorCatalogItem[]
    profiles: IndicatorCatalogItem[]
    patterns: IndicatorCatalogItem[]
    favoriteIndicatorIds: string[]
    activeIndicatorIds: string[]
    strategyLibrary: StrategyLibraryDocument[]
    onToggleIndicator: (indicatorId: string) => void
    onToggleFavoriteIndicator: (indicatorId: string) => void
    onSelectStrategy: (strategyId: string) => void
}) {
    if (!open) {
        return null
    }

    const normalizedQuery = query.trim().toLowerCase()
    const filteredIndicators = indicators.filter((item) => (
        !normalizedQuery
        || item.name.toLowerCase().includes(normalizedQuery)
        || item.description.toLowerCase().includes(normalizedQuery)
        || item.category.toLowerCase().includes(normalizedQuery)
    ))
    const filteredProfiles = profiles.filter((item) => (
        !normalizedQuery
        || item.name.toLowerCase().includes(normalizedQuery)
        || item.description.toLowerCase().includes(normalizedQuery)
    ))
    const filteredPatterns = patterns.filter((item) => (
        !normalizedQuery
        || item.name.toLowerCase().includes(normalizedQuery)
        || item.description.toLowerCase().includes(normalizedQuery)
    ))
    const filteredStrategies = strategyLibrary.filter((strategy) => (
        !normalizedQuery
        || strategy.name.toLowerCase().includes(normalizedQuery)
        || (strategy.description || '').toLowerCase().includes(normalizedQuery)
        || strategy.symbol.toLowerCase().includes(normalizedQuery)
    ))

    return (
        <div data-testid="mahacharts-indicators-modal" className="absolute inset-0 z-[120] flex items-start justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-[1320px] flex-col overflow-hidden rounded-[34px] border border-white/10 bg-[#171b22] shadow-[0_40px_140px_rgba(0,0,0,0.65)]">
                <div className="flex items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
                    <div>
                        <div className="text-3xl font-black tracking-tight text-white">Indicators, metrics, and strategies</div>
                        <div className="mt-2 text-sm text-slate-400">Built-ins, favorites, profiles, patterns, and your saved strategy library now live directly inside MahaCharts.</div>
                    </div>
                    <button
                        data-testid="mahacharts-indicators-close"
                        aria-label="Close indicators modal"
                        onClick={onClose}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="border-b border-white/10 px-6 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex min-w-[280px] flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-[#0f141d] px-4 py-3">
                            <Search className="h-5 w-5 text-slate-400" />
                            <input
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Search"
                                className="w-full bg-transparent text-lg text-white outline-none placeholder:text-slate-500"
                            />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {([
                                ['indicators', 'Indicators'],
                                ['strategies', 'Strategies'],
                                ['profiles', 'Profiles'],
                                ['patterns', 'Patterns'],
                            ] as Array<[IndicatorModalTab, string]>).map(([tabValue, label]) => (
                                <button
                                    key={tabValue}
                                    onClick={() => onSelectTab(tabValue)}
                                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === tabValue ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300 hover:bg-white/15 hover:text-white'}`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <aside className="border-r border-white/10 bg-[#12161d] p-6">
                        {tab === 'indicators' ? (
                            <div className="space-y-8">
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Personal</div>
                                    <div className="mt-4 space-y-2">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">Favorites</div>
                                    </div>
                                </div>
                                <div>
                                    <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Built-in</div>
                                    <div className="mt-4 space-y-2">
                                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">Technicals</div>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {tab === 'strategies' ? (
                            <div className="space-y-8">
                                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Personal</div>
                                <div className="mt-4 space-y-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">My Strategies</div>
                                </div>
                            </div>
                        ) : null}

                        {tab === 'profiles' ? (
                            <div className="space-y-8">
                                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Built-in</div>
                                <div className="mt-4 space-y-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">Profiles</div>
                                </div>
                            </div>
                        ) : null}

                        {tab === 'patterns' ? (
                            <div className="space-y-8">
                                <div className="text-[11px] font-black uppercase tracking-[0.22em] text-slate-500">Built-in</div>
                                <div className="mt-4 space-y-2">
                                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white">Patterns</div>
                                </div>
                            </div>
                        ) : null}
                    </aside>

                    <div className="min-h-0 overflow-y-auto p-6">
                        {tab === 'indicators' ? (
                            <div className="space-y-3">
                                {filteredIndicators.map((item) => {
                                    const active = activeIndicatorIds.includes(item.id)
                                    const favorite = favoriteIndicatorIds.includes(item.id)

                                    return (
                                        <div key={item.id} data-testid={`mahacharts-indicator-row-${item.id}`} className={`flex items-center justify-between gap-4 rounded-2xl border px-4 py-4 transition ${active ? 'border-blue-500/30 bg-blue-500/10' : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.05]'}`}>
                                            <div className="min-w-0">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <button
                                                        onClick={() => onToggleFavoriteIndicator(item.id)}
                                                        className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border transition ${favorite ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-white'}`}
                                                    >
                                                        <Star className={`h-4 w-4 ${favorite ? 'fill-current' : ''}`} />
                                                    </button>
                                                    <span className="text-lg font-semibold text-white">{item.name}</span>
                                                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">{item.category}</span>
                                                </div>
                                                <div className="mt-2 text-sm text-slate-400">{item.description}</div>
                                            </div>
                                            <button
                                                onClick={() => onToggleIndicator(item.id)}
                                                className={`shrink-0 rounded-2xl px-4 py-2 text-sm font-semibold transition ${active ? 'bg-white text-slate-900' : 'bg-white/10 text-white hover:bg-white/15'}`}
                                            >
                                                {active ? 'Remove' : 'Add'}
                                            </button>
                                        </div>
                                    )
                                })}
                            </div>
                        ) : null}

                        {tab === 'strategies' ? (
                            <div className="space-y-3">
                                {filteredStrategies.length ? filteredStrategies.map((strategy) => (
                                    <div key={strategy.id} data-testid={`mahacharts-strategy-row-${strategy.id}`} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="min-w-0">
                                                <div className="text-lg font-semibold text-white">{strategy.name}</div>
                                                <div className="mt-1 text-sm text-slate-400">{strategy.symbol} • {strategy.timeframe} • {strategy.versions.length} versions</div>
                                                <div className="mt-2 text-sm text-slate-500">{strategy.description || 'No description yet.'}</div>
                                            </div>
                                            <button
                                                onClick={() => onSelectStrategy(strategy.id)}
                                                className="shrink-0 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
                                            >
                                                Attach
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <EmptyState title="No saved strategies" description="Save a workspace or create an immutable version and it will appear here for one-click chart attachment." />
                                )}
                            </div>
                        ) : null}

                        {tab === 'profiles' ? (
                            <div className="space-y-3">
                                {filteredProfiles.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                                        <div className="text-lg font-semibold text-white">{item.name}</div>
                                        <div className="mt-2 text-sm text-slate-400">{item.description}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}

                        {tab === 'patterns' ? (
                            <div className="space-y-3">
                                {filteredPatterns.map((item) => (
                                    <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4">
                                        <div className="text-lg font-semibold text-white">{item.name}</div>
                                        <div className="mt-2 text-sm text-slate-400">{item.description}</div>
                                    </div>
                                ))}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    )
}
