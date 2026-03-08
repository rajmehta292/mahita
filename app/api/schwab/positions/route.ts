import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSchwabClient } from '@/app/services/schwab/client'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    let accountId = searchParams.get('accountId')

    if (process.env.USE_MOCK_DATA === 'true') {
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')

      if (!accountId) {
        const accs = await client.getAccounts()
        accountId = (accs as any).data?.[0]?.securitiesAccount?.hashValue || 'mock-hash'
      }

      const positions = await client.getPositions(accountId!)
      const balance = await client.getBalance(accountId)
      return NextResponse.json({ success: true, positions, balance })
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

    if (!config.clientId || !config.clientSecret) {
      return NextResponse.json({ error: 'Schwab Client ID or Secret missing' }, { status: 400 })
    }

    if (!config.accessToken || !config.refreshToken) {
      return NextResponse.json(
        { error: 'Please connect your Schwab account first' },
        { status: 400 }
      )
    }

    const callbackUrl = `${process.env.NEXTAUTH_URL || 'https://mahita.ai'}/schwab/callback`
    const client = getSchwabClient({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      callbackUrl
    })

    client.setAccessToken(
      config.accessToken,
      config.refreshToken
    )

    // Check if token is expired or near expiry (less than 5 mins)
    const isExpired = config.accessTokenExpiry && (config.accessTokenExpiry.getTime() - Date.now() < 300000)

    if (isExpired) {
      console.log('Schwab token near expiry, refreshing...')
      try {
        const newTokens = await client.refreshAccessToken(config.refreshToken)

        // Save new tokens to DB
        const updatedConfig = await prisma.schwabConfig.update({
          where: { id: config.id },
          data: {
            accessToken: newTokens.access_token,
            refreshToken: newTokens.refresh_token || config.refreshToken,
            accessTokenExpiry: new Date(Date.now() + newTokens.expires_in * 1000),
            refreshTokenExpiry: newTokens.refresh_token_expires_in
              ? new Date(Date.now() + newTokens.refresh_token_expires_in * 1000)
              : config.refreshTokenExpiry
          }
        })

        client.setAccessToken(newTokens.access_token, newTokens.refresh_token || config.refreshToken)
        console.log('Schwab token refreshed successfully')
      } catch (refreshError) {
        console.error('Failed to refresh Schwab token:', refreshError)
        // If refresh fails, we might still want to try the current one or return error
        return NextResponse.json({ error: 'Session expired. Please reconnect Schwab.' }, { status: 401 })
      }
    }

    console.log(`[Schwab Positions] Ensuring account ID exists...`)

    if (!accountId) {
      const accountsRes = await client.getAccounts()
      const accountsList = (accountsRes as any).data || accountsRes
      if (Array.isArray(accountsList) && accountsList.length > 0) {
        accountId = accountsList[0].securitiesAccount?.hashValue || accountsList[0].hashValue
      }

      if (!accountId) {
        return NextResponse.json({ error: 'No linked accounts found to fetch positions' }, { status: 400 })
      }
    }

    try {
      const positions = await client.getPositions(accountId)
      const balance = await client.getBalance(accountId)

      console.log(`[Schwab Positions] Successfully fetched ${positions.length} positions for ${accountId}`)

      return NextResponse.json({
        success: true,
        positions,
        balance,
      })
    } catch (apiError: any) {
      const errorData = apiError.response?.data
      console.error(`[Schwab Positions] API Error for account ${accountId}:`, errorData || apiError.message)

      if (apiError.response?.status === 400) {
        return NextResponse.json({
          error: 'Bad Request: Please ensure you are using a valid account ID (hashValue) and have proper permissions.',
          details: errorData
        }, { status: 400 })
      }
      throw apiError
    }
  } catch (error: any) {
    console.error('Schwab positions route error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch positions' },
      { status: 500 }
    )
  }
}
