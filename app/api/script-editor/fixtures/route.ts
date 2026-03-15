import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ensureBuiltInParityFixtures, listParityFixtures } from '@/lib/parity-fixtures'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fixtures = await listParityFixtures(session.user.id)
    return NextResponse.json({ fixtures })
}

export async function POST(_req: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const fixtures = await ensureBuiltInParityFixtures(session.user.id)
    return NextResponse.json({ fixtures }, { status: 201 })
}
