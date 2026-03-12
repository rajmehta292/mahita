import { NextResponse } from 'next/server'
import { getSchwabClient } from '@/app/services/schwab/client'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import { getSchwabCallbackUrl } from '@/lib/schwab-config'
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

interface DashboardAccountSummary {
  accountId: string
  accountKey: string
  type: string
  displayName: string
  cashAndCashInvestments: number
  accountValue: number
  dayChange: number
  dayChangePercent: number
  positionsCount: number
  holdingsMarketValue: number
  totalCostBasis: number
  totalUnrealizedGainLoss: number
}

function formatAccountDisplayName(accountId: string, type: string) {
  return `${type} • ${accountId.slice(-4)}`
}

function createAccountSummary(input: {
  accountId: string
  accountKey: string
  type: string
  cashAndCashInvestments: number
  liquidationValue: number
  dayChange: number
  holdingsMarketValue: number
  totalCostBasis: number
  positionsCount: number
}): DashboardAccountSummary {
  const accountValue =
    input.liquidationValue || input.cashAndCashInvestments + input.holdingsMarketValue
  const totalUnrealizedGainLoss = input.holdingsMarketValue - input.totalCostBasis

  return {
    accountId: input.accountId,
    accountKey: input.accountKey,
    type: input.type,
    displayName: formatAccountDisplayName(input.accountId, input.type),
    cashAndCashInvestments: input.cashAndCashInvestments,
    accountValue,
    dayChange: input.dayChange,
    dayChangePercent: accountValue > 0 ? (input.dayChange / accountValue) * 100 : 0,
    positionsCount: input.positionsCount,
    holdingsMarketValue: input.holdingsMarketValue,
    totalCostBasis: input.totalCostBasis,
    totalUnrealizedGainLoss,
  }
}

export async function GET() {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      callbackUrl,
    })

    client.setAccessToken(config.accessToken, config.refreshToken)

    const isExpired =
      config.accessTokenExpiry &&
      config.accessTokenExpiry.getTime() - Date.now() < 300000

    if (isExpired) {
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
    }

    const [accountsResponse, numbersResponse] = await Promise.all([
      client.getAccounts(),
      client.getAccountNumbers(),
    ])

    const accountNumbers = (numbersResponse.data || []) as AccountNumberMapping[]
    const hashMap = new Map(accountNumbers.map((record) => [record.accountNumber, record.hashValue]))

    const mergedAccounts = ((accountsResponse.data || []) as SchwabAccountRecord[]).map((account) => {
      const securitiesAccount = account.securitiesAccount || {}
      if (securitiesAccount.accountNumber && hashMap.has(securitiesAccount.accountNumber)) {
        securitiesAccount.hashValue = hashMap.get(securitiesAccount.accountNumber)
      }
      if (!securitiesAccount.accountId && securitiesAccount.accountNumber) {
        securitiesAccount.accountId = securitiesAccount.accountNumber
      }
      return account
    })

    await syncBrokerageAccountsFromSchwab(connection.id, mergedAccounts)

    const summaries = (
      await Promise.all(
        mergedAccounts.map(async (account) => {
          const securitiesAccount = account.securitiesAccount
          const accountId = securitiesAccount?.accountId || securitiesAccount?.accountNumber
          const accountKey = securitiesAccount?.hashValue || accountId

          if (!accountId || !accountKey) {
            return null
          }

          try {
            const [positions, balance] = await Promise.all([
              client.getPositions(accountKey),
              client.getBalance(accountKey),
            ])

            const holdingsMarketValue = positions.reduce((sum, position) => sum + position.marketValue, 0)
            const totalCostBasis = positions.reduce(
              (sum, position) => sum + position.averagePrice * position.quantity,
              0
            )
            const derivedDayChange = positions.reduce((sum, position) => sum + position.unrealizedPL, 0)

            return createAccountSummary({
              accountId,
              accountKey,
              type: securitiesAccount?.type || 'Brokerage',
              cashAndCashInvestments: balance.cashAndCashInvestments,
              liquidationValue: balance.liquidationValue,
              dayChange: balance.netChange || derivedDayChange,
              holdingsMarketValue,
              totalCostBasis,
              positionsCount: positions.length,
            })
          } catch (error) {
            console.warn(`[AccountSummaries] Failed to summarize ${accountKey}:`, error)
            return null
          }
        })
      )
    ).filter((summary): summary is DashboardAccountSummary => summary !== null)

    const totals = summaries.reduce(
      (accumulator, summary) => ({
        cashAndCashInvestments:
          accumulator.cashAndCashInvestments + summary.cashAndCashInvestments,
        accountValue: accumulator.accountValue + summary.accountValue,
        dayChange: accumulator.dayChange + summary.dayChange,
        holdingsMarketValue: accumulator.holdingsMarketValue + summary.holdingsMarketValue,
        totalCostBasis: accumulator.totalCostBasis + summary.totalCostBasis,
        totalUnrealizedGainLoss:
          accumulator.totalUnrealizedGainLoss + summary.totalUnrealizedGainLoss,
        positionsCount: accumulator.positionsCount + summary.positionsCount,
      }),
      {
        cashAndCashInvestments: 0,
        accountValue: 0,
        dayChange: 0,
        holdingsMarketValue: 0,
        totalCostBasis: 0,
        totalUnrealizedGainLoss: 0,
        positionsCount: 0,
      }
    )

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      accounts: summaries,
      totals: {
        ...totals,
        dayChangePercent: totals.accountValue > 0 ? (totals.dayChange / totals.accountValue) * 100 : 0,
      },
    })
  } catch (error) {
    console.error('Schwab account summaries route error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load account summaries' },
      { status: 500 }
    )
  }
}
