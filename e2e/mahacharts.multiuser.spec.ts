import { expect, test, type BrowserContext, type Page } from '@playwright/test'

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

function buildStrategy(versions: Array<{ id: string, versionNumber: number, label: string, createdAt: string }>) {
    const latestVersion = versions[0]

    return {
        id: 'draft-1',
        name: 'AAPL Momentum',
        description: 'TradingView-style regression draft',
        symbol: 'AAPL',
        timeframe: '1d',
        language: 'pine-v6',
        engineMode: 'pinets',
        favorite: false,
        pinned: true,
        latestVersionId: latestVersion.id,
        latestVersion: {
            ...latestVersion,
            strategyId: 'draft-1',
            description: 'TradingView-style regression draft',
            symbol: 'AAPL',
            timeframe: '1d',
            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
            language: 'pine-v6',
            engineMode: 'pinets',
            linkedFixtureId: 'fixture-aapl-1d',
            runSettings: null,
            sourceHash: `${latestVersion.id}-hash`,
            updatedAt: latestVersion.createdAt,
        },
        versions: versions.map((version) => ({
            ...version,
            strategyId: 'draft-1',
            description: 'TradingView-style regression draft',
            symbol: 'AAPL',
            timeframe: '1d',
            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
            language: 'pine-v6',
            engineMode: 'pinets',
            linkedFixtureId: 'fixture-aapl-1d',
            runSettings: null,
            sourceHash: `${version.id}-hash`,
            updatedAt: version.createdAt,
        })),
        workspaceSession: {
            id: 'workspace-1',
            strategyId: 'draft-1',
            baseVersionId: latestVersion.id,
            symbol: 'AAPL',
            timeframe: '1d',
            source: '//@version=6\nstrategy("AAPL Momentum", overlay=true)',
            language: 'pine-v6',
            engineMode: 'pinets',
            linkedFixtureId: 'fixture-aapl-1d',
            runSettings: null,
            autosaveRevision: versions.length,
            lastOpenedAt: '2026-03-14T16:00:00.000Z',
            updatedAt: latestVersion.createdAt,
        },
        updatedAt: latestVersion.createdAt,
    }
}

async function mockSharedMahaChartsApis(page: Page, state: {
    versions: Array<{ id: string, versionNumber: number, label: string, createdAt: string }>
    deployments: Array<Record<string, unknown>>
}) {
    const dailyBars = buildBars(48, 86_400)

    await page.route('**/api/search/symbols**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                results: [
                    { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', assetType: 'equity', source: 'search' },
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

    await page.route('**/api/script-editor/fixtures', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ fixtures: [] }),
        })
    })

    await page.route('**/api/indicators/catalog', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                favorites: ['volume'],
                indicators: [
                    { id: 'volume', name: 'Volume', shortLabel: 'Vol', kind: 'indicator', pane: 'volume', category: 'Technicals', description: 'Displays bar volume.' },
                    { id: 'macd', name: 'MACD', shortLabel: 'MACD', kind: 'indicator', pane: 'oscillator', category: 'Technicals', description: 'Momentum oscillator.' },
                ],
                profiles: [],
                patterns: [],
            }),
        })
    })

    await page.route('**/api/strategies', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                strategies: [buildStrategy(state.versions)],
            }),
        })
    })

    await page.route('**/api/strategies/draft-1', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                strategy: buildStrategy(state.versions),
            }),
        })
    })

    await page.route('**/api/strategies/draft-1/versions', async (route) => {
        if (route.request().method() === 'POST') {
            const nextVersionNumber = state.versions[0].versionNumber + 1
            state.versions.unshift({
                id: `version-${nextVersionNumber}`,
                versionNumber: nextVersionNumber,
                label: `v${nextVersionNumber}`,
                createdAt: `2026-03-14T1${nextVersionNumber}:00:00.000Z`,
            })
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                strategy: buildStrategy(state.versions),
            }),
        })
    })

    await page.route('**/api/trading/deployments', async (route) => {
        if (route.request().method() === 'POST') {
            state.deployments.unshift({
                id: `deployment-${state.deployments.length + 1}`,
                name: 'AAPL Momentum • AAPL 1d',
                symbol: 'AAPL',
                timeframe: '1d',
                target: 'paper',
                status: 'active',
                marketDataSource: 'live-data-dependent',
                webhookUrl: 'https://mahita.test/webhook/deployment-1',
                lastSignalAt: '2026-03-14T18:00:00.000Z',
                lastRunAt: '2026-03-14T18:00:00.000Z',
                runs: [],
                signalEvents: [],
                executionIntents: [],
            })
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                deployments: state.deployments,
            }),
        })
    })

    await page.route('**/api/trading/market-data?symbol=AAPL&timeframe=1d**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ data: dailyBars }),
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
                            hashValue: '123456789',
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
                positions: [],
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
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                orders: [],
            }),
        })
    })
}

async function bootContext(context: BrowserContext, state: {
    versions: Array<{ id: string, versionNumber: number, label: string, createdAt: string }>
    deployments: Array<Record<string, unknown>>
}) {
    const page = await context.newPage()
    await signInWithDevBypass(page)
    await mockSharedMahaChartsApis(page, state)
    await page.goto('/superchart?symbol=AAPL&timeframe=1d')
    await expect(page.getByTestId('mahacharts-chart-main')).toBeVisible()
    return page
}

test('mahacharts keeps overlay state session-local while strategy versions and deployments propagate across sessions', async ({ browser }) => {
    const sharedState = {
        versions: [
            { id: 'version-2', versionNumber: 2, label: 'v2', createdAt: '2026-03-14T16:00:00.000Z' },
            { id: 'version-1', versionNumber: 1, label: 'Initial version', createdAt: '2026-03-14T15:00:00.000Z' },
        ],
        deployments: [] as Array<Record<string, unknown>>,
    }

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()

    const pageA = await bootContext(contextA, sharedState)
    const pageB = await bootContext(contextB, sharedState)

    await pageA.getByTestId('mahacharts-dock-tab-editor').click()
    await expect(pageA.getByTestId('mahacharts-editor-overlay')).toBeVisible()
    await expect(pageB.getByTestId('mahacharts-editor-overlay')).toHaveCount(0)

    await pageA.getByRole('button', { name: /save version/i }).click()
    await pageB.reload()
    await pageB.getByTestId('mahacharts-open-strategies').click()
    await expect(pageB.getByText('3 versions')).toBeVisible()
    await pageB.getByTestId('mahacharts-indicators-close').click()

    await pageA.getByTestId('mahacharts-right-icon-automation').click()
    await pageA.getByRole('button', { name: /create tradingview webhook deployment/i }).click()

    await pageB.reload()
    await pageB.getByTestId('mahacharts-right-icon-automation').click()
    await expect(pageB.getByTestId('mahacharts-deployment-card')).toBeVisible()

    await contextA.close()
    await contextB.close()
})
