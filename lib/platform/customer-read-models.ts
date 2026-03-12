import type { ContinuousIngestStatus } from "@/app/services/market-data/continuous-ingest"

export interface CustomerRuntimeStatus {
    dataPipeline: {
        running: boolean
        currentPhase: string
        lastCompletedAt: string | null
        intervalMs: number
        providerOverride: string | null
        lastError: string | null
        availableProviders: string[]
    }
    inventory: {
        symbolCount: number
        timeframeCount: number
        latestSyncAt: string | null
    }
}

export interface CustomerCatalogRow {
    symbol: string
    timeframe: string
    lastSynced?: Date | null
    lastBar?: Date | null
    barCount?: number | null
}

export interface CustomerChartCatalogEntry {
    symbol: string
    timeframes: string[]
    lastSyncedAt: string | null
    latestBarAt: string | null
    barCount: number
}

export function buildCustomerRuntimeStatus(
    status: ContinuousIngestStatus,
    availableProviders: string[],
    inventorySummary: {
        symbolCount: number
        timeframeCount: number
        latestSyncAt: Date | null
    }
): CustomerRuntimeStatus {
    return {
        dataPipeline: {
            running: status.running,
            currentPhase: status.currentPhase,
            lastCompletedAt: status.lastCompletedAt,
            intervalMs: status.intervalMs,
            providerOverride: status.providerOverride,
            lastError: status.lastError,
            availableProviders,
        },
        inventory: {
            symbolCount: inventorySummary.symbolCount,
            timeframeCount: inventorySummary.timeframeCount,
            latestSyncAt: inventorySummary.latestSyncAt?.toISOString() ?? null,
        },
    }
}

export function buildCustomerChartCatalog(rows: CustomerCatalogRow[]): CustomerChartCatalogEntry[] {
    const grouped = new Map<string, CustomerChartCatalogEntry>()

    for (const row of rows) {
        const existing = grouped.get(row.symbol)

        if (!existing) {
            grouped.set(row.symbol, {
                symbol: row.symbol,
                timeframes: [row.timeframe],
                lastSyncedAt: row.lastSynced?.toISOString() ?? null,
                latestBarAt: row.lastBar?.toISOString() ?? null,
                barCount: Number(row.barCount ?? 0),
            })
            continue
        }

        if (!existing.timeframes.includes(row.timeframe)) {
            existing.timeframes.push(row.timeframe)
        }

        if (row.lastSynced && (!existing.lastSyncedAt || row.lastSynced.toISOString() > existing.lastSyncedAt)) {
            existing.lastSyncedAt = row.lastSynced.toISOString()
        }

        if (row.lastBar && (!existing.latestBarAt || row.lastBar.toISOString() > existing.latestBarAt)) {
            existing.latestBarAt = row.lastBar.toISOString()
        }

        existing.barCount += Number(row.barCount ?? 0)
    }

    return Array.from(grouped.values())
        .map((entry) => ({
            ...entry,
            timeframes: [...entry.timeframes].sort(),
        }))
        .sort((left, right) => left.symbol.localeCompare(right.symbol))
}
