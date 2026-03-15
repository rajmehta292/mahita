import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { deleteScriptDraft, getScriptDraftById, touchScriptDraft } from '@/lib/script-drafts'

interface RouteContext {
    params: Promise<{ id: string }>
}

export async function GET(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const draft = await touchScriptDraft(session.user.id, id)

    if (!draft) {
        return NextResponse.json({ error: 'Script not found.' }, { status: 404 })
    }

    return NextResponse.json({ draft })
}

export async function DELETE(_: Request, context: RouteContext) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const { id } = await context.params
        const draft = await getScriptDraftById(session.user.id, id)

        if (!draft) {
            return NextResponse.json({ error: 'Script not found.' }, { status: 404 })
        }

        await deleteScriptDraft(session.user.id, id)
        return NextResponse.json({ success: true })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to delete script.' },
            { status: 400 }
        )
    }
}
