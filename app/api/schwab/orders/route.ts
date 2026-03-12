import { NextRequest, NextResponse } from 'next/server'
import { getSchwabClient } from '@/app/services/schwab/client'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import { requireUserSchwabBrokerageConnection } from '@/lib/brokerage-connections'
import { getSchwabCallbackUrl } from '@/lib/schwab-config'

interface AccountLookupResponse {
  data?: Array<{
    securitiesAccount?: {
      hashValue?: string
    }
    hashValue?: string
  }>
}

interface OrderResponse {
  data?: {
    orderId?: string
  } | null
  headers?: {
    location?: string | null
  }
}

function getDefaultOrderWindow() {
  const now = new Date()
  const from = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 30)

  return {
    fromEnteredTime: from.toISOString(),
    toEnteredTime: now.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    let accountId = searchParams.get('accountId')

    if (process.env.USE_MOCK_DATA === 'true') {
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')

      if (!accountId) {
        const accs = await client.getAccounts()
        accountId = (accs as AccountLookupResponse).data?.[0]?.securitiesAccount?.hashValue || 'mock-hash'
      }

      const orders = await client.getOrders(accountId!, getDefaultOrderWindow())
      return NextResponse.json({ success: true, orders: orders.data })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }
    const { config, connection } = resolved

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json({ error: 'Please connect your Schwab account first' }, { status: 400 })
    }

    const callbackUrl = getSchwabCallbackUrl()
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl
    })

    client.setAccessToken(
      config.accessToken,
      config.refreshToken,
      config.accessTokenExpiry ? Math.floor((config.accessTokenExpiry.getTime() - Date.now()) / 1000) : undefined,
      config.refreshTokenExpiry ? Math.floor((config.refreshTokenExpiry.getTime() - Date.now()) / 1000) : undefined
    )

    if (!accountId) {
      const accountsRes = await client.getAccounts()
      const accountsList = (accountsRes as AccountLookupResponse).data || []
      if (Array.isArray(accountsList) && accountsList.length > 0) {
        accountId = accountsList[0].securitiesAccount?.hashValue ?? accountsList[0].hashValue ?? null
      }

      if (!accountId) {
        accountId = connection.accounts[0]?.accountHash || connection.accounts[0]?.providerAccountId || null
      }

      if (!accountId) {
        return NextResponse.json({ error: 'No linked accounts found to fetch orders' }, { status: 400 })
      }
    }

    const orders = await client.getOrders(accountId, getDefaultOrderWindow())

    return NextResponse.json({
      success: true,
      orders: orders.data,
    })
  } catch (error: unknown) {
    console.error('Schwab orders error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accountId, order } = body

    if (!accountId || !order) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const response = await client.placeOrder(accountId, order)
      return NextResponse.json({
        success: true,
        orderId: (response as OrderResponse).data?.orderId || 'mock-id'
      })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }
    const { config } = resolved

    const callbackUrl = getSchwabCallbackUrl()
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl
    })

    client.setAccessToken(config.accessToken!, config.refreshToken!)

    const response = await client.placeOrder(accountId, order)
    const normalizedResponse = response as OrderResponse

    return NextResponse.json({
      success: true,
      orderId: normalizedResponse.data?.orderId || normalizedResponse.headers?.location || null,
    })
  } catch (error: unknown) {
    console.error('Schwab place order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to place order' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')
    const orderId = searchParams.get('orderId')

    if (!accountId || !orderId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      return NextResponse.json({ success: true, message: 'Order cancelled successfully' })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }
    const { config } = resolved

    const callbackUrl = getSchwabCallbackUrl()
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl
    })

    client.setAccessToken(config.accessToken!, config.refreshToken!)

    await client.cancelOrder(accountId, orderId)

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    })
  } catch (error: unknown) {
    console.error('Schwab cancel order error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
