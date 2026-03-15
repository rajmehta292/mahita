import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SchwabGating } from '@/app/components/SchwabGating'

const refresh = vi.fn()
const push = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push,
        refresh,
    }),
}))

describe('SchwabGating', () => {
    beforeEach(() => {
        push.mockReset()
        refresh.mockReset()
        vi.useRealTimers()
        vi.restoreAllMocks()
        window.localStorage.clear()
        window.sessionStorage.clear()
    })

    it('finishes the connect flow when the callback window reports success', async () => {
        let configChecks = 0
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/user/schwab-config') {
                configChecks += 1
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        config: {
                            hasClientId: true,
                            hasClientSecret: true,
                            hasAccessToken: configChecks > 1,
                            hasRefreshToken: configChecks > 1,
                        },
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=authorize') {
                return {
                    ok: true,
                    json: async () => ({ authUrl: 'https://auth.schwab.test' }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        const popup = {
            closed: false,
            close: vi.fn(() => {
                popup.closed = true
            }),
        }

        Object.defineProperty(window, 'open', {
            value: vi.fn(() => popup),
            configurable: true,
        })

        render(
            <SchwabGating requiredConfig={false}>
                <div>Connected children</div>
            </SchwabGating>
        )

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /connect schwab portal/i })).toBeInTheDocument()
        )

        fireEvent.click(screen.getByRole('button', { name: /connect schwab portal/i }))

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /waiting for schwab authorization/i })).toBeDisabled()
        )

        await act(async () => {
            window.dispatchEvent(new MessageEvent('message', {
                origin: window.location.origin,
                data: {
                    type: 'schwab-auth-complete',
                    success: true,
                },
            }))
        })

        await waitFor(() =>
            expect(screen.getByText('Connected children')).toBeInTheDocument()
        )

        expect(refresh).toHaveBeenCalled()
    })

    it('surfaces a clear production-origin message when interactive Schwab OAuth is unavailable', async () => {
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/user/schwab-config') {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        config: {
                            hasClientId: true,
                            hasClientSecret: true,
                            hasAccessToken: false,
                            hasRefreshToken: false,
                        },
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=authorize') {
                return {
                    ok: false,
                    json: async () => ({
                        error: 'Live Schwab OAuth is only supported on the public Mahita app origin right now. Use https://mahita.ai to complete brokerage authorization.',
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }))

        render(
            <SchwabGating requiredConfig={false}>
                <div>Connected children</div>
            </SchwabGating>
        )

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /connect schwab portal/i })).toBeInTheDocument()
        )

        fireEvent.click(screen.getByRole('button', { name: /connect schwab portal/i }))

        await waitFor(() =>
            expect(screen.getByText(/only supported on the public mahita app origin/i)).toBeInTheDocument()
        )
    })

    it('waits in a finalizing state when the popup closes before the status route confirms connection', async () => {
        vi.useRealTimers()

        let configChecks = 0
        let statusChecks = 0
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/user/schwab-config') {
                configChecks += 1
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        config: {
                            hasClientId: true,
                            hasClientSecret: true,
                            hasAccessToken: configChecks > 1,
                            hasRefreshToken: configChecks > 1,
                        },
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=authorize') {
                return {
                    ok: true,
                    json: async () => ({ authUrl: 'https://auth.schwab.test' }),
                }
            }

            if (url === '/api/schwab/auth?action=status') {
                statusChecks += 1
                return {
                    ok: true,
                    json: async () => ({
                        isConnected: statusChecks > 1,
                        isPendingAuthorization: statusChecks <= 1,
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }))

        const popup = {
            closed: false,
            close: vi.fn(() => {
                popup.closed = true
            }),
        }

        Object.defineProperty(window, 'open', {
            value: vi.fn(() => popup),
            configurable: true,
        })

        render(
            <SchwabGating requiredConfig={false}>
                <div>Connected children</div>
            </SchwabGating>
        )

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /connect schwab portal/i })).toBeInTheDocument()
        )

        fireEvent.click(screen.getByRole('button', { name: /connect schwab portal/i }))

        popup.closed = true

        await waitFor(() =>
            expect(screen.getByText(/finishing schwab authorization in the background/i)).toBeInTheDocument(),
            { timeout: 2_500 }
        )

        await waitFor(() =>
            expect(screen.getByText('Connected children')).toBeInTheDocument(),
            { timeout: 4_500 }
        )
        expect(refresh).toHaveBeenCalled()
    }, 8_000)

    it('finishes the connect flow from the same-origin fallback signal when postMessage is unavailable', async () => {
        let configChecks = 0
        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/user/schwab-config') {
                configChecks += 1
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        config: {
                            hasClientId: true,
                            hasClientSecret: true,
                            hasAccessToken: configChecks > 1,
                            hasRefreshToken: configChecks > 1,
                        },
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=authorize') {
                return {
                    ok: true,
                    json: async () => ({ authUrl: 'https://auth.schwab.test' }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }))

        const popup = {
            closed: false,
            close: vi.fn(() => {
                popup.closed = true
            }),
        }

        Object.defineProperty(window, 'open', {
            value: vi.fn(() => popup),
            configurable: true,
        })

        render(
            <SchwabGating requiredConfig={false}>
                <div>Connected children</div>
            </SchwabGating>
        )

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /connect schwab portal/i })).toBeInTheDocument()
        )

        fireEvent.click(screen.getByRole('button', { name: /connect schwab portal/i }))

        await waitFor(() =>
            expect(screen.getByRole('button', { name: /waiting for schwab authorization/i })).toBeDisabled()
        )

        await act(async () => {
            window.dispatchEvent(new StorageEvent('storage', {
                key: 'mahita.schwab.popup.signal',
                newValue: JSON.stringify({
                    type: 'schwab-auth-complete',
                    success: true,
                    timestamp: Date.now(),
                    nonce: 'fallback-success',
                }),
            }))
        })

        await waitFor(() =>
            expect(screen.getByText('Connected children')).toBeInTheDocument()
        )

        expect(popup.close).toHaveBeenCalled()
        expect(refresh).toHaveBeenCalled()
    })
})
