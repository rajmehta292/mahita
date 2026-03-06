import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getSchwabClient } from '@/app/services/schwab/client'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's Schwab config with tokens
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

    const config = user.schwabConfig

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json(
        { error: 'Please connect your Schwab account first' },
        { status: 400 }
      )
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

    const response = await client.getAccounts()

    return NextResponse.json({
      success: true,
      accounts: response.data,
    })
  } catch (error: any) {
    console.error('Schwab accounts error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch accounts' },
      { status: 500 }
    )
  }
}
