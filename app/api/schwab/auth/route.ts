import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSchwabClient, initializeSchwabClient } from '@/app/services/schwab/client'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    let session: any = await getServerSession(authOptions)

    // DEV BYPASS
    if (!session && process.env.NODE_ENV === 'development') {
      session = { user: { email: 'dev@mahita.ai' } }
      await prisma.user.upsert({
        where: { email: 'dev@mahita.ai' },
        create: { email: 'dev@mahita.ai', name: 'Dev User' },
        update: {}
      })
    }

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    // Get user's Schwab config
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured. Please add your API keys in Settings.' },
        { status: 400 }
      )
    }

    const { clientId, clientSecret } = user.schwabConfig

    // Robust Callback URL detection - prefer NEXTAUTH_URL for consistent redirect URIs
    const nextAuthUrl = process.env.NEXTAUTH_URL
    const callbackUrl = nextAuthUrl
      ? `${nextAuthUrl.replace(/\/$/, '')}/schwab/callback`
      : `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || 'mahita.ai'}/schwab/callback`

    console.log(`[Schwab Auth] Using dynamic authorize callback: ${callbackUrl}`)

    // Initialize client with user's credentials
    const client = initializeSchwabClient({
      clientId,
      clientSecret,
      callbackUrl,
    })

    if (action === 'authorize') {
      // Return authorization URL
      const authUrl = client.getAuthorizationUrl()
      return NextResponse.json({ authUrl })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error: any) {
    console.error('Schwab auth error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process auth request' },
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
      await prisma.user.upsert({
        where: { email: 'dev@mahita.ai' },
        create: { email: 'dev@mahita.ai', name: 'Dev User' },
        update: {}
      })
    }

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code required' },
        { status: 400 }
      )
    }

    // Get user's Schwab config
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured' },
        { status: 400 }
      )
    }

    const { clientId, clientSecret } = user.schwabConfig

    // Robust Callback URL detection - prefer NEXTAUTH_URL for consistent redirect URIs
    const nextAuthUrl = process.env.NEXTAUTH_URL
    const callbackUrl = nextAuthUrl
      ? `${nextAuthUrl.replace(/\/$/, '')}/schwab/callback`
      : `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('host') || 'mahita.ai'}/schwab/callback`

    console.log(`[Schwab Auth] Using dynamic exchange callback: ${callbackUrl}`)

    const client = getSchwabClient({ clientId, clientSecret, callbackUrl })
    const authResponse = await client.authenticate(code)

    // Calculate expiry times
    const now = new Date()
    const accessTokenExpiry = new Date(now.getTime() + (authResponse.expires_in || 1800) * 1000)
    const refreshTokenExpiry = new Date(now.getTime() + (authResponse.refresh_token_expires_in || 604800) * 1000)

    // Store tokens in database
    await prisma.schwabConfig.update({
      where: { userId: user.id },
      data: {
        accessToken: authResponse.access_token,
        refreshToken: authResponse.refresh_token,
        accessTokenExpiry,
        refreshTokenExpiry,
        updatedAt: new Date(),
      }
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
    } catch (decodeErr) {
      console.log('[Schwab Auth] Could not decode access token payload:', decodeErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Authentication successful. Tokens saved.',
    })
  } catch (error: any) {
    console.error('Schwab authentication error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to authenticate' },
      { status: 500 }
    )
  }
}
