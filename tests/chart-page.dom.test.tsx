import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ChartWorkspace } from '@/app/components/Chart/ChartWorkspace'

const replaceMock = vi.fn()

let searchState = 'symbol=AAPL&timeframe=1d'

vi.mock('next-auth/react', () => ({
    useSession: () => ({
        data: {
            user: {
                id: 'user-1',
                email: 'dev@mahita.ai',
            },
            expires: '2099-01-01T00:00:00.000Z',
        },
        status: 'authenticated',
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    usePathname: () => '/chart',
    useSearchParams: () => new URLSearchParams(searchState),
}))

vi.mock('next/dynamic', () => ({
    default: () =>
        function MockChart() {
            return <div data-testid="mock-chart">Chart</div>
        },
}))

vi.mock('@/app/components/Layout/MainLayout', () => ({
    MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/app/hooks/use-user-preferences', () => ({
    useUserPreferences: () => ({
        preferences: {
            viewRefreshIntervalSeconds: 13,
        },
    }),
}))

vi.mock('@/app/hooks/use-view-demand', () => ({
    useViewDemand: vi.fn(),
}))

describe('ChartPage', () => {
    beforeEach(() => {
        replaceMock.mockReset()
        searchState = 'symbol=AAPL&timeframe=1d'
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('syncs the displayed chart symbol to route param changes on the chart page', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/platform/chart-catalog') {
                return {
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => ({
                        catalog: [
                            { symbol: 'AAPL', timeframes: ['1d', '1m'] },
                            { symbol: 'MSFT', timeframes: ['1d', '1m'] },
                        ],
                    }),
                }
            }

            if (url === '/api/trading/market-data?symbol=AAPL&timeframe=1d') {
                return {
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => ({
                        data: [
                            { time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
                            { time: 2, open: 100, high: 102, low: 99, close: 101, volume: 1100 },
                        ],
                        metadata: { warnings: [] },
                    }),
                }
            }

            if (url === '/api/trading/market-data?symbol=MSFT&timeframe=1d') {
                return {
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => ({
                        data: [
                            { time: 1, open: 200, high: 201, low: 199, close: 200, volume: 2000 },
                            { time: 2, open: 200, high: 202, low: 199, close: 201, volume: 2100 },
                        ],
                        metadata: { warnings: [] },
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        const { rerender } = render(<ChartWorkspace />)

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/trading/market-data?symbol=AAPL&timeframe=1d',
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            )
        )
        expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument()

        searchState = 'symbol=MSFT&timeframe=1d'
        rerender(<ChartWorkspace />)

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/trading/market-data?symbol=MSFT&timeframe=1d',
                expect.objectContaining({ signal: expect.any(AbortSignal) })
            )
        )
        expect(screen.getByDisplayValue('MSFT')).toBeInTheDocument()
    })

    it('updates the route when the symbol changes from the chart header', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/platform/chart-catalog') {
                return {
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => ({
                        catalog: [
                            { symbol: 'AAPL', timeframes: ['1d'] },
                            { symbol: 'MSFT', timeframes: ['1d'] },
                        ],
                    }),
                }
            }

            if (url.startsWith('/api/trading/market-data?symbol=')) {
                return {
                    ok: true,
                    headers: new Headers({ 'content-type': 'application/json' }),
                    json: async () => ({
                        data: [
                            { time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
                            { time: 2, open: 100, high: 102, low: 99, close: 101, volume: 1100 },
                        ],
                        metadata: { warnings: [] },
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<ChartWorkspace />)

        await waitFor(() => expect(screen.getByDisplayValue('AAPL')).toBeInTheDocument())

        fireEvent.change(screen.getByDisplayValue('AAPL'), {
            target: { value: 'MSFT' },
        })

        await waitFor(() =>
            expect(replaceMock).toHaveBeenCalledWith('/chart?symbol=MSFT&timeframe=1d', { scroll: false })
        )
    })
})
