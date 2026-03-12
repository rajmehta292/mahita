import { NextResponse } from 'next/server'
import { checkSchwabTokenHealth } from '@/app/services/schwab/runtime'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'
import { requireRouteAccess } from '@/lib/security/platform-security'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const access = await requireRouteAccess({ policy: "superuser" })
        if (!access.ok) {
            return access.response
        }

        const tokenHealth = await checkSchwabTokenHealth()

        // Compute active Throttle Queue size from the telemetry bus
        const recentEvents = providerTelemetryBus.getRecent(500)
        const ONE_MINUTE_AGO = Date.now() - 60000

        const rateLimitedSymbols = new Set<string>()

        for (const evt of recentEvents) {
            const isRecent = new Date(evt.timestamp).getTime() > ONE_MINUTE_AGO
            if (isRecent && evt.kind === 'error' && evt.message.includes('RATE_LIMITED') && evt.symbol) {
                rateLimitedSymbols.add(evt.symbol)
            }
        }

        return NextResponse.json({
            ok: true,
            provider: 'schwab',
            tokenStatus: tokenHealth.isValid ? 'active' : 'expired',
            tokenError: tokenHealth.error || null,
            throttleQueueSize: rateLimitedSymbols.size,
            throttledSymbols: Array.from(rateLimitedSymbols)
        })
    } catch (error) {
        console.error('[ProviderHealth] Failed to fetch provider health:', error)
        return NextResponse.json({ ok: false, error: 'Failed to fetch provider health' }, { status: 500 })
    }
}
