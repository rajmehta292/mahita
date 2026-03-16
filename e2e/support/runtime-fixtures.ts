import type { BrowserContext } from '@playwright/test'

interface UserPreferencesFixture {
    selectedAccountId: string | null
    watchlistSymbols: string | null
    viewRefreshIntervalSeconds: number
}

const defaultPreferences: UserPreferencesFixture = {
    selectedAccountId: null,
    watchlistSymbols: JSON.stringify(['AAPL', 'MSFT']),
    viewRefreshIntervalSeconds: 13,
}

function json(body: unknown, status = 200) {
    return {
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
    }
}

export async function installScreenerFixtures(context: BrowserContext) {
    let preferences = { ...defaultPreferences }

    await context.route('**/api/user/preferences', async (route) => {
        if (route.request().method() === 'PATCH') {
            const patch = (await route.request().postDataJSON()) as Partial<UserPreferencesFixture>
            preferences = { ...preferences, ...patch }
        }

        await route.fulfill(
            json({
                success: true,
                preferences,
            })
        )
    })

    await context.route('**/api/screener/config', async (route) => {
        await route.fulfill(
            json({
                success: true,
                groupTabs: [
                    { key: 'descriptive', label: 'Descriptive' },
                    { key: 'technical', label: 'Technical' },
                    { key: 'all', label: 'All' },
                ],
                resultTabs: [
                    {
                        key: 'overview',
                        label: 'Overview',
                        columns: [
                            { key: 'symbol', label: 'Symbol' },
                            { key: 'name', label: 'Name' },
                            { key: 'price', label: 'Price', align: 'right', format: 'price' },
                            { key: 'changePercent', label: 'Change %', align: 'right', format: 'percent' },
                            { key: 'volume', label: 'Volume', align: 'right', format: 'volume' },
                        ],
                    },
                ],
                fields: [
                    {
                        key: 'sector',
                        label: 'Sector',
                        group: 'descriptive',
                        valueType: 'enum',
                        assetScope: 'equity',
                        options: [
                            { value: 'any', label: 'Any' },
                            { value: 'technology', label: 'Technology' },
                        ],
                    },
                ],
                builtInPresets: [
                    {
                        name: 'All Stocks',
                        groupTab: 'descriptive',
                        resultTab: 'overview',
                        orderKey: 'symbol',
                        orderDirection: 'asc',
                        signal: 'none',
                        filters: [],
                    },
                    {
                        name: 'Dow 30',
                        groupTab: 'descriptive',
                        resultTab: 'overview',
                        orderKey: 'symbol',
                        orderDirection: 'asc',
                        signal: 'none',
                        filters: [{ field: 'index', value: 'dow30' }],
                    },
                ],
                userPresets: [],
                orderOptions: [
                    { value: 'symbol', label: 'Symbol' },
                    { value: 'price', label: 'Price' },
                ],
                signals: [
                    { value: 'none', label: 'All signals' },
                    { value: 'breakout', label: 'Breakout' },
                ],
            })
        )
    })

    await context.route('**/api/screener/query', async (route) => {
        const request = (await route.request().postDataJSON()) as { filters?: Array<{ field: string; value: string }> }
        const isDow30 = request.filters?.some((filter) => filter.field === 'index' && filter.value === 'dow30') ?? false
        const rows = [
            {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                assetType: 'equity',
                exchange: 'NASDAQ',
                sector: 'Technology',
                industry: 'Consumer Electronics',
                country: 'United States',
                isEtf: false,
                sponsor: null,
                price: 214.5,
                changePercent: 1.12,
                volume: 1250000,
                marketCap: 3200000000000,
                updatedAt: '2026-03-15T12:00:00.000Z',
                descriptive: {},
                fundamental: {},
                technical: {},
                news: {},
                etf: {},
            },
            {
                symbol: 'MSFT',
                name: 'Microsoft Corp.',
                assetType: 'equity',
                exchange: 'NASDAQ',
                sector: 'Technology',
                industry: 'Software',
                country: 'United States',
                isEtf: false,
                sponsor: null,
                price: 428.32,
                changePercent: 0.64,
                volume: 980000,
                marketCap: 3100000000000,
                updatedAt: '2026-03-15T12:00:00.000Z',
                descriptive: {},
                fundamental: {},
                technical: {},
                news: {},
                etf: {},
            },
        ]

        const filteredRows = isDow30 ? rows.filter((row) => row.symbol !== 'MSFT') : rows

        await route.fulfill(
            json({
                success: true,
                rows: filteredRows,
                totalCount: filteredRows.length,
                page: 1,
                pageSize: 20,
                freshness: {
                    asOf: '2026-03-15T12:00:00.000Z',
                    source: 'playwright-fixture',
                    universeSize: 30,
                },
            })
        )
    })

    await context.route('**/api/search/global**', async (route) => {
        const url = new URL(route.request().url())
        const query = (url.searchParams.get('q') ?? '').toUpperCase()
        const results = query === 'MSFT'
            ? [{ id: 'instrument:MSFT', group: 'instruments', title: 'MSFT', subtitle: 'Microsoft Corp.', href: '/chart?symbol=MSFT&timeframe=1d', symbol: 'MSFT', score: 120, badge: 'Equity' }]
            : [{ id: 'instrument:AAPL', group: 'instruments', title: 'AAPL', subtitle: 'Apple Inc.', href: '/chart?symbol=AAPL&timeframe=1d', symbol: 'AAPL', score: 120, badge: 'Equity' }]

        await route.fulfill(
            json({
                success: true,
                groups: [
                    {
                        key: 'instruments',
                        label: 'Instruments',
                        results,
                    },
                ],
            })
        )
    })
}

export async function installDiUiFixtures(context: BrowserContext) {
    let running = false

    const schedulerPayload = () => ({
        runtimeHealth: {
            ok: true,
            runtime: {
                prismaClientReady: true,
                missingPrismaModels: [],
                diUiPrismaClientReady: true,
                missingDiUiPrismaModels: [],
                hasDedicatedAppSecretKey: true,
                platformData: {
                    canonicalBarSource: 'vault-sqlite',
                    parquetRouteStatus: 'ready',
                    inventoryAuthority: 'main-prisma-db',
                },
            },
        },
        scheduler: {
            profile: {
                id: 'profile_primary',
                name: 'primary',
                label: 'Primary Runtime Profile',
                description: 'Fixture profile',
                status: 'ACTIVE',
                providerBudgets: [
                    {
                        provider: 'schwab',
                        maxCallsPerMinute: 120,
                        enabled: true,
                        runtimeAvailable: true,
                        note: 'Fixture budget',
                        usedLastMinute: 8,
                        errorCountLastMinute: 0,
                        retryCountLastMinute: 0,
                        throttledSymbols: [],
                        lastError: null,
                        remainingCalls: 112,
                    },
                ],
            },
            availableProfiles: [
                {
                    id: 'profile_primary',
                    name: 'primary',
                    label: 'Primary Runtime Profile',
                    status: 'ACTIVE',
                    isDefault: true,
                },
            ],
            lanes: [
                {
                    id: 'lane_realtime',
                    kind: 'REALTIME',
                    enabled: true,
                    priorityOrder: 1,
                    weight: 1.2,
                    reservedCallsPerMinute: 30,
                    minCallsPerMinute: 10,
                    targetRefreshSeconds: 13,
                    providerPreference: 'schwab',
                    canonicalIntervals: ['1m'],
                    queued: running ? 1 : 0,
                    running: running ? 1 : 0,
                    completed: 4,
                    failed: 0,
                },
            ],
            targets: [
                {
                    id: 'target_dow30',
                    name: 'Dow 30',
                    preset: 'dow30',
                    enabled: true,
                    providerPreference: 'schwab',
                    canonicalIntervals: ['1m', '1d'],
                    symbolCount: 2,
                    previewSymbols: ['AAPL', 'MSFT'],
                    symbols: [
                        { id: 'target_symbol_aapl', symbol: 'AAPL', enabled: true, canonicalIntervals: ['1m', '1d'] },
                        { id: 'target_symbol_msft', symbol: 'MSFT', enabled: true, canonicalIntervals: ['1m', '1d'] },
                    ],
                },
            ],
            availableUniverseSymbols: ['AAPL', 'MSFT', 'NVDA'],
            viewDemands: [],
            runtime: {
                continuousIngest: {
                    running,
                    currentPhase: running ? 'running cycle' : 'idle',
                    intervalMs: 13000,
                    schedulerEnabled: true,
                    lastCycleSummary: running
                        ? {
                            dispatchedIngestionJobs: 2,
                            dispatchedVerificationJobs: 1,
                            queuePressureMode: 'balanced',
                            afterHoursMode: false,
                        }
                        : null,
                },
                afterHoursMode: false,
                queuePressureMode: 'balanced',
                queueMetrics: {
                    totalQueued: running ? 1 : 0,
                    totalRunning: running ? 1 : 0,
                    totalFailed: 0,
                    oldestQueuedAt: running ? '2026-03-15T12:00:00.000Z' : null,
                },
            },
            recentJobs: [],
            recentDispatchLogs: [],
            verificationSummary: {
                queued: 0,
                running: 0,
                completed: 3,
                failed: 0,
            },
        },
    })

    await context.route('**/api/admin/di-ui/scheduler', async (route) => {
        await route.fulfill(json(schedulerPayload()))
    })

    await context.route('**/api/admin/di-ui/scheduler/action', async (route) => {
        const body = (await route.request().postDataJSON()) as { action?: string }
        if (body.action === 'start-scheduler') {
            running = true
        }
        if (body.action === 'stop-scheduler') {
            running = false
        }

        await route.fulfill(
            json({
                success: true,
                scheduler: schedulerPayload().scheduler,
            })
        )
    })

    await context.route('**/api/admin/di-ui/caller', async (route) => {
        await route.fulfill(
            json({
                metrics: [
                    {
                        provider: 'schwab',
                        callsPerMinute: 8,
                        errorCount: 0,
                        retryCount: 0,
                        throttledSymbols: [],
                        lastError: null,
                    },
                ],
                events: [
                    {
                        id: 'caller_event_1',
                        timestamp: '2026-03-15T12:00:00.000Z',
                        kind: 'request',
                        provider: 'schwab',
                        symbol: 'AAPL',
                        timeframe: '1m',
                        message: 'Fetched AAPL snapshot',
                    },
                ],
            })
        )
    })

    await context.route('**/api/admin/di-ui/caller/stream', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: 'event: snapshot\ndata: {"events":[{"id":"caller_stream_1","timestamp":"2026-03-15T12:00:00.000Z","kind":"request","provider":"schwab","symbol":"AAPL","timeframe":"1m","message":"Stream ready"}]}\n\n',
        })
    })

    await context.route('**/api/admin/di-ui/processor', async (route) => {
        await route.fulfill(
            json({
                runtimeHealth: {
                    ok: true,
                    runtime: {
                        diUiPrismaClientReady: true,
                        missingDiUiPrismaModels: [],
                    },
                },
                jobs: [
                    {
                        id: 'processor_job_1',
                        laneKind: 'REALTIME',
                        symbol: 'AAPL',
                        requestedTimeframe: '1m',
                        storageTimeframe: '1m',
                        provider: 'schwab',
                        status: 'COMPLETED',
                        updatedAt: '2026-03-15T12:00:00.000Z',
                        lastError: null,
                        resultSummary: '{"bars":390}',
                        provenanceStatus: 'native-cached',
                        verificationStatus: 'same-source-verified',
                        vaultName: 'schwab',
                    },
                ],
                logs: [
                    {
                        id: 'processor_log_1',
                        stage: 'persist',
                        message: 'Saved bars to vault',
                        provider: 'schwab',
                        symbol: 'AAPL',
                        requestedTimeframe: '1m',
                        storageTimeframe: '1m',
                        metadata: null,
                        createdAt: '2026-03-15T12:00:00.000Z',
                    },
                ],
            })
        )
    })

    await context.route('**/api/admin/di-ui/verification', async (route) => {
        await route.fulfill(
            json({
                runtimeHealth: {
                    ok: true,
                    runtime: {
                        diUiPrismaClientReady: true,
                        missingDiUiPrismaModels: [],
                    },
                },
                jobs: [
                    {
                        id: 'verification_job_1',
                        laneKind: 'VERIFICATION',
                        mode: 'BOTH',
                        symbol: 'AAPL',
                        timeframe: '1m',
                        sourceProvider: 'schwab',
                        comparisonProvider: 'yahoo',
                        status: 'COMPLETED',
                        scheduledFor: '2026-03-15T12:00:00.000Z',
                        completedAt: '2026-03-15T12:00:01.000Z',
                        lastError: null,
                        resultSummary: '{"verificationStatus":"same-source-verified","verificationMethod":"fixture","barsCompared":120}',
                    },
                ],
                observations: [
                    {
                        id: 'verification_observation_1',
                        verificationJobId: 'verification_job_1',
                        barTime: '2026-03-15T12:00:00.000Z',
                        classification: 'MATCH',
                        decision: 'ACCEPT',
                        primaryProvider: 'schwab',
                        secondaryProvider: 'yahoo',
                        primaryClose: 214.5,
                        secondaryClose: 214.5,
                        priceDiffBps: 0,
                        volumeDiffPct: 0,
                        createdAt: '2026-03-15T12:00:02.000Z',
                    },
                ],
                statusSummary: {
                    COMPLETED: 1,
                    RUNNING: 0,
                },
                classificationSummary: {
                    MATCH: 1,
                },
            })
        )
    })

    await context.route('**/api/admin/di-ui/storage**', async (route) => {
        await route.fulfill(
            json({
                vaults: [{ id: 'vault_schwab', name: 'schwab', type: 'SQLITE', isEnabled: true }],
                inventories: [
                    {
                        id: 'inventory_1',
                        symbol: 'AAPL',
                        timeframe: '1m',
                        healthScore: 100,
                        gapCount: 0,
                        barCount: 390,
                        storageClass: 'native-cached',
                        canonicalInterval: '1m',
                        verificationStatus: 'same-source-verified',
                        verificationMethod: 'fixture',
                        lastVerifiedAt: '2026-03-15T12:00:00.000Z',
                        vault: { name: 'schwab', type: 'SQLITE', isEnabled: true },
                    },
                ],
                bars: {
                    bars: [
                        {
                            id: 'bar_1',
                            time: 1710000000,
                            open: 214,
                            high: 215,
                            low: 213.5,
                            close: 214.5,
                            volume: 10000,
                            source: 'schwab',
                        },
                    ],
                    totalCount: 1,
                },
                filters: {
                    symbol: 'AAPL',
                    timeframe: '1m',
                    vaultName: 'schwab',
                    verificationStatus: null,
                    page: 1,
                    pageSize: 50,
                },
            })
        )
    })
}
