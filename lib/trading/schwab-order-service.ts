import type { OrderRequest, SchwabClient } from '@/app/services/schwab/client'
import { getSchwabClient } from '@/app/services/schwab/client'
import { requireUserSchwabBrokerageConnection, resolveBrokerageAccountSelection } from '@/lib/brokerage-connections'
import { getSchwabCallbackUrl } from '@/lib/schwab-config'

export async function getUserSchwabTradingContext(userId: string): Promise<{
    client: SchwabClient
    defaultAccountId: string | null
}> {
    const resolved = await requireUserSchwabBrokerageConnection(userId)
    const { config, connection } = resolved

    if (!config.accessToken || !config.refreshToken) {
        throw new Error('Please connect your Schwab account first.')
    }

    const client = getSchwabClient({
        clientId: config.clientId,
        callbackUrl: getSchwabCallbackUrl(),
    })

    client.setAccessToken(config.accessToken, config.refreshToken)

    return {
        client,
        defaultAccountId: resolveBrokerageAccountSelection(connection, null),
    }
}

export async function submitUserSchwabOrder(
    userId: string,
    accountId: string | null | undefined,
    order: OrderRequest
) {
    const context = await getUserSchwabTradingContext(userId)
    const resolvedAccountId = accountId || context.defaultAccountId

    if (!resolvedAccountId) {
        throw new Error('No linked Schwab account is available for order submission.')
    }

    const response = await context.client.placeOrder(resolvedAccountId, order)
    return {
        accountId: resolvedAccountId,
        response,
    }
}
