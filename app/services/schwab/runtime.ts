import prisma from '@/lib/prisma'
import { getSchwabClient, SchwabClient } from './client'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

function getCallbackUrl(): string {
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:6244'
    return `${baseUrl.replace(/\/$/, '')}/schwab/callback`
}

export async function getRuntimeSchwabClient(): Promise<SchwabClient | null> {
    return getRuntimeSchwabClientWithOptions()
}

export async function getRuntimeSchwabClientWithOptions(options: { forceRefresh?: boolean } = {}): Promise<SchwabClient | null> {
    if (process.env.USE_MOCK_DATA === 'true') {
        return getSchwabClient({
            clientId: 'mock-client',
            clientSecret: 'mock-secret',
            callbackUrl: getCallbackUrl(),
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
        })
    }

    const config = await prisma.schwabConfig.findFirst({
        where: {
            clientId: { not: '' },
            accessToken: { not: null }
        },
        orderBy: { updatedAt: 'desc' }
    })

    if (!config?.clientId || !config.accessToken) {
        return null
    }

    const client = getSchwabClient({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        callbackUrl: getCallbackUrl(),
        accessToken: config.accessToken,
        refreshToken: config.refreshToken || undefined,
        accessTokenExpiry: config.accessTokenExpiry || undefined,
        refreshTokenExpiry: config.refreshTokenExpiry || undefined
    })

    const accessTokenExpiresSoon = !!config.accessTokenExpiry && (config.accessTokenExpiry.getTime() - Date.now() < EXPIRY_BUFFER_MS)
    const shouldRefresh = options.forceRefresh || accessTokenExpiresSoon

    if (!shouldRefresh) {
        return client
    }

    if (!config.refreshToken || (config.refreshTokenExpiry && config.refreshTokenExpiry.getTime() <= Date.now())) {
        return client
    }

    try {
        const refreshed = await client.refreshAccessToken(config.refreshToken)
        const accessTokenExpiry = new Date(Date.now() + refreshed.expires_in * 1000)
        const refreshTokenExpiry = new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)

        await prisma.schwabConfig.update({
            where: { id: config.id },
            data: {
                accessToken: refreshed.access_token,
                refreshToken: refreshed.refresh_token || config.refreshToken,
                accessTokenExpiry,
                refreshTokenExpiry
            }
        })

        client.setAccessToken(
            refreshed.access_token,
            refreshed.refresh_token || config.refreshToken,
            refreshed.expires_in,
            refreshed.refresh_token_expires_in
        )
    } catch (error) {
        console.error('[SchwabRuntime] Failed to refresh runtime token:', error)
    }

    return client
}
