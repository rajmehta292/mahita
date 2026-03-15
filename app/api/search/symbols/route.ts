import { NextRequest, NextResponse } from 'next/server'
import { getAppServerSession } from '@/lib/server-session'
import { lookupSymbols } from '@/lib/symbol-lookup'

export async function GET(request: NextRequest) {
    const session = await getAppServerSession()
    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const query = request.nextUrl.searchParams.get('q') || ''
    if (!query.trim()) {
        return NextResponse.json({ results: [] })
    }

    const results = await lookupSymbols(session.user.id, query)
    return NextResponse.json({ results })
}
