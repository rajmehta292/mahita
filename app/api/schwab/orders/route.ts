import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getSchwabClient } from '@/app/services/schwab/client'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    let session: any = await getServerSession(authOptions)

    // DEV BYPASS
    if (!session && process.env.NODE_ENV === 'development') {
      session = { user: { email: 'dev@mahita.ai' } }
    }

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const accountId = searchParams.get('accountId')

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID required' }, { status: 400 })
    }

    if (process.env.USE_MOCK_DATA === 'true') {
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const orders = await client.getOrders(accountId)
      return NextResponse.json({ success: true, orders: orders.data })
    }

    // Get user's Schwab config with tokens
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }

    const config = user.schwabConfig

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json({ error: 'Please connect your Schwab account first' }, { status: 400 })
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`
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

    const orders = await client.getOrders(accountId)

    return NextResponse.json({
      success: true,
      orders: orders.data,
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
    let session: any = await getServerSession(authOptions)

    // DEV BYPASS
    if (!session && process.env.NODE_ENV === 'development') {
      session = { user: { email: 'dev@mahita.ai' } }
    }

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
        orderId: (response as any).data?.orderId || 'mock-id'
      })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }

    const config = user.schwabConfig
    const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`
    const client = getSchwabClient({
      clientId: config.clientId,
      callbackUrl
    })

    client.setAccessToken(config.accessToken!, config.refreshToken!)

    const response = await client.placeOrder(accountId, order)

    return NextResponse.json({
      success: true,
      orderId: (response as any).data?.orderId,
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
    let session: any = await getServerSession(authOptions)

    // DEV BYPASS
    if (!session && process.env.NODE_ENV === 'development') {
      session = { user: { email: 'dev@mahita.ai' } }
    }

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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json({ error: 'Schwab credentials not configured' }, { status: 400 })
    }

    const config = user.schwabConfig
    const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`
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
  } catch (error: any) {
    console.error('Schwab cancel order error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to cancel order' },
      { status: 500 }
    )
  }
}
