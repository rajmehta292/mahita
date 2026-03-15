import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    getServerSessionMock,
    listStrategiesMock,
    getUserPreferencesMock,
} = vi.hoisted(() => ({
    getServerSessionMock: vi.fn(),
    listStrategiesMock: vi.fn(),
    getUserPreferencesMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
    getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}))

vi.mock('@/lib/strategy-library', () => ({
    listStrategies: listStrategiesMock,
}))

vi.mock('@/lib/user-preferences', () => ({
    getUserPreferences: getUserPreferencesMock,
}))

import { GET } from '@/app/api/indicators/catalog/route'

describe('/api/indicators/catalog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects unauthenticated catalog access', async () => {
        getServerSessionMock.mockResolvedValue(null)

        const response = await GET()
        const payload = await response.json()

        expect(response.status).toBe(401)
        expect(payload.error).toMatch(/unauthorized/i)
    })

    it('returns built-ins, favorites, and saved strategies', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        getUserPreferencesMock.mockResolvedValue({ indicatorFavorites: '["volume","macd"]' })
        listStrategiesMock.mockResolvedValue([
            {
                id: 'strategy-1',
                name: 'Momentum Stack',
                description: 'Chart-attached strategy',
                symbol: 'AAPL',
                timeframe: '1d',
                latestVersionId: 'version-2',
                versions: [{ id: 'version-2' }],
                workspaceSession: { autosaveRevision: 3, updatedAt: '2026-03-14T00:00:00.000Z' },
                updatedAt: '2026-03-14T00:00:00.000Z',
            },
        ])

        const response = await GET()
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(payload.favorites).toEqual(['volume', 'macd'])
        expect(payload.indicators.some((indicator: { id: string }) => indicator.id === 'volume')).toBe(true)
        expect(payload.strategies).toEqual([
            expect.objectContaining({
                id: 'strategy-1',
                name: 'Momentum Stack',
                latestVersionId: 'version-2',
                versionCount: 1,
                workspaceRevision: 3,
            }),
        ])
    })
})
