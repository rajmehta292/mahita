import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!user.schwabConfig) {
      return NextResponse.json(
        { error: 'Schwab credentials not configured. Please add your API keys first.' },
        { status: 400 }
      )
    }

    // Calculate expiry times
    const now = new Date()
    const accessTokenExpiry = expiresIn 
      ? new Date(now.getTime() + expiresIn * 1000)
      : new Date(now.getTime() + 30 * 60 * 1000) // Default 30 minutes

    const refreshTokenExpiry = refreshTokenExpiresIn
      ? new Date(now.getTime() + refreshTokenExpiresIn * 1000)
      : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // Default 7 days

    // Update tokens
    await prisma.schwabConfig.update({
      where: { userId: user.id },
      data: {
        accessToken,
        refreshToken,
        accessTokenExpiry,
        refreshTokenExpiry,
        updatedAt: new Date(),
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Tokens saved successfully'
    })
  } catch (error: any) {
    console.error('Save tokens error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save tokens' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user || !user.schwabConfig) {
      return NextResponse.json({
        success: false,
        error: 'No Schwab configuration found'
      }, { status: 404 })
    }

    const config = user.schwabConfig

    // Check if tokens are expired
    const now = new Date()
    const accessTokenValid = config.accessTokenExpiry && config.accessTokenExpiry > now
    const refreshTokenValid = config.refreshTokenExpiry && config.refreshTokenExpiry > now

    return NextResponse.json({
      success: true,
      tokens: {
        accessToken: config.accessToken,
        refreshToken: config.refreshToken,
        accessTokenValid,
        refreshTokenValid,
      },
      credentials: {
        clientId: config.clientId,
        clientSecret: config.clientSecret,
      }
    })
  } catch (error: any) {
    console.error('Get tokens error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get tokens' },
      { status: 500 }
    )
  }
}
