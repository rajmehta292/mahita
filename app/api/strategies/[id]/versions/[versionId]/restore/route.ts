import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { restoreStrategyVersionToWorkspace } from '@/lib/strategy-library'

interface RouteContext {
    params: Promise<{ id: string, versionId: string }>
}

export async function POST(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id, versionId } = await context.params
        const strategy = await restoreStrategyVersionToWorkspace(session.user.id, id, versionId)

        if (!strategy) {
            return NextResponse.json({ error: 'Strategy not found.' }, { status: 404 })
        }

        return NextResponse.json({ strategy })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to restore strategy version.' },
            { status: 400 }
        )
    }
}
