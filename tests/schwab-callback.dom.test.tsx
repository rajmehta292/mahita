import { render, screen, waitFor } from '@testing-library/react'
import SchwabCallbackPage from '@/app/schwab/callback/page'

const searchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
    useSearchParams: () => searchParams,
}))

describe('SchwabCallbackPage', () => {
    beforeEach(() => {
        vi.restoreAllMocks()
        searchParams.delete('code')
        searchParams.delete('state')
        searchParams.delete('error')
        searchParams.delete('error_description')
        window.sessionStorage.clear()
    })

    it('exchanges the code and notifies the opener on success', async () => {
        searchParams.set('code', 'demo-auth-code')
        searchParams.set('state', 'pending-state-123')

        const fetchMock = vi.fn(async () => ({
            ok: true,
            clone() {
                return this
            },
            json: async () => ({ success: true }),
        }))
        vi.stubGlobal('fetch', fetchMock)

        const postMessage = vi.fn()
        const close = vi.fn()
        Object.defineProperty(window, 'opener', {
            value: { postMessage },
            configurable: true,
        })
        Object.defineProperty(window, 'close', {
            value: close,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /authorization complete/i })).toBeInTheDocument()
        )

        expect(fetchMock).toHaveBeenCalledWith('/api/schwab/auth', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
                code: 'demo-auth-code',
                state: 'pending-state-123',
            }),
        }))
        expect(postMessage).toHaveBeenCalledWith(
            { type: 'schwab-auth-complete', success: true },
            window.location.origin
        )
    })

    it('shows a readable error when token exchange fails', async () => {
        searchParams.set('code', 'bad-auth-code')
        searchParams.set('state', 'pending-state-456')

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: false,
            status: 400,
            clone() {
                return this
            },
            json: async () => ({ error: 'Token exchange failed' }),
        })))

        Object.defineProperty(window, 'opener', {
            value: null,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByText(/authorization failed/i)).toBeInTheDocument()
        )

        expect(screen.getByText(/token exchange failed/i)).toBeInTheDocument()
    })

    it('recovers to success when a stale callback reports missing state but the account is already connected', async () => {
        searchParams.set('code', 'stale-auth-code')
        searchParams.set('state', 'expired-state-123')

        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/schwab/auth') {
                return {
                    ok: false,
                    status: 400,
                    clone() {
                        return this
                    },
                    json: async () => ({
                        error: 'Schwab authorization state is missing. Start the connection flow again.',
                        code: 'BAD_REQUEST',
                        hint: 'Return to Mahita and click Connect Schwab Portal again.',
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=status') {
                return {
                    ok: true,
                    json: async () => ({ isConnected: true }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        const postMessage = vi.fn()
        const close = vi.fn()
        Object.defineProperty(window, 'opener', {
            value: { postMessage },
            configurable: true,
        })
        Object.defineProperty(window, 'close', {
            value: close,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /authorization complete/i })).toBeInTheDocument()
        )

        expect(screen.getByText(/already completed/i)).toBeInTheDocument()
        expect(postMessage).toHaveBeenCalledWith(
            { type: 'schwab-auth-complete', success: true },
            window.location.origin
        )
    })

    it('closes popup-intended success even when the opener relationship is missing', async () => {
        searchParams.set('code', 'popup-auth-code')
        searchParams.set('state', 'popup-state-123')
        window.sessionStorage.setItem('mahita.schwab.popup.flow', 'popup')

        const close = vi.fn()

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            clone() {
                return this
            },
            json: async () => ({ success: true }),
        })))

        Object.defineProperty(window, 'opener', {
            value: null,
            configurable: true,
        })
        Object.defineProperty(window, 'close', {
            value: close,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /authorization complete/i })).toBeInTheDocument()
        )

        await waitFor(() => expect(close).toHaveBeenCalled(), { timeout: 1_500 })
    })

    it('does not try to close the window when the callback owns the full window', async () => {
        searchParams.set('code', 'full-window-auth-code')
        searchParams.set('state', 'full-window-state-123')

        const close = vi.fn()

        vi.stubGlobal('fetch', vi.fn(async () => ({
            ok: true,
            clone() {
                return this
            },
            json: async () => ({ success: true }),
        })))

        Object.defineProperty(window, 'opener', {
            value: null,
            configurable: true,
        })
        Object.defineProperty(window, 'close', {
            value: close,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /authorization complete/i })).toBeInTheDocument()
        )

        await new Promise((resolve) => window.setTimeout(resolve, 600))
        expect(close).not.toHaveBeenCalled()
    })

    it('shows a stale-window recovery message when state is missing and no connection was completed', async () => {
        searchParams.set('code', 'stale-auth-code')
        searchParams.set('state', 'expired-state-456')

        vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/schwab/auth') {
                return {
                    ok: false,
                    status: 400,
                    clone() {
                        return this
                    },
                    json: async () => ({
                        error: 'Schwab authorization state is missing. Start the connection flow again.',
                        code: 'BAD_REQUEST',
                        hint: 'Return to Mahita and click Connect Schwab Portal again.',
                    }),
                }
            }

            if (url === '/api/schwab/auth?action=status') {
                return {
                    ok: true,
                    json: async () => ({ isConnected: false }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        }))

        Object.defineProperty(window, 'opener', {
            value: null,
            configurable: true,
        })

        render(<SchwabCallbackPage />)

        await waitFor(() =>
            expect(screen.getByRole('heading', { name: /authorization failed/i })).toBeInTheDocument()
        )

        expect(screen.getByText(/click connect schwab portal again/i)).toBeInTheDocument()
    })
})
