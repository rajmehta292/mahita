import { NextRequest, NextResponse } from 'next/server'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import {
  persistBrokerageConnectionTokens,
  requireUserSchwabBrokerageConnection,
} from '@/lib/brokerage-connections'

export async function POST(request: NextRequest) {
  try {
    const session = await getAppServerSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { accessToken, refreshToken, expiresIn, refreshTokenExpiresIn } = body

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { error: 'Access token and refresh token are required' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate expiry times
    const now = new Date()
    const accessTokenExpiry = expiresIn 
      ? new Date(now.getTime() + expiresIn * 1000)
      : new Date(now.getTime() + 30 * 60 * 1000) // Default 30 minutes

    const refreshTokenExpiry = refreshTokenExpiresIn
      ? new Date(now.getTime() + refreshTokenExpiresIn * 1000)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Default 7 days

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured. Please add your API keys first.' },
        { status: 400 }
      )
    }

    const { connection } = resolved

    await persistBrokerageConnectionTokens({
      brokerageConnectionId: connection.id,
      accessToken,
      refreshToken,
      accessTokenExpiry,
      refreshTokenExpiry,
    })

    return NextResponse.json({
      success: true,
      message: 'Tokens saved successfully'
    })
  } catch (error: unknown) {
    console.error('Save tokens error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save tokens' },
      { status: 500 }
    )
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
      return NextResponse.json({
        success: false,
        error: 'User not found',
      }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json({
        success: false,
        error: 'No Schwab brokerage connection found',
      }, { status: 404 })
    }

    const { connection, config } = resolved

    // Check if tokens are expired
    const now = new Date()
    const accessTokenValid = config.accessTokenExpiry && config.accessTokenExpiry > now
    const refreshTokenValid = config.refreshTokenExpiry && config.refreshTokenExpiry > now

    return NextResponse.json({
      success: true,
      status: {
        hasClientId: Boolean(config.clientId),
        hasClientSecret: Boolean(config.clientSecret),
        hasAccessToken: Boolean(config.accessToken),
        hasRefreshToken: Boolean(config.refreshToken),
        accessTokenValid,
        refreshTokenValid,
        accessTokenExpiry: config.accessTokenExpiry,
        refreshTokenExpiry: config.refreshTokenExpiry,
        connectionId: connection.id,
        connectionStatus: connection.status,
      }
    })
  } catch (error: unknown) {
    console.error('Get tokens error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get tokens' },
      { status: 500 }
    )
  }
}
