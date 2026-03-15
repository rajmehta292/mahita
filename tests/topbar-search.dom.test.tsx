import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { TopBar } from '@/app/components/Layout/TopBar'

const pushMock = vi.fn()

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
        update: vi.fn(),
    }),
    signOut: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: pushMock,
    }),
}))

vi.mock('@/lib/auth-redirect', () => ({
    resolveClientCallbackUrl: () => 'http://localhost:6244/',
}))

describe('TopBar global search', () => {
    beforeEach(() => {
        pushMock.mockReset()
    })

    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('opens the command palette and renders grouped search results', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)
            if (url.startsWith('/api/search/global?q=AAPL')) {
                return {
                    ok: true,
                    json: async () => ({
                        groups: [
                            {
                                key: 'instruments',
                                label: 'Instruments',
                                results: [
                                    {
                                        id: 'instrument:aapl',
                                        group: 'instruments',
                                        title: 'AAPL',
                                        subtitle: 'Apple Inc.',
                                        href: '/chart?symbol=AAPL&timeframe=1d',
                                        score: 120,
                                        badge: 'Equity',
                                    },
                                ],
                            },
                        ],
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<TopBar onMenuClick={vi.fn()} />)

        fireEvent.click(screen.getByRole('button', { name: /search symbols, presets, strategies, docs/i }))
        expect(screen.getByRole('dialog', { name: /global search/i })).toBeInTheDocument()

        fireEvent.change(screen.getByPlaceholderText(/search instruments, screener presets, strategies, docs/i), {
            target: { value: 'AAPL' },
        })

        await waitFor(() => expect(fetchMock).toHaveBeenCalled())
        await waitFor(() => expect(screen.getByText('Instruments')).toBeInTheDocument())
        expect(screen.getByText('AAPL')).toBeInTheDocument()
        expect(screen.getByText('Apple Inc.')).toBeInTheDocument()
    })
})
