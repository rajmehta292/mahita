import { NextRequest, NextResponse } from 'next/server'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import {
  deleteUserSchwabCredentials,
  ensureUserSchwabBrokerageConnection,
  saveUserSchwabCredentials,
} from '@/lib/brokerage-connections'
import { toErrorResponse } from '@/lib/route-errors'
import { getSchwabCallbackUrl, resolveSchwabConfig } from '@/lib/schwab-config'

export async function GET() {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const callbackUrl = getSchwabCallbackUrl()

    if (process.env.USE_MOCK_DATA === 'true') {
      return NextResponse.json({
        success: true,
        callbackUrl,
        config: {
          hasClientId: true,
          hasClientSecret: true,
          hasAccessToken: true,
          hasRefreshToken: true,
          accessTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
          refreshTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        }
      })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const connection = await ensureUserSchwabBrokerageConnection(user.id)

    if (connection?.linkedSchwabConfig) {
      const config = resolveSchwabConfig(connection.linkedSchwabConfig)
      return NextResponse.json({
        success: true,
        callbackUrl,
        config: {
          hasClientId: !!config.clientId,
          hasClientSecret: !!config.clientSecret,
          hasAccessToken: !!config.accessToken,
          hasRefreshToken: !!config.refreshToken,
          accessTokenExpiry: config.accessTokenExpiry,
          refreshTokenExpiry: config.refreshTokenExpiry,
        },
        connection: {
          id: connection.id,
          status: connection.status,
          lastSyncedAt: connection.lastSyncedAt,
          lastError: connection.lastError,
          accountCount: connection.accounts.length,
        },
      })
    }

    return NextResponse.json({
      success: true,
      callbackUrl,
      config: null,
      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            lastSyncedAt: connection.lastSyncedAt,
            lastError: connection.lastError,
            accountCount: connection.accounts.length,
          }
        : null,
    })
  } catch (error: unknown) {
    return toErrorResponse(error, 'Mahita could not load your Schwab credentials.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const clientId = body.clientId?.trim()
    const clientSecret = body.clientSecret?.trim()

    const callbackUrl = getSchwabCallbackUrl()

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Client ID and Client Secret are required' },
        { status: 400 }
      )
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const connection = await saveUserSchwabCredentials({
      userId: user.id,
      clientId,
      clientSecret,
    })

    return NextResponse.json({
      success: true,
      message: 'Schwab credentials saved successfully',
      callbackUrl,
      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            lastSyncedAt: connection.lastSyncedAt,
            lastError: connection.lastError,
            accountCount: connection.accounts.length,
          }
        : null,
    })
  } catch (error: unknown) {
    return toErrorResponse(error, 'Mahita could not save your Schwab credentials.')
  }
}

export async function DELETE() {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const connection = await deleteUserSchwabCredentials(user.id)

    return NextResponse.json({
      success: true,
      message: 'Schwab credentials deleted successfully',
      connection: connection
        ? {
            id: connection.id,
            status: connection.status,
            lastSyncedAt: connection.lastSyncedAt,
            lastError: connection.lastError,
            accountCount: connection.accounts.length,
          }
        : null,
    })
  } catch (error: unknown) {
    return toErrorResponse(error, 'Mahita could not delete your Schwab credentials.')
  }
}
