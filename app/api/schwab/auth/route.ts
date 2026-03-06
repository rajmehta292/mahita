import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getSchwabClient, initializeSchwabClient } from '@/app/services/schwab/client'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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
    const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`

    // Initialize client with user's credentials
    const client = initializeSchwabClient({
      clientId,
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
    const session = await getServerSession(authOptions)
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
    const callbackUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/schwab/callback`

    const client = getSchwabClient({ clientId, callbackUrl })
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
