import { expect, test, type Page } from '@playwright/test'

function buildBars(count: number, intervalSeconds: number) {
    const start = 1_710_000_000
    return Array.from({ length: count }, (_, index) => {
        const open = 180 + index * 0.4
        const close = open + (index % 2 === 0 ? 1.2 : -0.3)
        const high = Math.max(open, close) + 0.8
        const low = Math.min(open, close) - 0.6
        return {
            time: start + index * intervalSeconds,
            open,
            high,
            low,
            close,
            volume: 150000 + index * 1200,
        }
    })
}

async function signInWithDevBypass(page: Page) {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })
}

async function mockMahaChartsApis(page: Page) {
    const dailyBars = buildBars(48, 86_400)
    const hourlyBars = buildBars(72, 3_600)

    await page.route('**/api/search/symbols**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: [
                    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', assetType: 'equity', source: 'search' },
                    { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', assetType: 'equity', source: 'search' },
                ],
            }),
        })
    })

    await page.route('**/api/script-editor/scripts', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                drafts: [
                    {
                        id: 'draft-1',
                        name: 'AAPL Momentum',
                        description: 'TradingView-style regression draft',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                        engineMode: 'pinets',
                        linkedFixtureId: 'fixture-aapl-1d',
                        runSettings: null,
                    },
                ],
                defaultTemplate: '//@version=6\nstrategy("Mahita Strategy", overlay=true)',
            }),
        })
    })

    await page.route('**/api/strategies', async (route) => {
        if (route.request().method() === 'POST') {
            const payload = route.request().postDataJSON() as Record<string, unknown>
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    strategy: {
                        id: 'draft-1',
                        name: payload.name ?? 'AAPL Momentum',
                        description: payload.description ?? 'TradingView-style regression draft',
                        symbol: payload.symbol ?? 'AAPL',
                        timeframe: payload.timeframe ?? '1d',
                        language: 'pine-v6',
                        engineMode: 'pinets',
                        favorite: false,
                        pinned: false,
                        latestVersionId: 'version-1',
                        latestVersion: {
                            id: 'version-1',
                            strategyId: 'draft-1',
                            versionNumber: 1,
                            label: 'Initial version',
                            description: 'TradingView-style regression draft',
                            symbol: payload.symbol ?? 'AAPL',
                            timeframe: payload.timeframe ?? '1d',
                            source: payload.source ?? '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: payload.linkedFixtureId ?? 'fixture-aapl-1d',
                            runSettings: payload.runSettings ?? null,
                            sourceHash: 'hash-1',
                            createdAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        versions: [
                            {
                                id: 'version-1',
                                strategyId: 'draft-1',
                                versionNumber: 1,
                                label: 'Initial version',
                                description: 'TradingView-style regression draft',
                                symbol: payload.symbol ?? 'AAPL',
                                timeframe: payload.timeframe ?? '1d',
                                source: payload.source ?? '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                                language: 'pine-v6',
                                engineMode: 'pinets',
                                linkedFixtureId: payload.linkedFixtureId ?? 'fixture-aapl-1d',
                                runSettings: payload.runSettings ?? null,
                                sourceHash: 'hash-1',
                                createdAt: '2026-03-14T16:00:00.000Z',
                                updatedAt: '2026-03-14T16:00:00.000Z',
                            },
                        ],
                        workspaceSession: {
                            id: 'workspace-1',
                            strategyId: 'draft-1',
                            baseVersionId: 'version-1',
                            symbol: payload.symbol ?? 'AAPL',
                            timeframe: payload.timeframe ?? '1d',
                            source: payload.source ?? '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: payload.linkedFixtureId ?? 'fixture-aapl-1d',
                            runSettings: payload.runSettings ?? null,
                            autosaveRevision: 1,
                            lastOpenedAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        updatedAt: '2026-03-14T16:00:00.000Z',
                    },
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                strategies: [
                    {
                        id: 'draft-1',
                        name: 'AAPL Momentum',
                        description: 'TradingView-style regression draft',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        language: 'pine-v6',
                        engineMode: 'pinets',
                        favorite: false,
                        pinned: true,
                        latestVersionId: 'version-2',
                        latestVersion: {
                            id: 'version-2',
                            strategyId: 'draft-1',
                            versionNumber: 2,
                            label: 'v2',
                            description: 'TradingView-style regression draft',
                            symbol: 'AAPL',
                            timeframe: '1d',
                            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: 'fixture-aapl-1d',
                            runSettings: null,
                            sourceHash: 'hash-2',
                            createdAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        versions: [
                            {
                                id: 'version-2',
                                strategyId: 'draft-1',
                                versionNumber: 2,
                                label: 'v2',
                                description: 'TradingView-style regression draft',
                                symbol: 'AAPL',
                                timeframe: '1d',
                                source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                                language: 'pine-v6',
                                engineMode: 'pinets',
                                linkedFixtureId: 'fixture-aapl-1d',
                                runSettings: null,
                                sourceHash: 'hash-2',
                                createdAt: '2026-03-14T16:00:00.000Z',
                                updatedAt: '2026-03-14T16:00:00.000Z',
                            },
                            {
                                id: 'version-1',
                                strategyId: 'draft-1',
                                versionNumber: 1,
                                label: 'Initial version',
                                description: 'TradingView-style regression draft',
                                symbol: 'AAPL',
                                timeframe: '1d',
                                source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                                language: 'pine-v6',
                                engineMode: 'pinets',
                                linkedFixtureId: 'fixture-aapl-1d',
                                runSettings: null,
                                sourceHash: 'hash-1',
                                createdAt: '2026-03-14T15:00:00.000Z',
                                updatedAt: '2026-03-14T15:00:00.000Z',
                            },
                        ],
                        workspaceSession: {
                            id: 'workspace-1',
                            strategyId: 'draft-1',
                            baseVersionId: 'version-2',
                            symbol: 'AAPL',
                            timeframe: '1d',
                            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: 'fixture-aapl-1d',
                            runSettings: null,
                            autosaveRevision: 3,
                            lastOpenedAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        updatedAt: '2026-03-14T16:00:00.000Z',
                    },
                ],
            }),
        })
    })

    await page.route('**/api/strategies/draft-1', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                strategy: {
                    id: 'draft-1',
                    name: 'AAPL Momentum',
                    description: 'TradingView-style regression draft',
                    symbol: 'AAPL',
                    timeframe: '1d',
                    language: 'pine-v6',
                    engineMode: 'pinets',
                    favorite: false,
                    pinned: true,
                    latestVersionId: 'version-2',
                    latestVersion: {
                        id: 'version-2',
                        strategyId: 'draft-1',
                        versionNumber: 2,
                        label: 'v2',
                        description: 'TradingView-style regression draft',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                        language: 'pine-v6',
                        engineMode: 'pinets',
                        linkedFixtureId: 'fixture-aapl-1d',
                        runSettings: null,
                        sourceHash: 'hash-2',
                        createdAt: '2026-03-14T16:00:00.000Z',
                        updatedAt: '2026-03-14T16:00:00.000Z',
                    },
                    versions: [
                        {
                            id: 'version-2',
                            strategyId: 'draft-1',
                            versionNumber: 2,
                            label: 'v2',
                            description: 'TradingView-style regression draft',
                            symbol: 'AAPL',
                            timeframe: '1d',
                            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: 'fixture-aapl-1d',
                            runSettings: null,
                            sourceHash: 'hash-2',
                            createdAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                    ],
                    workspaceSession: {
                        id: 'workspace-1',
                        strategyId: 'draft-1',
                        baseVersionId: 'version-2',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                        language: 'pine-v6',
                        engineMode: 'pinets',
                        linkedFixtureId: 'fixture-aapl-1d',
                        runSettings: null,
                        autosaveRevision: 3,
                        lastOpenedAt: '2026-03-14T16:00:00.000Z',
                        updatedAt: '2026-03-14T16:00:00.000Z',
                    },
                    updatedAt: '2026-03-14T16:00:00.000Z',
                },
            }),
        })
    })

    await page.route('**/api/strategies/draft-1/workspace', async (route) => {
        if (route.request().method() === 'PATCH') {
            const payload = route.request().postDataJSON() as Record<string, unknown>
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    strategy: {
                        id: 'draft-1',
                        name: payload.name ?? 'AAPL Momentum',
                        description: payload.description ?? 'TradingView-style regression draft',
                        symbol: payload.symbol ?? 'AAPL',
                        timeframe: payload.timeframe ?? '1d',
                        language: 'pine-v6',
                        engineMode: 'pinets',
                        favorite: false,
                        pinned: true,
                        latestVersionId: 'version-2',
                        latestVersion: {
                            id: 'version-2',
                            strategyId: 'draft-1',
                            versionNumber: 2,
                            label: 'v2',
                            description: payload.description ?? 'TradingView-style regression draft',
                            symbol: payload.symbol ?? 'AAPL',
                            timeframe: payload.timeframe ?? '1d',
                            source: payload.source ?? '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: payload.linkedFixtureId ?? 'fixture-aapl-1d',
                            runSettings: payload.runSettings ?? null,
                            sourceHash: 'hash-2',
                            createdAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        versions: [],
                        workspaceSession: {
                            id: 'workspace-1',
                            strategyId: 'draft-1',
                            baseVersionId: 'version-2',
                            symbol: payload.symbol ?? 'AAPL',
                            timeframe: payload.timeframe ?? '1d',
                            source: payload.source ?? '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
                            language: 'pine-v6',
                            engineMode: 'pinets',
                            linkedFixtureId: payload.linkedFixtureId ?? 'fixture-aapl-1d',
                            runSettings: payload.runSettings ?? null,
                            autosaveRevision: 4,
                            lastOpenedAt: '2026-03-14T16:00:00.000Z',
                            updatedAt: '2026-03-14T16:00:00.000Z',
                        },
                        updatedAt: '2026-03-14T16:00:00.000Z',
                    },
                }),
            })
            return
        }

        await route.fallback()
    })

    await page.route('**/api/indicators/catalog', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                favorites: ['volume', 'macd'],
                indicators: [
                    { id: 'volume', name: 'Volume', shortLabel: 'Vol', kind: 'indicator', pane: 'volume', category: 'Technicals', description: 'Displays bar volume.' },
                    { id: 'macd', name: 'Moving Average Convergence Divergence', shortLabel: 'MACD', kind: 'indicator', pane: 'oscillator', category: 'Technicals', description: 'Momentum oscillator.' },
                    { id: 'rsi', name: 'Relative Strength Index', shortLabel: 'RSI', kind: 'indicator', pane: 'oscillator', category: 'Technicals', description: 'Relative strength momentum.' },
                ],
                profiles: [],
                patterns: [],
            }),
        })
    })

    await page.route('**/api/script-editor/fixtures', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                fixtures: [
                    {
                        id: 'fixture-aapl-1d',
                        fixtureKey: 'fixture-aapl-1d',
                        name: 'TradingView AAPL 1d Fixture',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        source: 'tradingview-fixture',
                        status: 'verified-fixture-replay',
                        manifest: {
                            candleWindow: {
                                firstBarTime: dailyBars[0].time,
                                lastBarTime: dailyBars[dailyBars.length - 1].time,
                            },
                        },
                    },
                ],
            }),
        })
    })

    await page.route('**/api/trading/deployments', async (route) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 201,
                contentType: 'application/json',
                body: JSON.stringify({
                    deployment: {
                        id: 'deployment-1',
                        name: 'AAPL Live Deployment',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        target: 'paper',
                        status: 'active',
                        webhookUrl: 'http://localhost:6245/api/tradingview/webhook/demo-secret',
                    },
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                deployments: [
                    {
                        id: 'deployment-1',
                        name: 'AAPL Live Deployment',
                        symbol: 'AAPL',
                        timeframe: '1d',
                        target: 'paper',
                        status: 'active',
                        marketDataSource: 'exact-fixture-replay',
                        webhookUrl: 'http://localhost:6245/api/tradingview/webhook/demo-secret',
                        lastSignalAt: '2026-03-14T16:00:00.000Z',
                        lastRunAt: '2026-03-14T16:00:02.000Z',
                        signalEvents: [],
                        executionIntents: [],
                    },
                ],
            }),
        })
    })

    await page.route('**/api/trading/backtest', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: {
                    trades: [
                        {
                            id: 'trade-1',
                            symbol: 'AAPL',
                            side: 'Long',
                            entryTime: dailyBars[5].time,
                            entryPrice: 184,
                            exitTime: dailyBars[10].time,
                            exitPrice: 191,
                            quantity: 10,
                            pnl: 70,
                            pnlPercent: 3.8,
                            durationBars: 5,
                        },
                    ],
                    equityCurve: [],
                    parityComparison: {
                        exactMatch: true,
                        expectedTradeCount: 1,
                        actualTradeCount: 1,
                        firstDivergenceMessage: null,
                    },
                    diagnostics: {
                        engineMode: 'pinets',
                        dataSource: 'tradingview-fixture',
                        comparisonMode: 'force-replay',
                        warnings: [],
                    },
                    metrics: {
                        netProfit: 70,
                        netProfitPercent: 3.8,
                        winRate: 100,
                        totalTrades: 1,
                        maxDrawdown: 0,
                        profitFactor: 1.7,
                        sharpeRatio: 1.2,
                        benchmarkReturnPercent: 2.2,
                    },
                },
            }),
        })
    })

    await page.route('**/api/trading/market-data**', async (route) => {
        const url = new URL(route.request().url())
        const timeframe = url.searchParams.get('timeframe')
        const data = timeframe === '1h' ? hourlyBars : dailyBars

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data }),
        })
    })

    await page.route('**/api/trading/quotes**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                quotes: [
                    { symbol: 'AAPL', name: 'Apple Inc.', price: 198.2, changePercent: 1.3 },
                    { symbol: 'MSFT', name: 'Microsoft Corporation', price: 421.6, changePercent: 0.9 },
                ],
            }),
        })
    })

    await page.route('**/api/schwab/accounts', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                accounts: [
                    {
                        securitiesAccount: {
                            accountId: '123456789',
                            hashValue: 'acct-hash-1',
                            type: 'Brokerage',
                        },
                    },
                ],
            }),
        })
    })

    await page.route('**/api/schwab/positions**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                positions: [
                    {
                        symbol: 'AAPL',
                        quantity: 25,
                        averagePrice: 182.4,
                        currentPrice: 198.2,
                        marketValue: 4955,
                        unrealizedPL: 395,
                        unrealizedPLPercent: 8.65,
                    },
                ],
                balance: {
                    cashBalance: 12500,
                    equity: 38420,
                    buyingPower: 25000,
                    liquidationValue: 38420,
                },
            }),
        })
    })

    await page.route('**/api/schwab/orders**', async (route) => {
        if (route.request().method() === 'POST') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ orderId: 'order-1' }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                orders: [
                    {
                        orderId: 'order-1',
                        status: 'WORKING',
                        enteredTime: '2026-03-14T16:00:00.000Z',
                    },
                ],
            }),
        })
    })
}

test('mahacharts renders as a chart-first workspace without runtime noise', async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const badResponses: string[] = []

    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })

    page.on('pageerror', (error) => {
        pageErrors.push(error.message)
    })

    page.on('response', (response) => {
        if (response.status() >= 400 && !response.url().includes('/api/auth/session')) {
            badResponses.push(`${response.status()} ${response.url()}`)
        }
    })

    await signInWithDevBypass(page)
    await mockMahaChartsApis(page)
    await page.goto('/superchart?symbol=AAPL&timeframe=1d')

    await expect(page.getByTestId('mahacharts-topbar')).toBeVisible()
    await expect(page.getByTestId('mahacharts-left-rail')).toBeVisible()
    await expect(page.getByTestId('mahacharts-stage')).toBeVisible()
    await expect(page.getByTestId('mahacharts-right-strip')).toBeVisible()
    await expect(page.getByTestId('mahacharts-dock')).toBeVisible()
    await expect(page.getByTestId('mahacharts-chart-main')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dashboard' })).toHaveCount(0)

    const stageBox = await page.getByTestId('mahacharts-stage').boundingBox()
    expect(stageBox?.height ?? 0).toBeGreaterThan(450)
    expect(stageBox?.width ?? 0).toBeGreaterThan(700)

    await page.getByTestId('mahacharts-timeframe-1h').click()
    await expect(page).toHaveURL(/timeframe=1h/)

    await page.getByTestId('mahacharts-open-indicators').click()
    await expect(page.getByTestId('mahacharts-indicators-modal')).toBeVisible()
    await expect(page.getByTestId('mahacharts-indicator-row-volume')).toBeVisible()
    await page.getByTestId('mahacharts-indicators-close').click()
    await expect(page.getByTestId('mahacharts-indicators-modal')).toBeHidden()

    const stageWidthBeforeOverlay = (await page.getByTestId('mahacharts-stage').boundingBox())?.width ?? 0
    await page.getByTestId('mahacharts-right-icon-watchlist').click()
    await expect(page.getByTestId('mahacharts-right-overlay')).toBeVisible()
    await expect(page.getByTestId('mahacharts-watchlist-rail')).toBeVisible()
    await expect(page.getByTestId('mahacharts-right-strip')).toBeVisible()
    const stageWidthWithWatchlist = (await page.getByTestId('mahacharts-stage').boundingBox())?.width ?? 0
    expect(Math.abs(stageWidthBeforeOverlay - stageWidthWithWatchlist)).toBeLessThanOrEqual(8)

    await page.getByTestId('mahacharts-dock-tab-editor').click()
    await expect(page.getByTestId('mahacharts-editor-overlay')).toBeVisible()
    await expect(page.getByTestId('mahacharts-editor-panel')).toBeVisible()
    await expect(page.getByTestId('mahacharts-chart-main')).toBeVisible()
    await expect(page.getByTestId('mahacharts-right-overlay')).toHaveCount(0)

    await page.getByTestId('mahacharts-right-icon-trade').click()
    await expect(page.getByTestId('mahacharts-right-overlay')).toBeVisible()
    await expect(page.getByTestId('mahacharts-trade-rail')).toBeVisible()
    await expect(page.getByTestId('mahacharts-editor-overlay')).toHaveCount(0)

    await page.getByTestId('mahacharts-right-overlay-close').click()
    await expect(page.getByTestId('mahacharts-right-overlay')).toHaveCount(0)

    const joinedErrors = [...consoleErrors, ...pageErrors].join('\n')
    expect(joinedErrors).not.toContain('Maximum update depth exceeded')
    expect(joinedErrors).not.toContain('<button> cannot contain a nested <button>')
    expect(joinedErrors).not.toContain('Object is disposed')
    expect(joinedErrors).not.toContain('Unexpected token')
    expect(badResponses).toEqual([])
})

test('@visual mahacharts desktop shell matches the chart-first layout', async ({ page }) => {
    await signInWithDevBypass(page)
    await mockMahaChartsApis(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/superchart?symbol=AAPL&timeframe=1d')

    await expect(page.getByTestId('mahacharts-chart-main')).toBeVisible()
    await expect(page).toHaveScreenshot('mahacharts-shell.png', {
        mask: [
            page.getByTestId('mahacharts-chart-main'),
        ],
    })
})

test('@visual mahacharts desktop watchlist overlay matches the screenshot-driven geometry', async ({ page }) => {
    await signInWithDevBypass(page)
    await mockMahaChartsApis(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/superchart?symbol=AAPL&timeframe=1d')

    await page.getByTestId('mahacharts-right-icon-watchlist').click()
    await expect(page.getByTestId('mahacharts-right-overlay')).toBeVisible()
    await expect(page).toHaveScreenshot('mahacharts-watchlist-overlay.png', {
        mask: [
            page.getByTestId('mahacharts-chart-main'),
        ],
    })
})

test('@visual mahacharts desktop editor overlay matches the screenshot-driven geometry', async ({ page }) => {
    await signInWithDevBypass(page)
    await mockMahaChartsApis(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/superchart?symbol=AAPL&timeframe=1d')

    await page.getByTestId('mahacharts-dock-tab-editor').click()
    await expect(page.getByTestId('mahacharts-editor-overlay')).toBeVisible()
    await expect(page).toHaveScreenshot('mahacharts-editor-overlay.png', {
        mask: [
            page.getByTestId('mahacharts-chart-main'),
        ],
    })
})
