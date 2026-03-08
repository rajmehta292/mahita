import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'
import { marketDataStore } from '@/app/services/market-data/store'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.json({
        providers: marketDataStore.getAvailableProviders(),
        events: providerTelemetryBus.getRecent(200)
    })
}
