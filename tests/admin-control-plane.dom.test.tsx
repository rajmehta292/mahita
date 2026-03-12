import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AdminControlPlane } from '@/app/components/Admin/AdminControlPlane'

const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        replace: replaceMock,
    }),
    useSearchParams: () => new URLSearchParams('tab=overview'),
}))

describe('AdminControlPlane', () => {
    beforeEach(() => {
        replaceMock.mockReset()
    })

    it('loads overview first, then lazily loads provider data when the tab is opened', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input)

            if (url === '/api/admin/overview') {
                return {
                    ok: true,
                    json: async () => ({
                        userSummary: { totalUsers: 2, usersWithBrokerage: 1, activePreferenceProfiles: 2 },
                        runtimeSummary: {
                            runtimeHealth: {
                                ok: true,
                                runtime: {
                                    prismaClientReady: true,
                                    missingPrismaModels: [],
                                    insecureUserBrokeragePlatformFallbackEnabled: false,
                                    hasDedicatedAppSecretKey: true,
                                },
                                providerPool: {
                                    marketDataMemberCount: 0,
                                    superuserBridgeCandidates: 1,
                                },
                            },
                            platformDataProviderCount: 0,
                            tokenHealth: { isValid: false, error: 'No provider pool yet' },
                            availableProviders: ['schwab'],
                            continuousIngest: {
                                running: false,
                                startedAt: null,
                                lastCompletedAt: null,
                                cycleCount: 0,
                                currentPhase: 'idle',
                                providerOverride: null,
                                intervalMs: 60000,
                                lastError: null,
                            },
                        },
                        providerPool: [],
                        latestAudits: [],
                    }),
                }
            }

            if (url === '/api/admin/provider-pool') {
                return {
                    ok: true,
                    json: async () => ({
                        providerPool: [
                            {
                                id: 'member-1',
                                label: 'Raj Schwab fallback',
                                purpose: 'MARKET_DATA',
                                priority: 10,
                                weight: 1,
                                status: 'ACTIVE',
                                isPrimary: true,
                                credential: {
                                    id: 'cred-1',
                                    provider: 'schwab',
                                    label: 'Raj Schwab fallback',
                                    sourceType: 'USER_SCHWAB_CONFIG',
                                    isEnabled: true,
                                    linkedUser: {
                                        id: 'user-1',
                                        email: 'raj@example.com',
                                        name: 'Raj',
                                    },
                                },
                            },
                        ],
                    }),
                }
            }

            if (url === '/api/admin/users') {
                return {
                    ok: true,
                    json: async () => ({
                        users: [
                            {
                                id: 'user-1',
                                email: 'raj@example.com',
                                name: 'Raj',
                                role: 'SUPERUSER',
                                primaryBrokerageConnection: {
                                    id: 'brokerage-1',
                                    provider: 'SCHWAB',
                                    status: 'AUTHORIZED',
                                    lastSyncedAt: '2026-03-10T12:00:00.000Z',
                                    lastError: null,
                                    accountCount: 1,
                                    accessTokenExpiry: null,
                                    refreshTokenExpiry: null,
                                },
                                preferences: {
                                    selectedAccountId: 'acct-1',
                                    lastVisitedPath: '/dashboard',
                                    lastVisitedAt: '2026-03-10T12:00:00.000Z',
                                    lastSignInAt: '2026-03-10T12:00:00.000Z',
                                },
                            },
                        ],
                    }),
                }
            }

            if (url === '/api/admin/provider-pool' && init?.method === 'POST') {
                return {
                    ok: true,
                    json: async () => ({
                        success: true,
                        member: {
                            id: 'member-1',
                            providerCredential: { id: 'cred-1' },
                        },
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<AdminControlPlane />)

        await waitFor(() => expect(screen.getByText('Admin Control')).toBeInTheDocument())
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/overview', { cache: 'no-store' })
        expect(fetchMock).not.toHaveBeenCalledWith('/api/admin/provider-pool', { cache: 'no-store' })

        fireEvent.click(screen.getByRole('button', { name: /Provider Pool/i }))
        expect(replaceMock).toHaveBeenCalledWith('/admin?tab=providers')

        await waitFor(() => expect(screen.getByText('Promote Provider')).toBeInTheDocument())
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/provider-pool', { cache: 'no-store' })
        expect(fetchMock).toHaveBeenCalledWith('/api/admin/users', { cache: 'no-store' })
        expect(screen.getByText('Raj Schwab fallback')).toBeInTheDocument()

        fireEvent.click(screen.getByText('Use selected user for market-data pool'))

        await waitFor(() =>
            expect(fetchMock).toHaveBeenCalledWith(
                '/api/admin/provider-pool',
                expect.objectContaining({ method: 'POST' })
            )
        )
    })

    it('keeps the admin shell up when a later tab fails', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/admin/overview') {
                return {
                    ok: true,
                    json: async () => ({
                        userSummary: { totalUsers: 1, usersWithBrokerage: 0, activePreferenceProfiles: 1 },
                        runtimeSummary: {
                            runtimeHealth: {
                                ok: true,
                                runtime: {
                                    prismaClientReady: true,
                                    missingPrismaModels: [],
                                    insecureUserBrokeragePlatformFallbackEnabled: false,
                                    hasDedicatedAppSecretKey: true,
                                },
                                providerPool: {
                                    marketDataMemberCount: 0,
                                    superuserBridgeCandidates: 0,
                                },
                            },
                            platformDataProviderCount: 0,
                            tokenHealth: { isValid: true },
                            availableProviders: ['schwab'],
                            continuousIngest: {
                                running: false,
                                startedAt: null,
                                lastCompletedAt: null,
                                cycleCount: 0,
                                currentPhase: 'idle',
                                providerOverride: null,
                                intervalMs: 60000,
                                lastError: null,
                            },
                        },
                        providerPool: [],
                        latestAudits: [],
                    }),
                }
            }

            if (url === '/api/admin/audit-events') {
                return {
                    ok: false,
                    json: async () => ({
                        error: 'Audit route offline',
                        code: 'UPSTREAM_FETCH_FAILED',
                        status: 503,
                        details: null,
                        hint: null,
                        recoverable: true,
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<AdminControlPlane />)

        await waitFor(() => expect(screen.getByText('Admin Control')).toBeInTheDocument())
        expect(screen.getByText('1')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /Audit Log/i }))
        await waitFor(() => expect(screen.getByText('Audit route offline')).toBeInTheDocument())

        expect(screen.getByText('Admin Control')).toBeInTheDocument()
    })

    it('does not crash when a provider member is missing credential metadata', async () => {
        const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
            const url = String(input)

            if (url === '/api/admin/overview') {
                return {
                    ok: true,
                    json: async () => ({
                        userSummary: { totalUsers: 1, usersWithBrokerage: 1, activePreferenceProfiles: 1 },
                        runtimeSummary: {
                            runtimeHealth: {
                                ok: true,
                                runtime: {
                                    prismaClientReady: true,
                                    missingPrismaModels: [],
                                    insecureUserBrokeragePlatformFallbackEnabled: false,
                                    hasDedicatedAppSecretKey: true,
                                },
                                providerPool: {
                                    marketDataMemberCount: 1,
                                    superuserBridgeCandidates: 1,
                                },
                            },
                            platformDataProviderCount: 1,
                            tokenHealth: { isValid: true },
                            availableProviders: ['schwab'],
                            continuousIngest: {
                                running: false,
                                startedAt: null,
                                lastCompletedAt: null,
                                cycleCount: 0,
                                currentPhase: 'idle',
                                providerOverride: null,
                                intervalMs: 60000,
                                lastError: null,
                            },
                        },
                        providerPool: [],
                        latestAudits: [],
                    }),
                }
            }

            if (url === '/api/admin/provider-pool') {
                return {
                    ok: true,
                    json: async () => ({
                        providerPool: [
                            {
                                id: 'member-1',
                                label: 'Fallback member',
                                purpose: 'MARKET_DATA',
                                priority: 10,
                                weight: 1,
                                status: 'ACTIVE',
                                isPrimary: true,
                                credential: undefined,
                            },
                        ],
                    }),
                }
            }

            if (url === '/api/admin/users') {
                return {
                    ok: true,
                    json: async () => ({
                        users: [],
                    }),
                }
            }

            throw new Error(`Unexpected fetch: ${url}`)
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<AdminControlPlane />)

        await waitFor(() => expect(screen.getByText('Admin Control')).toBeInTheDocument())
        fireEvent.click(screen.getByRole('button', { name: /Provider Pool/i }))

        await waitFor(() => expect(screen.getByText('Fallback member')).toBeInTheDocument())
        expect(screen.getByText(/unknown · unknown · priority 10/i)).toBeInTheDocument()
    })
})
