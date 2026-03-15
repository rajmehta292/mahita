import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BUILT_IN_INDICATORS, PATTERN_ITEMS, PROFILE_ITEMS } from '@/lib/indicator-catalog'
import { listStrategies } from '@/lib/strategy-library'
import { getUserPreferences } from '@/lib/user-preferences'
import { parseStoredStringArray } from '@/lib/preferences-serialization'

export async function GET() {
    const session = await getServerSession(authOptions)

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [strategies, preferences] = await Promise.all([
        listStrategies(session.user.id),
        getUserPreferences(session.user.id),
    ])

    const favoriteIndicatorIds = parseStoredStringArray(preferences?.indicatorFavorites ?? null)

    return NextResponse.json({
        favorites: favoriteIndicatorIds,
        indicators: BUILT_IN_INDICATORS,
        profiles: PROFILE_ITEMS,
        patterns: PATTERN_ITEMS,
        strategies: strategies.map((strategy) => ({
            id: strategy.id,
            name: strategy.name,
            description: strategy.description,
            symbol: strategy.symbol,
            timeframe: strategy.timeframe,
            latestVersionId: strategy.latestVersionId,
            versionCount: strategy.versions.length,
            workspaceRevision: strategy.workspaceSession?.autosaveRevision ?? 0,
            updatedAt: strategy.workspaceSession?.updatedAt ?? strategy.updatedAt,
        })),
    })
}
