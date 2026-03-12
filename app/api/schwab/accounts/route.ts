import { NextResponse } from 'next/server'
import { getSchwabClient } from '@/app/services/schwab/client'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import {
  getSchwabCallbackUrl,
} from '@/lib/schwab-config'
import {
  persistBrokerageConnectionTokens,
  requireUserSchwabBrokerageConnection,
  syncBrokerageAccountsFromSchwab,
} from '@/lib/brokerage-connections'

interface AccountNumberMapping {
  accountNumber?: string
  hashValue?: string
}

interface SchwabSecuritiesAccount {
  accountId?: string
  accountNumber?: string
  hashValue?: string
  type?: string
}

interface SchwabAccountRecord {
  securitiesAccount?: SchwabSecuritiesAccount
}

export async function GET() {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const response = await client.getAccounts()
      return NextResponse.json({ success: true, accounts: response.data })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured' },
        { status: 400 }
      )
    }

    const { connection, config } = resolved

    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json({ error: 'Schwab Client ID or Secret missing' }, { status: 400 })
    }

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json(
        { error: 'Please connect your Schwab account first' },
        { status: 400 }
      )
    }

    const callbackUrl = getSchwabCallbackUrl()
    const client = getSchwabClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret || undefined,
      callbackUrl
    })

    client.setAccessToken(
      config.accessToken,
      config.refreshToken
    )

    // Check if token is expired or near expiry (less than 5 mins)
    const isExpired = config.accessTokenExpiry && (config.accessTokenExpiry.getTime() - Date.now() < 300000)

    if (isExpired) {
      console.log('Schwab token near expiry, refreshing...')
      try {
        const newTokens = await client.refreshAccessToken(config.refreshToken)

        await persistBrokerageConnectionTokens({
          brokerageConnectionId: connection.id,
          accessToken: newTokens.access_token,
          refreshToken: newTokens.refresh_token || config.refreshToken,
          accessTokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
          refreshTokenExpiry: newTokens.refresh_token_expires_in
            ? new Date(Date.now() + newTokens.refresh_token_expires_in * 1000)
            : config.refreshTokenExpiry,
        })

        client.setAccessToken(newTokens.access_token, newTokens.refresh_token || config.refreshToken)
        console.log('Schwab token refreshed successfully')
      } catch (refreshError) {
        console.error('Failed to refresh Schwab token:', refreshError)
        return NextResponse.json({ error: 'Session expired. Please reconnect Schwab.' }, { status: 401 })
      }
    }

    const [response, numbersResponse] = await Promise.all([
      client.getAccounts(),
      client.getAccountNumbers()
    ])

    const accountNumbers = (numbersResponse.data || []) as AccountNumberMapping[]
    const hashMap = new Map(accountNumbers.map((accountNumber) => [accountNumber.accountNumber, accountNumber.hashValue]))

    const mergedAccounts = ((response.data || []) as SchwabAccountRecord[]).map((account) => {
      const sAcc = account.securitiesAccount || {}
      if (sAcc.accountNumber && hashMap.has(sAcc.accountNumber)) {
        sAcc.hashValue = hashMap.get(sAcc.accountNumber)
        // Ensure accountId is present for UI compatibility
        sAcc.accountId = sAcc.accountNumber
      }
      return account
    })

    if (mergedAccounts && Array.isArray(mergedAccounts)) {
      console.log(`[Schwab Accounts] Found ${mergedAccounts.length} accounts`)
      mergedAccounts.forEach((account, index) => {
        const sAcc = account.securitiesAccount
        console.log(`  Account ${index}: ID=${sAcc?.accountId}, Hash=${sAcc?.hashValue ? 'Present' : 'MISSING'}`)
      })

      await syncBrokerageAccountsFromSchwab(connection.id, mergedAccounts)
    }

    return NextResponse.json({
      success: true,
      accounts: mergedAccounts,
      connectionId: connection.id,
    })
  } catch (error: unknown) {
    const errorResponse = error instanceof Error && 'response' in error
      ? (error as Error & { response?: { status?: number, data?: unknown } }).response
      : undefined
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch accounts'
    console.error('Schwab accounts route error:', errorResponse?.data || errorMessage)
    return NextResponse.json(
      {
        error: errorMessage,
        details: errorResponse?.data
      },
      { status: errorResponse?.status || 500 }
    )
  }
}
