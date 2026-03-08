import prisma from "@/lib/prisma"
import { Timeframe } from "./types"
import { SchwabClient } from "../schwab/client"

export interface DataGap {
    start: Date
    end: Date
    missingBars: number
}

export interface HealthReport {
    symbol: string
    timeframe: Timeframe
    count: number
    startIndex: Date | null
    endIndex: Date | null
    healthScore: number // 0-100 internal continuity
    targetCoveragePercent: number // 0-100 against horizon limit
    gaps: DataGap[]
    lastSynced?: Date
    source?: string
}

export class DataHealthManager {
    static getTargetHorizon(timeframe: Timeframe): number {
        const now = Math.floor(Date.now() / 1000)
        const ONE_YEAR = 31536000

        switch (timeframe) {
            case '1w':
            case '1M':
                return now - (15 * ONE_YEAR)
            case '1d':
                return now - (10 * ONE_YEAR)
            case '1h':
            case '2h':
            case '3h':
            case '4h':
            case '1m':
            case '3m':
            case '5m':
            case '10m':
            case '15m':
            case '30m':
            case '45m':
                return now - (5 * ONE_YEAR)
            default:
                // Fallback to 3 years
                return now - (3 * ONE_YEAR)
        }
    }

    static timeframeToSeconds(timeframe: Timeframe): number {
        const units: Record<string, number> = {
            m: 60,
            h: 3600,
            d: 86400,
            w: 604800,
            M: 2592000 // 30 days
        }
        const value = parseInt(timeframe.slice(0, -1))
        const unit = timeframe.slice(-1)
        return value * (units[unit] || 0)
    }

    static async getHealth(symbol: string, timeframe: Timeframe): Promise<HealthReport> {
        const data = await (prisma.marketData as any).findMany({
            where: { symbol, timeframe },
            orderBy: { time: 'asc' },
            select: { time: true, source: true }
        })

        if (data.length === 0) {
            return {
                symbol,
                timeframe,
                count: 0,
                startIndex: null,
                endIndex: null,
                healthScore: 0,
                targetCoveragePercent: 0,
                gaps: [],
                source: 'N/A'
            }
        }

        const interval = this.timeframeToSeconds(timeframe)
        const gaps: DataGap[] = []
        let missingBarsTotal = 0
        const isCrypto = symbol.includes('-USD')

        for (let i = 1; i < data.length; i++) {
            const diff = (data[i].time.getTime() - data[i - 1].time.getTime()) / 1000

            // Allow some slack (e.g., 20% jitter) but if it's > 1.5x interval, it's a gap
            if (diff > interval * 1.5) {
                // Ignore weekends for daily data for non-crypto (Friday to Monday is 3 days = 259200s)
                if (!isCrypto && timeframe === '1d' && diff <= 3 * 86400) continue
                // Ignore weekends for intraday data for non-crypto (Friday close to Monday open)
                if (!isCrypto && timeframe.endsWith('m') && diff <= 3 * 86400 && diff >= 2 * 86400) continue

                const missingBars = Math.round(diff / interval) - 1
                if (missingBars > 0) {
                    gaps.push({
                        start: data[i - 1].time,
                        end: data[i].time,
                        missingBars
                    })
                    // Cap missing bars addition to prevent infinite metrics if gap is massive
                    missingBarsTotal += Math.min(missingBars, 10000)
                }
            }
        }

        const totalExpectedBars = data.length + missingBarsTotal
        const healthScore = Math.max(0, Math.min(100, (data.length / totalExpectedBars) * 100))

        const targetStartUnix = this.getTargetHorizon(timeframe)
        const actualHorizonSeconds = data[data.length - 1].time.getTime() / 1000 - data[0].time.getTime() / 1000
        const desiredHorizonSeconds = data[data.length - 1].time.getTime() / 1000 - targetStartUnix

        let targetCoveragePercent = 100
        if (desiredHorizonSeconds > 0) {
            targetCoveragePercent = Math.max(0, Math.min(100, (actualHorizonSeconds / desiredHorizonSeconds) * 100))
        }

        // Use the source from the last bar as the primary source for the dataset
        const source = (data[data.length - 1] as any).source || 'unknown'

        return {
            symbol,
            timeframe,
            count: data.length,
            startIndex: data[0].time,
            endIndex: data[data.length - 1].time,
            healthScore: Math.round(healthScore),
            targetCoveragePercent: Math.round(targetCoveragePercent),
            gaps,
            source
        }
    }

    /**
     * Updates the DataInventory table by scanning MarketData.
     * This is a slow operation and should be run periodically or on-demand.
     */
    static async refreshInventory(): Promise<void> {
        const inventoryGroups = await (prisma.marketData as any).groupBy({
            by: ['symbol', 'timeframe']
        })

        for (const item of inventoryGroups) {
            const report = await this.getHealth(item.symbol, item.timeframe as Timeframe)

            await (prisma as any).dataInventory.upsert({
                where: {
                    symbol_timeframe: {
                        symbol: item.symbol,
                        timeframe: item.timeframe
                    }
                },
                update: {
                    lastSynced: new Date(),
                    source: report.source,
                    firstBar: report.startIndex,
                    lastBar: report.endIndex,
                    healthScore: report.healthScore,
                    targetCoveragePercent: report.targetCoveragePercent,
                    barCount: report.count,
                    gapCount: report.gaps.length
                },
                create: {
                    symbol: item.symbol,
                    timeframe: item.timeframe,
                    lastSynced: new Date(),
                    source: report.source || 'unknown',
                    firstBar: report.startIndex,
                    lastBar: report.endIndex,
                    healthScore: report.healthScore,
                    targetCoveragePercent: report.targetCoveragePercent,
                    barCount: report.count,
                    gapCount: report.gaps.length
                }
            })
        }
    }

    static async getAllHealth(): Promise<HealthReport[]> {
        // First try to get from DataInventory for speed
        const inventory = await (prisma as any).dataInventory.findMany()

        if (inventory.length > 0) {
            return inventory.map((item: any) => ({
                symbol: item.symbol,
                timeframe: item.timeframe as Timeframe,
                count: item.barCount,
                startIndex: item.firstBar,
                endIndex: item.lastBar,
                healthScore: item.healthScore,
                targetCoveragePercent: item.targetCoveragePercent,
                lastSynced: item.lastSynced,
                source: item.source,
                gaps: [] // Gaps are not stored in inventory currently for simplicity
            }))
        }

        // Fallback to slow scan if inventory is empty
        const groups = await (prisma.marketData as any).groupBy({
            by: ['symbol', 'timeframe']
        })

        const reports = await Promise.all(
            groups.map((item: any) => this.getHealth(item.symbol, item.timeframe as Timeframe))
        )

        return reports
    }

    /**
     * Automatically syncs missing data gaps using the Multi-Provider MarketDataStore.
     */
    static async syncGaps(symbol: string, timeframe: Timeframe, providerOverride?: string): Promise<{ gapsFixed: number, barsAdded: number }> {
        const report = await this.getHealth(symbol, timeframe)
        let gapsFixed = 0
        let barsAdded = 0

        // Import dynamically to avoid circular dependencies if called globally
        const { marketDataStore } = await import('./store')

        for (const gap of report.gaps) {
            try {
                // Trigger the store to fetch for this explicit gap timestamp range
                const startUnix = Math.floor(gap.start.getTime() / 1000)
                const endUnix = Math.floor(gap.end.getTime() / 1000)

                const fetchedData = await marketDataStore.getHistoricalData(symbol, timeframe, startUnix, endUnix, providerOverride)

                if (fetchedData.length > 0) {
                    gapsFixed++
                    barsAdded += fetchedData.length
                }
            } catch (error) {
                console.error(`Failed to sync gap for ${symbol} @ ${timeframe}:`, error)
            }
        }

        // Refresh inventory after fix
        if (gapsFixed > 0) {
            await this.refreshInventory()
        }

        return { gapsFixed, barsAdded }
    }
}
