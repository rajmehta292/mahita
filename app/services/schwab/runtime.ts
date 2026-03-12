import { getSchwabClient, SchwabClient } from './client'
import { getSchwabCallbackUrl } from '@/lib/schwab-config'
import {
    allowInsecureUserBrokeragePlatformFallback,
    getPlatformCredentialIsolationError,
} from '@/lib/security/platform-security'
import {
    getRuntimeSchwabProviderMembers,
    persistRuntimeSchwabTokens,
    resolveRuntimeSchwabCredential,
} from '@/lib/provider-credentials'
import { resolveSchwabConfig } from '@/lib/schwab-config'
import { getSuperuserRuntimeBrokerageBridge } from '@/lib/brokerage-connections'

const EXPIRY_BUFFER_MS = 5 * 60 * 1000

export async function getRuntimeSchwabClient(): Promise<SchwabClient | null> {
    return getRuntimeSchwabClientWithOptions()
}

export async function getRuntimeSchwabClientWithOptions(options: { forceRefresh?: boolean } = {}): Promise<SchwabClient | null> {
    if (process.env.USE_MOCK_DATA === 'true') {
        return getSchwabClient({
            clientId: 'mock-client',
            clientSecret: 'mock-secret',
            callbackUrl: getSchwabCallbackUrl(),
            accessToken: 'mock-access-token',
            refreshToken: 'mock-refresh-token'
        })
    }

    const providerMembers = await getRuntimeSchwabProviderMembers()
    const primaryMember = providerMembers.find((member) => member.isPrimary) ?? providerMembers[0]

    if (!primaryMember) {
        if (!allowInsecureUserBrokeragePlatformFallback()) {
            console.warn(`[SchwabRuntime] ${getPlatformCredentialIsolationError()}`)
            return null
        }

        const bridgeConnection = await getSuperuserRuntimeBrokerageBridge()
        const config = bridgeConnection?.linkedSchwabConfig

        if (!config?.clientId || !config.accessToken) {
            return null
        }

        const resolvedConfig = resolveSchwabConfig(config)
        const client = getSchwabClient({
            clientId: resolvedConfig.clientId,
            clientSecret: resolvedConfig.clientSecret || undefined,
            callbackUrl: getSchwabCallbackUrl(),
            accessToken: resolvedConfig.accessToken || undefined,
            refreshToken: resolvedConfig.refreshToken || undefined,
            accessTokenExpiry: resolvedConfig.accessTokenExpiry || undefined,
            refreshTokenExpiry: resolvedConfig.refreshTokenExpiry || undefined
        })

        return client
    }

    const resolvedCredential = resolveRuntimeSchwabCredential(primaryMember)
    const resolvedConfig = resolvedCredential.config

    if (!resolvedConfig.clientId) {
        console.warn('[SchwabRuntime] Primary provider credential is missing clientId.')
        return null
    }

    const client = getSchwabClient({
        clientId: resolvedConfig.clientId,
        clientSecret: resolvedConfig.clientSecret || undefined,
        callbackUrl: getSchwabCallbackUrl(),
        accessToken: resolvedConfig.accessToken || undefined,
        refreshToken: resolvedConfig.refreshToken || undefined,
        accessTokenExpiry: resolvedConfig.accessTokenExpiry || undefined,
        refreshTokenExpiry: resolvedConfig.refreshTokenExpiry || undefined
    })

    const accessTokenExpiresSoon = !!resolvedConfig.accessTokenExpiry && (resolvedConfig.accessTokenExpiry.getTime() - Date.now() < EXPIRY_BUFFER_MS)
    const shouldRefresh = options.forceRefresh || accessTokenExpiresSoon

    if (!shouldRefresh) {
        return client
    }

    if (!resolvedConfig.refreshToken || (resolvedConfig.refreshTokenExpiry && resolvedConfig.refreshTokenExpiry.getTime() <= Date.now())) {
        return client
    }

    try {
        const refreshed = await client.refreshAccessToken(resolvedConfig.refreshToken)
        const accessTokenExpiry = new Date(Date.now() + refreshed.expires_in * 1000)
        const refreshTokenExpiry = refreshed.refresh_token_expires_in
            ? new Date(Date.now() + refreshed.refresh_token_expires_in * 1000)
            : resolvedConfig.refreshTokenExpiry ?? null

        await persistRuntimeSchwabTokens({
            member: primaryMember,
            accessToken: refreshed.access_token,
            refreshToken: refreshed.refresh_token || resolvedConfig.refreshToken,
            accessTokenExpiry,
            refreshTokenExpiry,
        })

        client.setAccessToken(
            refreshed.access_token,
            refreshed.refresh_token || resolvedConfig.refreshToken,
            refreshed.expires_in,
            refreshed.refresh_token_expires_in
        )
    } catch (error) {
        console.error('[SchwabRuntime] Failed to refresh runtime token:', error)
    }

    return client
}

export async function getSchwabClientPool(): Promise<SchwabClient[]> {
    if (process.env.USE_MOCK_DATA === 'true') {
        const mock = await getRuntimeSchwabClient()
        return mock ? [mock] : []
    }

    const pool: SchwabClient[] = []
    const providerMembers = await getRuntimeSchwabProviderMembers()

    for (const member of providerMembers) {
        const resolvedConfig = resolveRuntimeSchwabCredential(member).config
        if (!resolvedConfig.clientId || !resolvedConfig.accessToken) {
            continue
        }
        const client = getSchwabClient({
            clientId: resolvedConfig.clientId,
            clientSecret: resolvedConfig.clientSecret || undefined,
            callbackUrl: getSchwabCallbackUrl(),
            accessToken: resolvedConfig.accessToken!,
            refreshToken: resolvedConfig.refreshToken || undefined,
            accessTokenExpiry: resolvedConfig.accessTokenExpiry || undefined,
            refreshTokenExpiry: resolvedConfig.refreshTokenExpiry || undefined
        })
        pool.push(client)
    }

    if (pool.length === 0 && allowInsecureUserBrokeragePlatformFallback()) {
        const bridgeConnection = await getSuperuserRuntimeBrokerageBridge()
        const config = bridgeConnection?.linkedSchwabConfig

        if (config) {
            const resolvedConfig = resolveSchwabConfig(config)
            const client = getSchwabClient({
                clientId: resolvedConfig.clientId,
                clientSecret: resolvedConfig.clientSecret || undefined,
                callbackUrl: getSchwabCallbackUrl(),
                accessToken: resolvedConfig.accessToken!,
                refreshToken: resolvedConfig.refreshToken || undefined,
                accessTokenExpiry: resolvedConfig.accessTokenExpiry || undefined,
                refreshTokenExpiry: resolvedConfig.refreshTokenExpiry || undefined
            })
            pool.push(client)
        }
    }

    if (pool.length === 0 && !allowInsecureUserBrokeragePlatformFallback()) {
        console.warn(`[SchwabRuntime] ${getPlatformCredentialIsolationError()}`)
    }

    return pool
}

export async function checkSchwabTokenHealth(): Promise<{ isValid: boolean; error?: string }> {
    if (process.env.USE_MOCK_DATA === 'true') return { isValid: true }

    const providerMembers = await getRuntimeSchwabProviderMembers()
    const primaryMember = providerMembers.find((member) => member.isPrimary) ?? providerMembers[0]

    if (!primaryMember) {
        if (!allowInsecureUserBrokeragePlatformFallback()) {
            return {
                isValid: false,
                error: getPlatformCredentialIsolationError(),
            }
        }

        const bridgeConnection = await getSuperuserRuntimeBrokerageBridge()
        const config = bridgeConnection?.linkedSchwabConfig

        if (!config || !config.accessToken) {
            return { isValid: false, error: 'No active Schwab configuration or access token found.' }
        }

        const resolvedConfig = resolveSchwabConfig(config)
        const now = Date.now()

        if (resolvedConfig.refreshTokenExpiry && resolvedConfig.refreshTokenExpiry.getTime() <= now) {
            return { isValid: false, error: 'Schwab Refresh Token is permanently expired. User must physically re-authenticate.' }
        }

        if (resolvedConfig.accessTokenExpiry && (resolvedConfig.accessTokenExpiry.getTime() - now < EXPIRY_BUFFER_MS)) {
            try {
                const client = getSchwabClient({
                    clientId: resolvedConfig.clientId,
                    clientSecret: resolvedConfig.clientSecret || undefined,
                    callbackUrl: getSchwabCallbackUrl(),
                    accessToken: resolvedConfig.accessToken || undefined
                })
                if (!resolvedConfig.refreshToken) throw new Error('No refresh token available')

                await client.refreshAccessToken(resolvedConfig.refreshToken)
            } catch (error) {
                return { isValid: false, error: `Proactive Pre-Flight token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}` }
            }
        }

        return { isValid: true }
    }

    const resolvedConfig = resolveRuntimeSchwabCredential(primaryMember).config
    const now = Date.now()

    if (!resolvedConfig.clientId) {
        return { isValid: false, error: 'Primary provider credential is missing clientId.' }
    }

    // 1. Is the master refresh token permanently expired?
    if (resolvedConfig.refreshTokenExpiry && resolvedConfig.refreshTokenExpiry.getTime() <= now) {
        return { isValid: false, error: 'Schwab Refresh Token is permanently expired. User must physically re-authenticate.' }
    }

    // 2. Is the immediate access token expired or close to expiry? 
    if (resolvedConfig.accessTokenExpiry && (resolvedConfig.accessTokenExpiry.getTime() - now < EXPIRY_BUFFER_MS)) {
        try {
            // Attempt to refresh it right now rather than letting the engine sweep fail
            const client = getSchwabClient({
                clientId: resolvedConfig.clientId,
                clientSecret: resolvedConfig.clientSecret || undefined,
                callbackUrl: getSchwabCallbackUrl(),
                accessToken: resolvedConfig.accessToken || undefined
            })
            if (!resolvedConfig.refreshToken) throw new Error('No refresh token available')

            await client.refreshAccessToken(resolvedConfig.refreshToken)
        } catch (error) {
            return { isValid: false, error: `Proactive Pre-Flight token refresh failed: ${error instanceof Error ? error.message : 'Unknown'}` }
        }
    }

    return { isValid: true }
}
