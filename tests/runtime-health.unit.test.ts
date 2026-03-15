import prisma from '@/lib/prisma'
import {
    assertRequiredDiUiModels,
    assertRequiredRuntimeModels,
    getDiUiPrismaModelReadiness,
    getPrismaModelReadiness,
} from '@/lib/runtime-health'

describe('runtime health', () => {
    it('reports Prisma runtime model readiness', () => {
        const readiness = getPrismaModelReadiness()
        expect(Array.isArray(readiness.missingModels)).toBe(true)
        expect(readiness.readiness.brokerageConnection).toBe(true)
    })

    it('reports DI-UI Prisma model readiness', () => {
        const readiness = getDiUiPrismaModelReadiness()
        expect(Array.isArray(readiness.missingModels)).toBe(true)
        expect(readiness.readiness.ingestionProfile).toBe(true)
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

    it('throws a typed error when a required DI-UI model is unavailable', () => {
        const client = prisma as unknown as Record<string, unknown>
        const original = client.ingestionProfile

        Object.defineProperty(client, 'ingestionProfile', {
            configurable: true,
            value: undefined,
        })

        try {
            expect(() => assertRequiredDiUiModels(['ingestionProfile'])).toThrow(
                /Prisma schema\/client mismatch/i
            )
        } finally {
            Object.defineProperty(client, 'ingestionProfile', {
                configurable: true,
                value: original,
            })
        }
    })
})
