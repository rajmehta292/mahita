import { NextRequest, NextResponse } from 'next/server'
import { getSchwabClient, initializeSchwabClient } from '@/app/services/schwab/client'
import { getAppServerSession, getCurrentUser } from '@/lib/server-session'
import {
  getInteractiveSchwabOAuthConfig,
} from '@/lib/schwab-config'
import {
  issueBrokerageAuthorizationState,
  persistBrokerageConnectionTokens,
  requireUserSchwabBrokerageConnection,
  validateBrokerageAuthorizationState,
} from '@/lib/brokerage-connections'
import { toErrorResponse } from '@/lib/route-errors'
import { getRequestOriginFromHeaders } from '@/lib/auth-environment'

export async function GET(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    const user = await getCurrentUser(session)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const resolved = await requireUserSchwabBrokerageConnection(user.id).catch(() => null)

    if (!resolved) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured. Please add your API keys in Settings.' },
        { status: 400 }
      )
    }
    const { connection, config } = resolved
    const { clientId, clientSecret } = config

    const requestOrigin = getRequestOriginFromHeaders(request.headers)
    const interactiveOAuth = getInteractiveSchwabOAuthConfig(requestOrigin)
    const callbackUrl = interactiveOAuth.callbackUrl

    console.log(`[Schwab Auth] Using dynamic authorize callback: ${callbackUrl}`)

    // Initialize client with user's credentials
    const client = initializeSchwabClient({
      clientId,
      clientSecret: clientSecret || undefined,
      callbackUrl,
    })

    if (action === 'authorize') {
      if (!interactiveOAuth.supported) {
        return NextResponse.json(
          {
            error: interactiveOAuth.reason,
            callbackUrl: interactiveOAuth.callbackUrl,
            interactiveOAuthSupported: false,
          },
          { status: 400 }
        )
      }

      // Return authorization URL
      const state = await issueBrokerageAuthorizationState(connection.id)
      const authUrl = client.getAuthorizationUrl({ state })
      return NextResponse.json({
        authUrl,
        state,
        connectionId: connection.id,
        callbackUrl,
        interactiveOAuthSupported: true,
      })
    }

    if (action === 'status' || !action) {
      const isConnected = Boolean(config.accessToken) && Boolean(config.refreshToken)
      const isExpired = config.accessTokenExpiry && (config.accessTokenExpiry.getTime() - Date.now() < 0)

      return NextResponse.json({
        isConnected,
        isExpired,
        tokenExpiry: config.accessTokenExpiry,
        connectionId: connection.id,
        connectionStatus: connection.status,
        callbackUrl,
        interactiveOAuthSupported: interactiveOAuth.supported,
        interactiveOAuthReason: interactiveOAuth.reason,
        isPendingAuthorization: Boolean(connection.pendingAuthState),
        pendingAuthStartedAt: connection.pendingAuthStartedAt,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: unknown) {
    return toErrorResponse(error, 'Mahita could not start the Schwab authorization flow.')
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAppServerSession()

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code, state } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code required' },
        { status: 400 }
      )
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
    const { clientId, clientSecret } = config

    await validateBrokerageAuthorizationState({
      brokerageConnectionId: connection.id,
      state,
    })

    const requestOrigin = getRequestOriginFromHeaders(request.headers)
    const interactiveOAuth = getInteractiveSchwabOAuthConfig(requestOrigin)
    const callbackUrl = interactiveOAuth.callbackUrl

    console.log(`[Schwab Auth] Using dynamic exchange callback: ${callbackUrl}`)

    const client = getSchwabClient({
      clientId,
      clientSecret: clientSecret || undefined,
      callbackUrl,
    })
    const authResponse = await client.authenticate(code)

    // Calculate expiry times
    const now = new Date()
    const accessTokenExpiry = new Date(now.getTime() + (authResponse.expires_in || 1800) * 1000)
    const refreshTokenExpiry = new Date(now.getTime() + (authResponse.refresh_token_expires_in || 604800) * 1000)

    await persistBrokerageConnectionTokens({
      brokerageConnectionId: connection.id,
      accessToken: authResponse.access_token,
      refreshToken: authResponse.refresh_token,
      accessTokenExpiry,
      refreshTokenExpiry,
    })

    // Debug: Decode the token payload to verify scopes (it's a JWT)
    try {
      if (authResponse.access_token) {
        const payloadBase64 = authResponse.access_token.split('.')[1]
        if (payloadBase64) {
          const payloadString = Buffer.from(payloadBase64, 'base64').toString('ascii')
          const payloadInfo = JSON.parse(payloadString)
          console.log('[Schwab Auth] Access Token Decoded Scopes:', payloadInfo.scp || payloadInfo.scope || 'No scope field')
        }
      }
    } catch (decodeError) {
      console.log('[Schwab Auth] Could not decode access token payload:', decodeError)
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful. Tokens saved.',
      connectionId: connection.id,
    })
  } catch (error: unknown) {
    return toErrorResponse(error, 'Failed to complete Schwab authorization.')
  }
}
