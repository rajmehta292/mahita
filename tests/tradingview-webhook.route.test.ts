import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const { ingestTradingViewWebhookMock } = vi.hoisted(() => ({
    ingestTradingViewWebhookMock: vi.fn(),
}))

vi.mock('@/lib/strategy-deployments', () => ({
    ingestTradingViewWebhook: ingestTradingViewWebhookMock,
}))

import { POST } from '@/app/api/tradingview/webhook/[secret]/route'

describe('/api/tradingview/webhook/[secret]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('passes parsed JSON webhook payloads to the deployment pipeline', async () => {
        ingestTradingViewWebhookMock.mockResolvedValue({
            deploymentId: 'deployment-1',
            status: 'executed',
        })

        const response = await POST(
            new Request('http://localhost/api/tradingview/webhook/test-secret', {
                method: 'POST',
                body: JSON.stringify({ action: 'buy', symbol: 'AAPL' }),
                headers: { 'Content-Type': 'application/json' },
            }) as unknown as NextRequest,
            { params: Promise.resolve({ secret: 'test-secret' }) }
        )
        const payload = await response.json()

        expect(response.status).toBe(200)
        expect(ingestTradingViewWebhookMock).toHaveBeenCalledWith(
            'test-secret',
            { action: 'buy', symbol: 'AAPL' },
            JSON.stringify({ action: 'buy', symbol: 'AAPL' })
        )
        expect(payload).toMatchObject({
            success: true,
            result: { deploymentId: 'deployment-1', status: 'executed' },
        })
    })

    it('falls back to a message payload for non-JSON webhook bodies', async () => {
        ingestTradingViewWebhookMock.mockResolvedValue({
            deploymentId: 'deployment-2',
            status: 'logged',
        })

        await POST(
            new Request('http://localhost/api/tradingview/webhook/plain-secret', {
                method: 'POST',
                body: 'BUY AAPL NOW',
                headers: { 'Content-Type': 'text/plain' },
            }) as unknown as NextRequest,
            { params: Promise.resolve({ secret: 'plain-secret' }) }
        )

        expect(ingestTradingViewWebhookMock).toHaveBeenCalledWith(
            'plain-secret',
            { message: 'BUY AAPL NOW' },
            'BUY AAPL NOW'
        )
    })
})
