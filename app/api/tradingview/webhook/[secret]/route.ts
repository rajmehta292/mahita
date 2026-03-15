import { NextRequest, NextResponse } from 'next/server'
import { ingestTradingViewWebhook } from '@/lib/strategy-deployments'

interface Params {
    params: Promise<{ secret: string }>
}

export async function POST(request: NextRequest, { params }: Params) {
    const { secret } = await params

    try {
        const rawBody = await request.text()
        let payload: Record<string, unknown> = {}
        if (rawBody.trim()) {
            try {
                payload = JSON.parse(rawBody) as Record<string, unknown>
            } catch {
                payload = { message: rawBody }
            }
        }
        const result = await ingestTradingViewWebhook(secret, payload, rawBody)
        return NextResponse.json({
            success: true,
            result,
        })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to process TradingView webhook.' },
            { status: 400 }
        )
    }
}
