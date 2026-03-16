import { fireEvent, screen, waitFor } from '@testing-library/react'
import React from 'react'
import DashboardPage from '@/app/dashboard/page'
import { renderApp } from '@/tests/utils/render-app'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

vi.mock('next/link', () => ({
    default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
        <a href={href} {...props}>
            {children}
        </a>
    ),
}))

vi.mock('@/app/components/Layout/MainLayout', () => ({
    MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/app/components/SchwabGating', () => ({
    SchwabGating: ({
        children,
        onStateChange,
    }: {
        children: React.ReactNode
        onStateChange: (connected: boolean) => void
    }) => {
        React.useEffect(() => {
            onStateChange(true)
        }, [onStateChange])

        return <div>{children}</div>
    },
}))

vi.mock('@/app/components/AI/AlphaInsightsWidget', () => ({
    AlphaInsightsWidget: () => <div>Alpha Insights</div>,
}))

vi.mock('@/app/hooks/use-user-preferences', () => ({
    useUserPreferences: () => ({
        preferences: {
            selectedAccountId: null,
            watchlistSymbols: null,
        },
        updatePreferences: vi.fn().mockResolvedValue(undefined),
    }),
}))

describe('DashboardPage', () => {
    it('updates summary cards when the selected account changes', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/schwab/account-summaries') {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        updatedAt: '2026-03-11T15:01:31.000Z',
                        accounts: [
                            {
                                accountId: '12349998',
                                accountKey: 'hash-998',
                                type: 'Brokerage',
                                displayName: 'Brokerage • 9998',
                                cashAndCashInvestments: 0.99,
                                accountValue: 0.99,
                                dayChange: 0,
                                dayChangePercent: 0,
                                positionsCount: 0,
                                holdingsMarketValue: 0,
                                totalCostBasis: 0,
                                totalUnrealizedGainLoss: 0,
                            },
                            {
                                accountId: '98760251',
                                accountKey: 'hash-251',
                                type: 'IRA',
                                displayName: 'IRA • 0251',
                                cashAndCashInvestments: 2115.01,
                                accountValue: 46956.85,
                                dayChange: -24.12,
                                dayChangePercent: -0.05,
                                positionsCount: 61,
                                holdingsMarketValue: 44840.54,
                                totalCostBasis: 57096.39,
                                totalUnrealizedGainLoss: -12255.85,
                            },
                        ],
                        totals: {
                            cashAndCashInvestments: 2116,
                            accountValue: 46957.84,
                            dayChange: -24.12,
                            dayChangePercent: -0.05,
                            holdingsMarketValue: 44840.54,
                            totalCostBasis: 57096.39,
                            totalUnrealizedGainLoss: -12255.85,
                            positionsCount: 61,
                        },
                    }),
                }
            }

            if (url === '/api/trading/news') {
                return { ok: true, json: async () => ({ success: true, news: [] }) }
            }

            if (url === '/api/platform/runtime-status') {
                return {
                    ok: true,
                    json: async () => ({ runtime: { dataPipeline: { running: true } } }),
                }
            }

            if (url.startsWith('/api/trading/quotes?symbols=')) {
                return { ok: true, json: async () => ({ success: true, quotes: [] }) }
            }

            if (url === '/api/user/view-demand') {
                return { ok: true, json: async () => ({ success: true }) }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        renderApp(<DashboardPage />, {
            session: {
                expires: '2999-01-01T00:00:00.000Z',
                user: {
                    id: 'user_dashboard',
                    email: 'raj@example.com',
                    role: 'SUPERUSER',
                },
            },
        })
        await waitFor(() => expect(screen.getAllByText('$0.99').length).toBeGreaterThan(0))
        expect(screen.getByText('Brokerage • 9998')).toBeInTheDocument()

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'hash-251' },
        })
        await waitFor(() => expect(screen.getAllByText('$46,956.85').length).toBeGreaterThan(0))
        expect(screen.getAllByText('$2,115.01').length).toBeGreaterThan(0)
        expect(screen.getAllByText('-0.05%').length).toBeGreaterThan(0)
        expect(screen.getAllByText(/IRA .*0251/).length).toBeGreaterThan(0)
    })
})
