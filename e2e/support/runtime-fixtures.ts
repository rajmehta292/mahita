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
    let cycleCount = 0
    let activeCycleId: string | null = null
    let parityRepaired = false
    let failedJobsRequeued = false

    const parityExceptions = () => parityRepaired
        ? []
        : [
            {
                vaultName: 'schwab',
                symbol: 'MSFT',
                timeframe: '1m',
                reason: 'missing-inventory-row',
                vaultBarCount: 390,
                vaultLastBar: '2026-03-15T12:00:00.000Z',
                inventoryLastBar: null,
                inventoryLastSynced: null,
            },
        ]

    const processorJobs = () => [
        {
            id: 'processor_job_aapl',
            laneKind: 'DOW30_REALTIME',
            symbol: 'AAPL',
            requestedTimeframe: '30s',
            storageTimeframe: '1m',
            provider: 'schwab',
            status: 'COMPLETED',
            updatedAt: '2026-03-15T12:00:00.000Z',
            lastError: null,
            resultSummary: JSON.stringify({ persistedBars: 390, healthScore: 100, targetCoveragePercent: 100 }),
            provenanceStatus: 'native-cached',
            verificationStatus: 'same-source-verified',
            vaultName: 'schwab',
        },
        {
            id: 'processor_job_msft',
            laneKind: 'SELECTED_ALL_1M',
            symbol: 'MSFT',
            requestedTimeframe: '1m',
            storageTimeframe: '1m',
            provider: 'yahoo',
            status: failedJobsRequeued ? 'QUEUED' : 'FAILED',
            updatedAt: '2026-03-15T12:02:00.000Z',
            lastError: failedJobsRequeued ? null : 'NO_BARS_RETURNED for MSFT 1m from yahoo.',
            resultSummary: null,
            provenanceStatus: failedJobsRequeued ? 'pending' : 'stale',
            verificationStatus: 'stale',
            vaultName: 'yahoo',
        },
    ]

    const processorLogs = () => {
        const logs = [
            {
                id: 'processor_log_queued',
                stage: 'queued',
                message: 'Queued AAPL 30s for DOW30_REALTIME.',
                provider: 'schwab',
                symbol: 'AAPL',
                requestedTimeframe: '30s',
                storageTimeframe: '1m',
                metadata: JSON.stringify({
                    cycleId: activeCycleId ?? 'fixture-cycle-0',
                    laneReason: 'DOW30',
                    symbolSource: 'DOW30',
                    providerDecision: {
                        preferredProvider: 'schwab',
                        queuedProvider: 'schwab',
                    },
                    budgetDecision: 'dispatch-time-budget-check',
                    storageTarget: 'schwab',
                }),
                createdAt: '2026-03-15T12:00:00.000Z',
            },
            {
                id: 'processor_log_persist',
                stage: 'persist',
                message: 'Saved bars to vault.',
                provider: 'schwab',
                symbol: 'AAPL',
                requestedTimeframe: '30s',
                storageTimeframe: '1m',
                metadata: JSON.stringify({
                    cycleId: activeCycleId ?? 'fixture-cycle-0',
                    laneReason: 'DOW30',
                    symbolSource: 'DOW30',
                    providerDecision: {
                        preferredProvider: 'schwab',
                        queuedProvider: 'schwab',
                    },
                    summary: {
                        persistedBars: 390,
                        fetchedBars: 390,
                    },
                    storageTarget: 'schwab',
                }),
                createdAt: '2026-03-15T12:00:01.000Z',
            },
        ]

        if (!failedJobsRequeued) {
            logs.push({
                id: 'processor_log_failed',
                stage: 'blocked',
                message: 'Skipped MSFT queueing because no runtime provider was available.',
                provider: 'yahoo',
                symbol: 'MSFT',
                requestedTimeframe: '1m',
                storageTimeframe: '1m',
                metadata: JSON.stringify({
                    cycleId: activeCycleId ?? 'fixture-cycle-0',
                    laneReason: 'ALL_ENABLED',
                    symbolSource: 'ALL_ENABLED',
                    blockedReason: 'No Stage 2 runtime provider is currently available.',
                }),
                createdAt: '2026-03-15T12:00:02.000Z',
            })
        }

        return logs
    }

    const schedulerPayload = () => {
        const exceptions = parityExceptions()
        const lastCycleId = activeCycleId ?? (running ? 'fixture-cycle-live' : null)

        return {
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
                            note: 'Primary runtime feed',
                            usedLastMinute: running ? 14 : 8,
                            errorCountLastMinute: 0,
                            retryCountLastMinute: 0,
                            throttledSymbols: [],
                            lastError: null,
                            remainingCalls: running ? 106 : 112,
                        },
                        {
                            provider: 'yahoo',
                            maxCallsPerMinute: 20,
                            enabled: true,
                            runtimeAvailable: true,
                            note: 'Fallback and verification feed',
                            usedLastMinute: running ? 3 : 1,
                            errorCountLastMinute: failedJobsRequeued ? 0 : 1,
                            retryCountLastMinute: 0,
                            throttledSymbols: [],
                            lastError: failedJobsRequeued ? null : 'NO_BARS_RETURNED for MSFT 1m from yahoo.',
                            remainingCalls: running ? 17 : 19,
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
                        id: 'lane_dow30',
                        kind: 'DOW30_REALTIME',
                        enabled: true,
                        priorityOrder: 10,
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
                    {
                        id: 'lane_all_enabled',
                        kind: 'SELECTED_ALL_1M',
                        enabled: true,
                        priorityOrder: 40,
                        weight: 0.5,
                        reservedCallsPerMinute: null,
                        minCallsPerMinute: null,
                        targetRefreshSeconds: 60,
                        providerPreference: 'yahoo',
                        canonicalIntervals: ['1m'],
                        queued: failedJobsRequeued ? 1 : 0,
                        running: 0,
                        completed: 1,
                        failed: failedJobsRequeued ? 0 : 1,
                    },
                ],
                targets: [
                    {
                        id: 'target_dow30',
                        name: 'Dow 30',
                        preset: 'DOW30',
                        enabled: true,
                        providerPreference: 'schwab',
                        canonicalIntervals: ['1m', '1h', '1w'],
                        symbolCount: 2,
                        previewSymbols: ['AAPL', 'MSFT'],
                        symbols: [
                            { id: 'target_symbol_aapl', symbol: 'AAPL', enabled: true, canonicalIntervals: ['1m', '1h', '1w'] },
                            { id: 'target_symbol_msft', symbol: 'MSFT', enabled: true, canonicalIntervals: ['1m', '1h', '1w'] },
                        ],
                    },
                    {
                        id: 'target_all_enabled',
                        name: 'All enabled 1m',
                        preset: 'ALL_ENABLED',
                        enabled: true,
                        providerPreference: 'yahoo',
                        canonicalIntervals: ['1m'],
                        symbolCount: 2,
                        previewSymbols: ['AAPL', 'MSFT'],
                        symbols: [
                            { id: 'target_all_aapl', symbol: 'AAPL', enabled: true, canonicalIntervals: ['1m'] },
                            { id: 'target_all_msft', symbol: 'MSFT', enabled: true, canonicalIntervals: ['1m'] },
                        ],
                    },
                ],
                availableUniverseSymbols: ['AAPL', 'MSFT', 'CRM', 'WMT', 'NVDA'],
                viewDemands: [
                    {
                        id: 'view_demand_aapl',
                        surface: 'superchart',
                        symbol: 'AAPL',
                        timeframe: '1m',
                        priorityScore: 90,
                        refreshIntervalSeconds: 13,
                        lastSeenAt: '2026-03-15T12:00:00.000Z',
                        expiresAt: '2026-03-15T12:02:00.000Z',
                    },
                ],
                runtime: {
                    desiredState: {
                        shouldRun: true,
                        profileStatus: 'ACTIVE',
                        isDefault: true,
                    },
                    actualRuntimeState: {
                        running,
                        currentPhase: running ? 'running cycle' : 'idle',
                        intervalMs: 13000,
                        providerOverride: null,
                        schedulerEnabled: true,
                        lastError: failedJobsRequeued ? null : 'One fallback lane was blocked in the previous cycle.',
                        cycleCount,
                    },
                    continuousIngest: {
                        running,
                        currentPhase: running ? 'running cycle' : 'idle',
                        intervalMs: 13000,
                        schedulerEnabled: true,
                        lastCycleSummary: lastCycleId
                            ? {
                                cycleId: lastCycleId,
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
                        totalQueued: failedJobsRequeued ? 1 : running ? 1 : 0,
                        totalRunning: running ? 1 : 0,
                        totalFailed: failedJobsRequeued ? 0 : 1,
                        oldestQueuedAt: failedJobsRequeued || running ? '2026-03-15T12:00:00.000Z' : null,
                    },
                },
                providerReadiness: {
                    allowedRuntimeProviders: ['schwab', 'yahoo'],
                    experimentalProviders: ['google', 'alphavantage'],
                    availability: {
                        schwab: true,
                        yahoo: true,
                    },
                    tokenHealth: {
                        isValid: true,
                    },
                },
                inventoryParity: {
                    generatedAt: '2026-03-15T12:03:00.000Z',
                    summary: {
                        totalVaultKeys: 4,
                        totalInventoryKeys: parityRepaired ? 4 : 3,
                        missingInventoryRows: parityRepaired ? 0 : 1,
                        staleInventoryRows: parityRepaired ? 0 : 1,
                    },
                    byVault: [
                        {
                            vaultName: 'schwab',
                            totalVaultKeys: 2,
                            totalInventoryKeys: parityRepaired ? 2 : 1,
                            missingInventoryRows: parityRepaired ? 0 : 1,
                            staleInventoryRows: 0,
                        },
                        {
                            vaultName: 'yahoo',
                            totalVaultKeys: 2,
                            totalInventoryKeys: 2,
                            missingInventoryRows: 0,
                            staleInventoryRows: parityRepaired ? 0 : 1,
                        },
                    ],
                    exceptions,
                },
                planPreview: [
                    {
                        laneKind: 'DOW30_REALTIME',
                        symbolSource: 'DOW30',
                        queueDepthTarget: 30,
                        existingQueued: running ? 1 : 0,
                        requestedTimeframe: '30s',
                        storageTimeframe: '1m',
                        preferredProvider: 'schwab',
                        chosenProvider: 'schwab',
                        reason: 'Queue symbols from the Dow 30 realtime target.',
                        blockedReason: null,
                        previewSymbols: ['AAPL', 'MSFT', 'CRM'],
                    },
                    {
                        laneKind: 'SELECTED_ALL_1M',
                        symbolSource: 'ALL_ENABLED',
                        queueDepthTarget: 60,
                        existingQueued: failedJobsRequeued ? 1 : 0,
                        requestedTimeframe: '1m',
                        storageTimeframe: '1m',
                        preferredProvider: 'yahoo',
                        chosenProvider: failedJobsRequeued ? 'yahoo' : null,
                        reason: 'Backfill remaining enabled one-minute symbols after realtime pressure is satisfied.',
                        blockedReason: failedJobsRequeued ? null : 'No Stage 2 runtime provider is currently available.',
                        previewSymbols: ['MSFT', 'WMT'],
                    },
                ],
                recentJobs: processorJobs().map((job) => ({
                    id: job.id,
                    laneKind: job.laneKind,
                    symbol: job.symbol,
                    requestedTimeframe: job.requestedTimeframe,
                    storageTimeframe: job.storageTimeframe,
                    provider: job.provider,
                    status: job.status,
                    updatedAt: job.updatedAt,
                    scheduledFor: '2026-03-15T12:00:00.000Z',
                    lastError: job.lastError,
                    provenanceStatus: job.provenanceStatus,
                    verificationStatus: job.verificationStatus,
                })),
                recentDispatchLogs: processorLogs().map((log) => ({
                    id: log.id,
                    stage: log.stage,
                    message: log.message,
                    provider: log.provider,
                    symbol: log.symbol,
                    requestedTimeframe: log.requestedTimeframe,
                    storageTimeframe: log.storageTimeframe,
                    createdAt: log.createdAt,
                    metadata: log.metadata,
                })),
                lastCycleTrace: {
                    cycleId: lastCycleId,
                    logs: processorLogs().map((log) => ({
                        id: log.id,
                        stage: log.stage,
                        message: log.message,
                        provider: log.provider,
                        symbol: log.symbol,
                        requestedTimeframe: log.requestedTimeframe,
                        storageTimeframe: log.storageTimeframe,
                        createdAt: log.createdAt,
                        metadata: log.metadata ? JSON.parse(log.metadata) : null,
                    })),
                },
                verificationSummary: {
                    queued: 0,
                    running: 0,
                    completed: 3,
                    failed: 0,
                },
            },
        }
    }

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
        if (body.action === 'run-one-cycle') {
            running = true
            cycleCount += 1
            activeCycleId = `fixture-cycle-${cycleCount}`
        }
        if (body.action === 'repair-inventory') {
            parityRepaired = true
        }
        if (body.action === 'requeue-failed') {
            failedJobsRequeued = true
        }
        if (body.action === 'refresh-inventory' && !activeCycleId) {
            activeCycleId = 'fixture-cycle-refresh'
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
                        callsPerMinute: running ? 14 : 8,
                        errorCount: 0,
                        retryCount: 0,
                        throttledSymbols: [],
                        lastError: null,
                    },
                    {
                        provider: 'yahoo',
                        callsPerMinute: running ? 3 : 1,
                        errorCount: failedJobsRequeued ? 0 : 1,
                        retryCount: 0,
                        throttledSymbols: [],
                        lastError: failedJobsRequeued ? null : 'NO_BARS_RETURNED for MSFT 1m from yahoo.',
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
                        message: 'Fetched AAPL snapshot.',
                    },
                    {
                        id: 'caller_event_2',
                        timestamp: '2026-03-15T12:01:00.000Z',
                        kind: 'control',
                        provider: 'schwab',
                        symbol: 'AAPL',
                        timeframe: '1m',
                        message: activeCycleId ? `Completed ${activeCycleId}.` : 'Scheduler ready.',
                    },
                ],
            })
        )
    })

    await context.route('**/api/admin/di-ui/caller/stream', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'text/event-stream',
            body: 'event: snapshot\\ndata: {"events":[{"id":"caller_stream_1","timestamp":"2026-03-15T12:00:00.000Z","kind":"request","provider":"schwab","symbol":"AAPL","timeframe":"1m","message":"Stream ready"}]}\\n\\n',
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
                jobs: processorJobs(),
                logs: processorLogs(),
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
        const exceptions = parityExceptions()
        await route.fulfill(
            json({
                vaults: [
                    { id: 'vault_schwab', name: 'schwab', type: 'SQLITE', isEnabled: true },
                    { id: 'vault_yahoo', name: 'yahoo', type: 'SQLITE', isEnabled: true },
                ],
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
                    {
                        id: 'inventory_2',
                        symbol: 'MSFT',
                        timeframe: '1m',
                        healthScore: parityRepaired ? 96 : 72,
                        gapCount: parityRepaired ? 0 : 2,
                        barCount: 380,
                        storageClass: 'native-cached',
                        canonicalInterval: '1m',
                        verificationStatus: parityRepaired ? 'same-source-verified' : 'stale',
                        verificationMethod: 'fixture',
                        lastVerifiedAt: '2026-03-15T12:00:00.000Z',
                        vault: { name: 'yahoo', type: 'SQLITE', isEnabled: true },
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
                parity: {
                    generatedAt: '2026-03-15T12:03:00.000Z',
                    summary: {
                        totalVaultKeys: 4,
                        totalInventoryKeys: parityRepaired ? 4 : 3,
                        missingInventoryRows: parityRepaired ? 0 : 1,
                        staleInventoryRows: parityRepaired ? 0 : 1,
                    },
                    exceptions,
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
