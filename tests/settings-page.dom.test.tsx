import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import SettingsPage from '@/app/settings/page'

vi.mock('@/app/components/Layout/MainLayout', () => ({
    MainLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('SettingsPage', () => {
    it('shows a typed runtime hint when saving credentials fails with a schema mismatch', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url === '/api/user/schwab-config' && !init?.method) {
                return {
                    ok: true,
                    json: async () => ({ success: true, config: null }),
                }
            }

            if (url === '/api/user/schwab-config' && init?.method === 'POST') {
                return {
                    ok: false,
                    json: async () => ({
                        error: 'Mahita detected a Prisma schema/client mismatch.',
                        code: 'RUNTIME_SCHEMA_MISMATCH',
                        status: 503,
                        details: { missingModels: ['brokerageConnection'] },
                        hint: 'Run `npx prisma generate` and restart the dev server.',
                        recoverable: true,
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<SettingsPage />)

        await waitFor(() => expect(screen.getByRole('heading', { name: /settings/i })).toBeInTheDocument())

        fireEvent.change(screen.getByPlaceholderText(/enter your schwab client id/i), {
            target: { value: 'demo-client-id' },
        })
        fireEvent.change(screen.getByPlaceholderText(/enter your schwab client secret/i), {
            target: { value: 'demo-client-secret' },
        })
        fireEvent.click(screen.getByRole('button', { name: /save credentials/i }))

        await waitFor(() =>
            expect(screen.getByText(/Prisma schema\/client mismatch/i)).toBeInTheDocument()
        )
        expect(screen.getByText(/Run `npx prisma generate` and restart the dev server\./i)).toBeInTheDocument()
    })
})
