import { NextRequest, NextResponse } from 'next/server'
import { getAppServerSession } from '@/lib/server-session'
import { createStrategyDeployment, listStrategyDeployments } from '@/lib/strategy-deployments'

export async function GET(request: NextRequest) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const origin = request.nextUrl.origin
    const deployments = await listStrategyDeployments(session.user.id, origin)
    return NextResponse.json({ deployments })
}

export async function POST(request: NextRequest) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await request.json()
        const deployment = await createStrategyDeployment(session.user.id, body, request.nextUrl.origin)
        return NextResponse.json({ deployment }, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to create strategy deployment.' },
            { status: 400 }
        )
    }
}
