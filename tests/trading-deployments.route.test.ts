import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const {
    getAppServerSessionMock,
    listStrategyDeploymentsMock,
    createStrategyDeploymentMock,
    getStrategyDeploymentMock,
    updateStrategyDeploymentMock,
    deleteStrategyDeploymentMock,
} = vi.hoisted(() => ({
    getAppServerSessionMock: vi.fn(),
    listStrategyDeploymentsMock: vi.fn(),
    createStrategyDeploymentMock: vi.fn(),
    getStrategyDeploymentMock: vi.fn(),
    updateStrategyDeploymentMock: vi.fn(),
    deleteStrategyDeploymentMock: vi.fn(),
}))

vi.mock('@/lib/server-session', () => ({
    getAppServerSession: getAppServerSessionMock,
}))

vi.mock('@/lib/strategy-deployments', () => ({
    listStrategyDeployments: listStrategyDeploymentsMock,
    createStrategyDeployment: createStrategyDeploymentMock,
    getStrategyDeployment: getStrategyDeploymentMock,
    updateStrategyDeployment: updateStrategyDeploymentMock,
    deleteStrategyDeployment: deleteStrategyDeploymentMock,
}))

import { GET as listDeployments, POST as createDeployment } from '@/app/api/trading/deployments/route'
import { GET as readDeployment, PATCH as patchDeployment, DELETE as removeDeployment } from '@/app/api/trading/deployments/[id]/route'

function createNextRequest(url: string, init?: RequestInit) {
    return Object.assign(new Request(url, init), {
        nextUrl: new URL(url),
    }) as unknown as NextRequest
}

describe('/api/trading/deployments routes', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('rejects unauthenticated deployment listing', async () => {
        getAppServerSessionMock.mockResolvedValue(null)

        const response = await listDeployments(
            createNextRequest('http://localhost/api/trading/deployments')
        )
        const payload = await response.json()

        expect(response.status).toBe(401)
        expect(payload.error).toMatch(/unauthorized/i)
    })

    it('creates a deployment for the signed-in user', async () => {
        getAppServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        createStrategyDeploymentMock.mockResolvedValue({
            id: 'deployment-1',
            name: 'AAPL 1d',
        })

        const response = await createDeployment(
            createNextRequest('http://localhost/api/trading/deployments', {
                method: 'POST',
                body: JSON.stringify({ name: 'AAPL 1d', symbol: 'AAPL', timeframe: '1d' }),
                headers: { 'Content-Type': 'application/json' },
            })
        )
        const payload = await response.json()

        expect(response.status).toBe(201)
        expect(createStrategyDeploymentMock).toHaveBeenCalledWith(
            'user-1',
            expect.objectContaining({ name: 'AAPL 1d', symbol: 'AAPL', timeframe: '1d' }),
            'http://localhost'
        )
        expect(payload.deployment).toMatchObject({ id: 'deployment-1', name: 'AAPL 1d' })
    })

    it('reads, updates, and deletes an existing deployment', async () => {
        getAppServerSessionMock.mockResolvedValue({ user: { id: 'user-1' } })
        getStrategyDeploymentMock.mockResolvedValue({ id: 'deployment-1', name: 'AAPL 1d' })
        updateStrategyDeploymentMock.mockResolvedValue({ id: 'deployment-1', status: 'paused' })

        const readResponse = await readDeployment(
            createNextRequest('http://localhost/api/trading/deployments/deployment-1'),
            { params: Promise.resolve({ id: 'deployment-1' }) }
        )
        const readPayload = await readResponse.json()
        expect(readResponse.status).toBe(200)
        expect(readPayload.deployment).toMatchObject({ id: 'deployment-1' })

        const patchResponse = await patchDeployment(
            createNextRequest('http://localhost/api/trading/deployments/deployment-1', {
                method: 'PATCH',
                body: JSON.stringify({ status: 'paused' }),
                headers: { 'Content-Type': 'application/json' },
            }),
            { params: Promise.resolve({ id: 'deployment-1' }) }
        )
        const patchPayload = await patchResponse.json()
        expect(patchResponse.status).toBe(200)
        expect(updateStrategyDeploymentMock).toHaveBeenCalledWith('user-1', 'deployment-1', { status: 'paused' }, 'http://localhost')
        expect(patchPayload.deployment).toMatchObject({ id: 'deployment-1', status: 'paused' })

        const deleteResponse = await removeDeployment(
            createNextRequest('http://localhost/api/trading/deployments/deployment-1', {
                method: 'DELETE',
            }),
            { params: Promise.resolve({ id: 'deployment-1' }) }
        )
        const deletePayload = await deleteResponse.json()

        expect(deleteResponse.status).toBe(200)
        expect(deleteStrategyDeploymentMock).toHaveBeenCalledWith('user-1', 'deployment-1')
        expect(deletePayload).toMatchObject({ success: true })
    })
})
