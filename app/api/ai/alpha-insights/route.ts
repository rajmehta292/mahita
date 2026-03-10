import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { AlphaInsightsService } from '@/lib/ai/rag/alpha-insights-service'

const insightsService = new AlphaInsightsService()

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession()
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
        const posRes = await fetch(`${process.env.NEXTAUTH_URL}/api/schwab/positions?accountId=${accountId}`, {
            headers: req.headers // Pass through auth headers/cookies
        })
        const posData = await posRes.json()

        if (!posData.success) {
            return NextResponse.json({ error: 'Failed to retrieve portfolio data' }, { status: 500 })
        }

        // 2. Generate Insights
        const userId = (session.user as any).id || 'default_user'
        const assessment = await insightsService.generateAssessment(
            userId,
            posData.positions,
            posData.balance
        )

        return NextResponse.json({
            success: true,
            ...assessment
        })

    } catch (e: any) {
        console.error('Alpha Insights API Error:', e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
