import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
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

    if (process.env.USE_MOCK_DATA === 'true') {
      return NextResponse.json({
        success: true,
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

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { schwabConfig: true }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return config without sensitive tokens
    if (user.schwabConfig) {
      return NextResponse.json({
        success: true,
        config: {
          hasClientId: !!user.schwabConfig.clientId,
          hasClientSecret: !!user.schwabConfig.clientSecret,
          hasAccessToken: !!user.schwabConfig.accessToken,
          hasRefreshToken: !!user.schwabConfig.refreshToken,
          accessTokenExpiry: user.schwabConfig.accessTokenExpiry,
          refreshTokenExpiry: user.schwabConfig.refreshTokenExpiry,
        }
      })
    }

    return NextResponse.json({
      success: true,
      config: null
    })
  } catch (error: any) {
    console.error('Get Schwab config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get config' },
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
    const clientId = body.clientId?.trim()
    const clientSecret = body.clientSecret?.trim()

    // Robust Callback URL detection
    const protocol = request.headers.get('x-forwarded-proto') || 'http'
    const host = request.headers.get('host') || 'localhost:6244'
    const callbackUrl = `${protocol}://${host}/schwab/callback`

    console.log(`[Schwab Auth] Using dynamic callback URL: ${callbackUrl}`)

    // Note: getSchwabClient is not defined in this file, assuming it's imported or defined elsewhere
    // const client = getSchwabClient({ clientId, clientSecret, callbackUrl })

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: 'Client ID and Client Secret are required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if config exists
    const existingConfig = await prisma.schwabConfig.findUnique({
      where: { userId: user.id }
    })

    let schwabConfig
    if (existingConfig) {
      // Update existing
      schwabConfig = await prisma.schwabConfig.update({
        where: { userId: user.id },
        data: {
          clientId,
          clientSecret,
          updatedAt: new Date(),
        }
      })
    } else {
      // Create new
      schwabConfig = await prisma.schwabConfig.create({
        data: {
          userId: user.id,
          clientId,
          clientSecret,
        }
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Schwab credentials saved successfully'
    })
  } catch (error: any) {
    console.error('Save Schwab config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save config' },
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
      await prisma.user.upsert({
        where: { email: 'dev@mahita.ai' },
        create: { email: 'dev@mahita.ai', name: 'Dev User' },
        update: {}
      })
    }

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.schwabConfig.deleteMany({
      where: { userId: user.id }
    })

    return NextResponse.json({
      success: true,
      message: 'Schwab credentials deleted successfully'
    })
  } catch (error: any) {
    console.error('Delete Schwab config error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete config' },
      { status: 500 }
    )
  }
}
