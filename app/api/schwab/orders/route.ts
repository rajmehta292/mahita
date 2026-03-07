import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getSchwabClient } from '@/app/services/schwab/client'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      const searchParams = request.nextUrl.searchParams
      const accountId = searchParams.get('accountId') || 'mock'
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const response = await client.getOrders(accountId)
      return NextResponse.json({ success: true, orders: response.data })
    }

    const searchParams = request.nextUrl.searchParams
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const accountId = searchParams.get('accountId')

    if (!accessToken || !refreshToken || !accountId) {
      return NextResponse.json(
        { error: 'Access token, refresh token, and account ID required' },
        { status: 400 }
      )
    }

    const clientId = process.env.SCHWAB_CLIENT_ID
    const callbackUrl = process.env.SCHWAB_CALLBACK_URL

    if (!clientId || !callbackUrl) {
      return NextResponse.json(
        { error: 'Schwab API credentials not configured' },
        { status: 500 }
      )
    }

    const client = getSchwabClient({ clientId, callbackUrl })
    client.setAccessToken(accessToken, refreshToken)

    const response = await client.getOrders(accountId)

    return NextResponse.json({
      success: true,
      orders: response.data,
    })
  } catch (error: any) {
    console.error('Schwab orders error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      const body = await request.json()
      const accountId = body.accountId || 'mock'
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const response = await client.placeOrder(accountId, body.order)
      return NextResponse.json({ success: true, orderId: (response as any).headers?.location?.split('/').pop() || 'mock-id' })
    }

    const body = await request.json()
    const { accessToken, refreshToken, accountId, order } = body

    if (!accessToken || !refreshToken || !accountId || !order) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const clientId = process.env.SCHWAB_CLIENT_ID
    const callbackUrl = process.env.SCHWAB_CALLBACK_URL

    if (!clientId || !callbackUrl) {
      return NextResponse.json(
        { error: 'Schwab API credentials not configured' },
        { status: 500 }
      )
    }

    const client = getSchwabClient({ clientId, callbackUrl })
    client.setAccessToken(accessToken, refreshToken)

    const response = await client.placeOrder(accountId, order)

    return NextResponse.json({
      success: true,
      orderId: (response as any).headers?.location?.split('/').pop(),
    })
  } catch (error: any) {
    console.error('Schwab place order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to place order' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      return NextResponse.json({ success: true, message: 'Order cancelled successfully' })
    }

    const searchParams = request.nextUrl.searchParams
    const accessToken = searchParams.get('accessToken')
    const refreshToken = searchParams.get('refreshToken')
    const accountId = searchParams.get('accountId')
    const orderId = searchParams.get('orderId')

    if (!accessToken || !refreshToken || !accountId || !orderId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const clientId = process.env.SCHWAB_CLIENT_ID
    const callbackUrl = process.env.SCHWAB_CALLBACK_URL

    if (!clientId || !callbackUrl) {
      return NextResponse.json(
        { error: 'Schwab API credentials not configured' },
        { status: 500 }
      )
    }

    const client = getSchwabClient({ clientId, callbackUrl })
    client.setAccessToken(accessToken, refreshToken)

    await client.cancelOrder(accountId, orderId)

    return NextResponse.json({
      success: true,
      message: 'Order cancelled successfully',
    })
  } catch (error: any) {
    console.error('Schwab cancel order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
