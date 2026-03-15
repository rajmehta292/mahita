import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SuperChartWorkspace } from '@/app/components/SuperChart/SuperChartWorkspace'

const replaceMock = vi.fn()
const updatePreferencesMock = vi.fn()

let searchState = 'symbol=AAPL&timeframe=1d'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams(searchState),
}))

vi.mock('@/app/components/Chart', () => ({
    default: () => <div data-testid="mock-chart">Chart</div>,
}))

vi.mock('@/app/components/Backtest/MahitaCodeEditor', () => ({
    MahitaCodeEditor: ({ value, onChange }: { value: string, onChange: (value: string) => void }) => (
        <textarea data-testid="mock-code-editor" value={value} onChange={(event) => onChange(event.target.value)} />
    ),
}))

vi.mock('@/app/components/Auth/SessionActivityTracker', () => ({
    SessionActivityTracker: () => null,
}))

vi.mock('@/app/hooks/use-user-preferences', () => ({
    useUserPreferences: () => ({
        preferences: {
            watchlistSymbols: '',
            selectedAccountId: null,
            indicatorFavorites: '["volume"]',
        },
        updatePreferences: updatePreferencesMock,
    }),
}))

describe('SuperChartWorkspace', () => {
    beforeEach(() => {
        replaceMock.mockReset()
        updatePreferencesMock.mockReset()
        searchState = 'symbol=AAPL&timeframe=1d'

        const jsonResponse = (payload: unknown, status = 200) => ({
            ok: status >= 200 && status < 300,
            status,
            headers: {
                get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json; charset=utf-8' : null),
            },
            json: async () => payload,
            text: async () => JSON.stringify(payload),
        })

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/script-editor/scripts') {
                return jsonResponse({
                    drafts: [],
                    defaultTemplate: '//@version=6\nstrategy("Mahita Strategy", overlay=true)',
                })
            }

            if (url === '/api/script-editor/fixtures') {
                return jsonResponse({ fixtures: [] })
            }

            if (url === '/api/trading/deployments') {
                return jsonResponse({ deployments: [] })
            }

            if (url === '/api/strategies') {
                return jsonResponse({
                    strategies: [],
                })
            }

            if (url === '/api/indicators/catalog') {
                return jsonResponse({
                    favorites: ['volume'],
                    indicators: [
                        {
                            id: 'volume',
                            name: 'Volume',
                            shortLabel: 'Vol',
                            kind: 'indicator',
                            pane: 'volume',
                            category: 'Technicals',
                            description: 'Displays bar volume.',
                        },
                        {
                            id: 'macd',
                            name: 'MACD',
                            shortLabel: 'MACD',
                            kind: 'indicator',
                            pane: 'oscillator',
                            category: 'Technicals',
                            description: 'Momentum oscillator.',
                        },
                    ],
                    profiles: [],
                    patterns: [],
                })
            }

            if (url === '/api/schwab/accounts') {
                return jsonResponse({ accounts: [] })
            }

            if (url.startsWith('/api/trading/market-data?symbol=AAPL&timeframe=1d')) {
                return jsonResponse({
                    data: [
                        { time: 1710000000, open: 178, high: 181, low: 177, close: 180, volume: 1000000 },
                        { time: 1710086400, open: 180, high: 183, low: 179, close: 182, volume: 1200000 },
                    ],
                })
            }

            if (url.startsWith('/api/trading/market-data?symbol=AAPL&timeframe=1h')) {
                return jsonResponse({
                    data: [
                        { time: 1710082800, open: 181, high: 182, low: 180, close: 181.5, volume: 250000 },
                        { time: 1710086400, open: 181.5, high: 182.5, low: 181, close: 182, volume: 280000 },
                    ],
                })
            }

            if (url.startsWith('/api/search/symbols')) {
                return jsonResponse({
                    results: [
                        {
                            symbol: 'AAPL',
                            name: 'Apple Inc.',
                            exchange: 'NASDAQ',
                            assetType: 'equity',
                            source: 'search',
                        },
                    ],
                })
            }

            if (url.startsWith('/api/trading/quotes?symbols=')) {
                return jsonResponse({ quotes: [] })
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('renders the rebuilt chart-first shell without the generic app chrome', async () => {
        render(<SuperChartWorkspace />)

        await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument())

        expect(screen.getByTestId('mahacharts-topbar')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-left-rail')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-stage')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-right-strip')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-dock')).toBeInTheDocument()
        expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })

    it('keeps route sync and opens dock panels from MahaCharts controls', async () => {
        render(<SuperChartWorkspace />)

        await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument())
        expect(screen.queryByTestId('mahacharts-dock-panel')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('mahacharts-dock-tab-tester'))
        expect(screen.getByTestId('mahacharts-dock-panel')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('mahacharts-timeframe-1h'))

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/superchart?symbol=AAPL&timeframe=1h')
        })
    })

    it('opens the Pine editor as an overlay instead of expanding the dock', async () => {
        render(<SuperChartWorkspace />)

        await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument())
        expect(screen.queryByTestId('mahacharts-editor-overlay')).not.toBeInTheDocument()
        expect(screen.queryByTestId('mahacharts-dock-panel')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('mahacharts-dock-tab-editor'))

        expect(screen.getByTestId('mahacharts-editor-overlay')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-editor-panel')).toBeInTheDocument()
        expect(screen.queryByTestId('mahacharts-dock-panel')).not.toBeInTheDocument()
    })

    it('opens right-side utility panels as overlays and keeps them mutually exclusive with the editor', async () => {
        render(<SuperChartWorkspace />)

        await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument())
        expect(screen.queryByTestId('mahacharts-right-overlay')).not.toBeInTheDocument()

        fireEvent.click(screen.getByTestId('mahacharts-right-icon-watchlist'))
        await waitFor(() => expect(screen.getByTestId('mahacharts-right-overlay')).toBeInTheDocument())
        expect(screen.getByTestId('mahacharts-watchlist-rail')).toBeInTheDocument()

        fireEvent.click(screen.getByTestId('mahacharts-right-icon-watchlist'))
        await waitFor(() => expect(screen.queryByTestId('mahacharts-right-overlay')).not.toBeInTheDocument())

        fireEvent.click(screen.getByTestId('mahacharts-dock-tab-editor'))
        await waitFor(() => expect(screen.getByTestId('mahacharts-editor-overlay')).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('mahacharts-right-icon-trade'))
        await waitFor(() => expect(screen.queryByTestId('mahacharts-editor-overlay')).not.toBeInTheDocument())
        expect(screen.getByTestId('mahacharts-right-overlay')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-trade-rail')).toBeInTheDocument()
    })

    it('opens the indicators modal from the top command bar', async () => {
        render(<SuperChartWorkspace />)

        await waitFor(() => expect(screen.getByTestId('mock-chart')).toBeInTheDocument())

        fireEvent.click(screen.getByTestId('mahacharts-open-indicators'))

        expect(screen.getByTestId('mahacharts-indicators-modal')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-indicator-row-volume')).toBeInTheDocument()
        expect(screen.getByTestId('mahacharts-indicator-row-macd')).toBeInTheDocument()
    })
})
