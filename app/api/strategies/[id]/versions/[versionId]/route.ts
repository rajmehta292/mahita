import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteStrategyVersion, getStrategyById } from '@/lib/strategy-library'

interface RouteContext {
    params: Promise<{ id: string, versionId: string }>
}

export async function GET(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, versionId } = await context.params
    const strategy = await getStrategyById(session.user.id, id)

    if (!strategy) {
        return NextResponse.json({ error: 'Strategy not found.' }, { status: 404 })
    }

    const version = strategy.versions.find((entry) => entry.id === versionId)
    if (!version) {
        return NextResponse.json({ error: 'Strategy version not found.' }, { status: 404 })
    }

    return NextResponse.json({ version })
}

export async function DELETE(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id, versionId } = await context.params
        const strategy = await deleteStrategyVersion(session.user.id, id, versionId)
        return NextResponse.json({ strategy })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete strategy version.' },
            { status: 400 }
        )
    }
}
