import { NextRequest, NextResponse } from 'next/server'
import { getAppServerSession } from '@/lib/server-session'
import { deleteStrategyDeployment, getStrategyDeployment, updateStrategyDeployment } from '@/lib/strategy-deployments'

interface Params {
    params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const deployment = await getStrategyDeployment(session.user.id, id, request.nextUrl.origin)
    if (!deployment) {
        return NextResponse.json({ error: 'Strategy deployment not found.' }, { status: 404 })
    }

    return NextResponse.json({ deployment })
}

export async function PATCH(request: NextRequest, { params }: Params) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        const body = await request.json()
        const deployment = await updateStrategyDeployment(session.user.id, id, body, request.nextUrl.origin)
        return NextResponse.json({ deployment })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to update strategy deployment.' },
            { status: 400 }
        )
    }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await params
        await deleteStrategyDeployment(session.user.id, id)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete strategy deployment.' },
            { status: 400 }
        )
    }
}
