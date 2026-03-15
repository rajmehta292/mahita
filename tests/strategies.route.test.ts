import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
    getServerSessionMock,
    listStrategiesMock,
    saveStrategyWorkspaceSessionMock,
    getStrategyByIdMock,
    createStrategyVersionMock,
    restoreStrategyVersionToWorkspaceMock,
    deleteStrategyVersionMock,
    deleteStrategyLibraryEntryMock,
} = vi.hoisted(() => ({
    getServerSessionMock: vi.fn(),
    listStrategiesMock: vi.fn(),
    saveStrategyWorkspaceSessionMock: vi.fn(),
    getStrategyByIdMock: vi.fn(),
    createStrategyVersionMock: vi.fn(),
    restoreStrategyVersionToWorkspaceMock: vi.fn(),
    deleteStrategyVersionMock: vi.fn(),
    deleteStrategyLibraryEntryMock: vi.fn(),
}))

vi.mock('next-auth', () => ({
    getServerSession: getServerSessionMock,
}))

vi.mock('@/lib/auth', () => ({
    authOptions: {},
}))

vi.mock('@/lib/strategy-library', () => ({
    listStrategies: listStrategiesMock,
    saveStrategyWorkspaceSession: saveStrategyWorkspaceSessionMock,
    getStrategyById: getStrategyByIdMock,
    createStrategyVersion: createStrategyVersionMock,
    restoreStrategyVersionToWorkspace: restoreStrategyVersionToWorkspaceMock,
    deleteStrategyVersion: deleteStrategyVersionMock,
    deleteStrategyLibraryEntry: deleteStrategyLibraryEntryMock,
}))

import { GET as listStrategiesHandler, POST as createStrategyHandler } from '@/app/api/strategies/route'
import { GET as readStrategyHandler, PATCH as patchStrategyHandler, DELETE as deleteStrategyHandler } from '@/app/api/strategies/[id]/route'
import { GET as listVersionsHandler, POST as createVersionHandler } from '@/app/api/strategies/[id]/versions/route'
import { GET as readVersionHandler, DELETE as deleteVersionHandler } from '@/app/api/strategies/[id]/versions/[versionId]/route'
import { POST as restoreVersionHandler } from '@/app/api/strategies/[id]/versions/[versionId]/restore/route'
import { GET as readWorkspaceHandler, PATCH as patchWorkspaceHandler } from '@/app/api/strategies/[id]/workspace/route'

describe('/api/strategies routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects unauthenticated strategy listing', async () => {
        getServerSessionMock.mockResolvedValue(null)

        const response = await listStrategiesHandler()
        const payload = await response.json()

        expect(response.status).toBe(401)
        expect(payload.error).toMatch(/unauthorized/i)
    })

    it('lists and creates strategies for the signed-in user', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        listStrategiesMock.mockResolvedValue([{ id: 'strategy-1', name: 'AAPL Momentum' }])
        saveStrategyWorkspaceSessionMock.mockResolvedValue({ id: 'strategy-1', name: 'AAPL Momentum' })

        const listResponse = await listStrategiesHandler()
        const listPayload = await listResponse.json()
        expect(listResponse.status).toBe(200)
        expect(listPayload.strategies).toEqual([{ id: 'strategy-1', name: 'AAPL Momentum' }])

        const createResponse = await createStrategyHandler(new Request('http://localhost/api/strategies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'AAPL Momentum',
                symbol: 'AAPL',
                timeframe: '1d',
                source: '//@version=6',
            }),
        }))
        const createPayload = await createResponse.json()

        expect(createResponse.status).toBe(200)
        expect(saveStrategyWorkspaceSessionMock).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                name: 'AAPL Momentum',
                symbol: 'AAPL',
                timeframe: '1d',
                createInitialVersion: true,
            })
        )
        expect(createPayload.strategy).toMatchObject({ id: 'strategy-1' })
    })

    it('reads, updates, and deletes a strategy record', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        getStrategyByIdMock.mockResolvedValue({ id: 'strategy-1', name: 'AAPL Momentum', workspaceSession: null, versions: [] })
        saveStrategyWorkspaceSessionMock.mockResolvedValue({ id: 'strategy-1', name: 'Updated Strategy' })

        const readResponse = await readStrategyHandler(new Request('http://localhost/api/strategies/strategy-1'), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        expect(readResponse.status).toBe(200)

        const patchResponse = await patchStrategyHandler(new Request('http://localhost/api/strategies/strategy-1', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Updated Strategy',
                source: '//@version=6',
            }),
        }), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        const patchPayload = await patchResponse.json()

        expect(patchResponse.status).toBe(200)
        expect(saveStrategyWorkspaceSessionMock).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                strategyId: 'strategy-1',
                name: 'Updated Strategy',
                createInitialVersion: false,
            })
        )
        expect(patchPayload.strategy).toMatchObject({ id: 'strategy-1', name: 'Updated Strategy' })

        const deleteResponse = await deleteStrategyHandler(new Request('http://localhost/api/strategies/strategy-1', {
            method: 'DELETE',
        }), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        const deletePayload = await deleteResponse.json()

        expect(deleteResponse.status).toBe(200)
        expect(deleteStrategyLibraryEntryMock).toHaveBeenCalledWith('user-1', 'strategy-1')
        expect(deletePayload).toMatchObject({ success: true })
    })

    it('lists, creates, restores, reads, and deletes immutable versions', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        getStrategyByIdMock.mockResolvedValue({
            id: 'strategy-1',
            latestVersionId: 'version-2',
            versions: [
                { id: 'version-2', versionNumber: 2, label: 'v2' },
                { id: 'version-1', versionNumber: 1, label: 'Initial version' },
            ],
            workspaceSession: { id: 'session-1', autosaveRevision: 2 },
        })
        createStrategyVersionMock.mockResolvedValue({ id: 'strategy-1', latestVersionId: 'version-3' })
        restoreStrategyVersionToWorkspaceMock.mockResolvedValue({ id: 'strategy-1', latestVersionId: 'version-2' })
        deleteStrategyVersionMock.mockResolvedValue({ id: 'strategy-1', latestVersionId: 'version-2' })

        const listResponse = await listVersionsHandler(new Request('http://localhost/api/strategies/strategy-1/versions'), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        const listPayload = await listResponse.json()
        expect(listResponse.status).toBe(200)
        expect(listPayload.latestVersionId).toBe('version-2')
        expect(listPayload.versions).toHaveLength(2)

        const createResponse = await createVersionHandler(new Request('http://localhost/api/strategies/strategy-1/versions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                label: 'v3',
                source: '//@version=6',
                symbol: 'AAPL',
                timeframe: '1d',
            }),
        }), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        expect(createResponse.status).toBe(200)
        expect(createStrategyVersionMock).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({ strategyId: 'strategy-1', label: 'v3' })
        )

        const readVersionResponse = await readVersionHandler(new Request('http://localhost/api/strategies/strategy-1/versions/version-2'), {
            params: Promise.resolve({ id: 'strategy-1', versionId: 'version-2' }),
        })
        const readVersionPayload = await readVersionResponse.json()
        expect(readVersionResponse.status).toBe(200)
        expect(readVersionPayload.version).toMatchObject({ id: 'version-2' })

        const restoreResponse = await restoreVersionHandler(new Request('http://localhost/api/strategies/strategy-1/versions/version-2/restore', {
            method: 'POST',
        }), {
            params: Promise.resolve({ id: 'strategy-1', versionId: 'version-2' }),
        })
        expect(restoreResponse.status).toBe(200)
        expect(restoreStrategyVersionToWorkspaceMock).toHaveBeenCalledWith('user-1', 'strategy-1', 'version-2')

        const deleteVersionResponse = await deleteVersionHandler(new Request('http://localhost/api/strategies/strategy-1/versions/version-1', {
            method: 'DELETE',
        }), {
            params: Promise.resolve({ id: 'strategy-1', versionId: 'version-1' }),
        })
        expect(deleteVersionResponse.status).toBe(200)
        expect(deleteStrategyVersionMock).toHaveBeenCalledWith('user-1', 'strategy-1', 'version-1')
    })

    it('reads and updates the workspace session contract', async () => {
        getServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        getStrategyByIdMock.mockResolvedValue({
            id: 'strategy-1',
            latestVersionId: 'version-2',
            workspaceSession: {
                id: 'session-1',
                autosaveRevision: 4,
            },
        })
        saveStrategyWorkspaceSessionMock.mockResolvedValue({ id: 'strategy-1', workspaceSession: { id: 'session-1' } })

        const readResponse = await readWorkspaceHandler(new Request('http://localhost/api/strategies/strategy-1/workspace'), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })
        const readPayload = await readResponse.json()
        expect(readResponse.status).toBe(200)
        expect(readPayload).toMatchObject({
            workspaceSession: { id: 'session-1', autosaveRevision: 4 },
            latestVersionId: 'version-2',
        })

        const patchResponse = await patchWorkspaceHandler(new Request('http://localhost/api/strategies/strategy-1/workspace', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Autosaved Strategy',
                source: '//@version=6',
            }),
        }), {
            params: Promise.resolve({ id: 'strategy-1' }),
        })

        expect(patchResponse.status).toBe(200)
        expect(saveStrategyWorkspaceSessionMock).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({
                strategyId: 'strategy-1',
                name: 'Autosaved Strategy',
                createInitialVersion: true,
            })
        )
    })
})
