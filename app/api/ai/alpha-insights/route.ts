import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AlphaInsightsService } from '@/lib/ai/rag/alpha-insights-service'

const insightsService = new AlphaInsightsService()

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const url = new URL(req.url)
        const accountId = url.searchParams.get('accountId')

        if (!accountId) {
            return NextResponse.json({ error: 'Missing accountId' }, { status: 400 })
        }

        // 1. Fetch Positions (Internal API call to keep it DRY or call service directly)
        // For simplicity and speed, we'll fetch from our existing positions endpoint
        const origin = req.nextUrl.origin
        const posRes = await fetch(`${origin}/api/schwab/positions?accountId=${accountId}`, {
            headers: req.headers // Pass through auth headers/cookies
        })
        const posData = await posRes.json()

        if (!posData.success) {
            return NextResponse.json({ error: 'Failed to retrieve portfolio data' }, { status: 500 })
        }

        // 2. Generate Insights
        const userId = session.user.id
        const assessment = await insightsService.generateAssessment(
            userId,
            posData.positions,
            posData.balance
        )

        return NextResponse.json({
            success: true,
            ...assessment
        })

    } catch (error) {
        console.error('Alpha Insights API Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to generate Alpha Insights' },
            { status: 500 }
        )
    }
}
