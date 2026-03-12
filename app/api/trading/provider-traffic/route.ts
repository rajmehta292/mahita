import { NextResponse } from 'next/server'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'
import { marketDataStore } from '@/app/services/market-data/store'
import { requireRouteAccess } from '@/lib/security/platform-security'

export async function GET() {
    const access = await requireRouteAccess({ policy: "superuser" })
    if (!access.ok) {
        return access.response
    }

    return NextResponse.json({
        providers: marketDataStore.getAvailableProviders(),
        events: providerTelemetryBus.getRecent(200)
    })
}
