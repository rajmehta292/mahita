import prisma from '@/lib/prisma'

export class UsageTracker {
    static async track(userId: string, provider: string, modelId: string, tokens: number, isByok: boolean) {
        return await prisma.aIUsage.create({
            data: {
                userId,
                provider,
                modelId,
                tokenCount: tokens,
                isByok,
                metadata: '{}'
            }
        })
    }

    static async getUsage(userId: string) {
        const usage = await prisma.aIUsage.aggregate({
            where: { userId },
            _sum: { tokenCount: true },
            _count: { id: true }
        })
        return {
            totalTokens: usage._sum.tokenCount || 0,
            requestCount: usage._count.id || 0
        }
    }
}
