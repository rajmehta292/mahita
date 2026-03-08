import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getSchwabClient } from '@/app/services/schwab/client'
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
      const client = getSchwabClient({ clientId: 'mock', clientSecret: 'mock', callbackUrl: 'mock' })
      client.setAccessToken('mock', 'mock')
      const response = await client.getAccounts()
      return NextResponse.json({ success: true, accounts: response.data })
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
        await prisma.schwabConfig.update({
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
        return NextResponse.json({ error: 'Session expired. Please reconnect Schwab.' }, { status: 401 })
      }
    }

    const [response, numbersResponse] = await Promise.all([
      client.getAccounts(),
      client.getAccountNumbers()
    ])

    const accountNumbers = numbersResponse.data || []
    const hashMap = new Map(accountNumbers.map((n: any) => [n.accountNumber, n.hashValue]))

    const mergedAccounts = (response.data || []).map((acc: any) => {
      const sAcc = acc.securitiesAccount || {}
      if (sAcc.accountNumber && hashMap.has(sAcc.accountNumber)) {
        sAcc.hashValue = hashMap.get(sAcc.accountNumber)
        // Ensure accountId is present for UI compatibility
        sAcc.accountId = sAcc.accountNumber
      }
      return acc
    })

    if (mergedAccounts && Array.isArray(mergedAccounts)) {
      console.log(`[Schwab Accounts] Found ${mergedAccounts.length} accounts`)
      mergedAccounts.forEach((acc: any, i: number) => {
        const sAcc = acc.securitiesAccount
        console.log(`  Account ${i}: ID=${sAcc?.accountId}, Hash=${sAcc?.hashValue ? 'Present' : 'MISSING'}`)
      })
    }

    return NextResponse.json({
      success: true,
      accounts: mergedAccounts,
    })
  } catch (error: any) {
    const errorData = error.response?.data
    console.error('Schwab accounts route error:', errorData || error.message)
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch accounts',
        details: errorData
      },
      { status: error.response?.status || 500 }
    )
  }
}
