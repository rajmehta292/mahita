import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureBuiltInParityFixtures } from '@/lib/parity-fixtures'

export async function POST(req: Request) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    try {
        const body = await req.json().catch(() => ({}))
        const fixtureKeys = Array.isArray(body.fixtureKeys)
            ? body.fixtureKeys.filter((value: unknown): value is string => typeof value === 'string' && value.length > 0)
            : undefined
        const fixtures = await ensureBuiltInParityFixtures(session.user.id, fixtureKeys)
        return NextResponse.json({ fixtures }, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to import the requested TradingView fixtures.' },
            { status: 400 }
        )
    }
}
