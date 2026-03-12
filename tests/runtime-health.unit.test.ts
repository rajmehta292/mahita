import prisma from '@/lib/prisma'
import { assertRequiredRuntimeModels, getPrismaModelReadiness } from '@/lib/runtime-health'

describe('runtime health', () => {
    it('reports Prisma runtime model readiness', () => {
        const readiness = getPrismaModelReadiness()
        expect(Array.isArray(readiness.missingModels)).toBe(true)
        expect(readiness.readiness.brokerageConnection).toBe(true)
    })

    it('throws a typed error when a required runtime model is unavailable', () => {
        const client = prisma as unknown as Record<string, unknown>
        const original = client.brokerageConnection

        Object.defineProperty(client, 'brokerageConnection', {
            configurable: true,
            value: undefined,
        })

        try {
            expect(() => assertRequiredRuntimeModels(['brokerageConnection'])).toThrow(
                /Prisma schema\/client mismatch/i
            )
        } finally {
            Object.defineProperty(client, 'brokerageConnection', {
                configurable: true,
                value: original,
            })
        }
    })
})
