import prisma from "@/lib/prisma"
import { Timeframe } from "./types"
import { getMissingRanges, timeframeToSeconds } from "./utils"
import { vaultManager } from "./vault-manager"

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
    healthScore: number
    targetCoveragePercent: number
    gaps: DataGap[]
    gapCount?: number
    lastSynced?: Date
    source?: string
    vaultName?: string
}

export interface MultiIntervalHealth {
    symbol: string
    vaultName: string
    intervals: Record<string, {
        healthScore: number
        targetCoveragePercent: number
        barCount: number
        gapCount: number
    }>
}

const TRACKED_TIMEFRAMES: Timeframe[] = ['1s', '1m', '1h', '1d', '1w', '1M']

export class DataHealthManager {
    static getTargetHorizon(timeframe: Timeframe): number {
        const now = Math.floor(Date.now() / 1000)
        const ONE_YEAR = 31536000

        switch (timeframe) {
            case '1w':
            case '1M':
            case '1d':
                return now - (15 * ONE_YEAR)
            case '1h':
            case '2h':
            case '3h':
            case '4h':
                return now - (700 * 86400)
            case '1m':
            case '3m':
            case '5m':
            case '10m':
            case '15m':
            case '30m':
            case '45m':
                return now - (90 * 86400)
            default:
                return now - (3 * ONE_YEAR)
        }
    }

    static async getHealth(symbol: string, timeframe: Timeframe, vaultName = 'schwab'): Promise<HealthReport> {
        const client = await vaultManager.getClient(vaultName)
        const rows = await client.marketData.findMany({
            where: { symbol, timeframe },
            orderBy: { time: 'asc' },
            select: { time: true, source: true }
        })

        if (rows.length === 0) {
            return {
                symbol,
                timeframe,
                count: 0,
                startIndex: null,
                endIndex: null,
                healthScore: 0,
                targetCoveragePercent: 0,
                gaps: [],
                gapCount: 0,
                source: 'N/A',
                vaultName
            }
        }

        const data = rows.map((row) => ({
            time: Math.floor(row.time.getTime() / 1000),
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0
        }))

        const gaps = getMissingRanges(
            symbol,
            timeframe,
            data,
            data[0].time,
            data[data.length - 1].time
        ).map((gap) => {
            const interval = Math.max(1, timeframeToSeconds(timeframe))
            const missingBars = Math.max(0, Math.round((gap.endTime - gap.startTime) / interval) + 1)

            return {
                start: new Date(gap.startTime * 1000),
                end: new Date(gap.endTime * 1000),
                missingBars
            }
        })

        const missingBarsTotal = gaps.reduce((total, gap) => total + Math.min(gap.missingBars, 10000), 0)
        const totalExpectedBars = rows.length + missingBarsTotal
        const healthScore = totalExpectedBars === 0
            ? 0
            : Math.max(0, Math.min(100, (rows.length / totalExpectedBars) * 100))

        const targetStartUnix = this.getTargetHorizon(timeframe)
        const actualHorizonSeconds = data[data.length - 1].time - data[0].time
        const desiredHorizonSeconds = data[data.length - 1].time - targetStartUnix

        const targetCoveragePercent = desiredHorizonSeconds <= 0
            ? 100
            : Math.max(0, Math.min(100, (actualHorizonSeconds / desiredHorizonSeconds) * 100))

        return {
            symbol,
            timeframe,
            count: rows.length,
            startIndex: rows[0].time,
            endIndex: rows[rows.length - 1].time,
            healthScore: Math.round(healthScore),
            targetCoveragePercent: Math.round(targetCoveragePercent),
            gaps,
            gapCount: gaps.length,
            source: rows[rows.length - 1].source || 'unknown',
            vaultName
        }
    }

    static async getMultiIntervalHealth(symbol: string, vaultName = 'schwab'): Promise<MultiIntervalHealth> {
        const result: MultiIntervalHealth = {
            symbol,
            vaultName,
            intervals: {}
        }

        for (const timeframe of TRACKED_TIMEFRAMES) {
            const health = await this.getHealth(symbol, timeframe, vaultName)
            result.intervals[timeframe] = {
                healthScore: health.healthScore,
                targetCoveragePercent: health.targetCoveragePercent,
                barCount: health.count,
                gapCount: health.gapCount || 0
            }
        }

        return result
    }

    static async refreshInventory(vaultName?: string): Promise<void> {
        const vaultNames = vaultName ? [vaultName] : (await prisma.vault.findMany({ select: { name: true } })).map(v => v.name)

        for (const name of vaultNames) {
            const client = await vaultManager.getClient(name)
            const groups = await client.marketData.groupBy({
                by: ['symbol', 'timeframe']
            })

            const reports = await Promise.all(
                groups.map((item) => this.getHealth(item.symbol, item.timeframe as Timeframe, name))
            )

            await this.syncInventoryReports(reports, name)
        }
    }

    static async getAllHealth(vaultName = 'schwab'): Promise<HealthReport[]> {
        const client = await vaultManager.getClient(vaultName)
        const groups = await client.marketData.groupBy({
            by: ['symbol', 'timeframe']
        })

        if (groups.length === 0) {
            // Cleanup inventory for this vault?
            return []
        }

        const reports = await Promise.all(
            groups.map((item) => this.getHealth(item.symbol, item.timeframe as Timeframe, vaultName))
        )

        await this.syncInventoryReports(reports, vaultName)

        return reports.sort((left, right) => {
            if (left.symbol === right.symbol) {
                return left.timeframe.localeCompare(right.timeframe)
            }

            return left.symbol.localeCompare(right.symbol)
        })
    }

    private static async syncInventoryReports(reports: HealthReport[], vaultName: string): Promise<void> {
        const vault = await prisma.vault.findUnique({ where: { name: vaultName } })
        if (!vault) return

        const liveKeys = new Set(reports.map((report) => `${report.symbol}::${report.timeframe}`))

        // Use main prisma to track inventory across all vaults
        const existingInventory = await prisma.dataInventory.findMany({
            where: { vaultId: vault.id },
            select: { id: true, symbol: true, timeframe: true }
        })

        for (const report of reports) {
            await prisma.dataInventory.upsert({
                where: {
                    vaultId_symbol_timeframe: {
                        vaultId: vault.id,
                        symbol: report.symbol,
                        timeframe: report.timeframe
                    }
                },
                update: {
                    lastSynced: new Date(),
                    source: report.source || 'unknown',
                    firstBar: report.startIndex,
                    lastBar: report.endIndex,
                    healthScore: report.healthScore,
                    targetCoveragePercent: report.targetCoveragePercent,
                    barCount: report.count,
                    gapCount: report.gapCount || report.gaps.length
                },
                create: {
                    vaultId: vault.id,
                    symbol: report.symbol,
                    timeframe: report.timeframe,
                    lastSynced: new Date(),
                    source: report.source || 'unknown',
                    firstBar: report.startIndex,
                    lastBar: report.endIndex,
                    healthScore: report.healthScore,
                    targetCoveragePercent: report.targetCoveragePercent,
                    barCount: report.count,
                    gapCount: report.gapCount || report.gaps.length
                }
            })
        }

        const staleIds = existingInventory
            .filter((item) => !liveKeys.has(`${item.symbol}::${item.timeframe}`))
            .map((item) => item.id)

        if (staleIds.length > 0) {
            await prisma.dataInventory.deleteMany({
                where: { id: { in: staleIds } }
            })
        }
    }

    static async syncGaps(
        symbol: string,
        timeframe: Timeframe,
        providerOverride?: string,
        vaultName = 'schwab'
    ): Promise<{ gapsFixed: number, barsAdded: number }> {
        const report = await this.getHealth(symbol, timeframe, vaultName)
        let gapsFixed = 0
        let barsAdded = 0

        const { marketDataStore } = await import('./store')

        for (const gap of report.gaps) {
            try {
                const startUnix = Math.floor(gap.start.getTime() / 1000)
                const endUnix = Math.floor(gap.end.getTime() / 1000)

                const result = await marketDataStore.getHistoricalDataWithReport(symbol, timeframe, startUnix, endUnix, {
                    providerOverride,
                    vaultName
                })

                if (result.report.persistedBars > 0) {
                    gapsFixed++
                    barsAdded += result.report.persistedBars
                }
            } catch (error) {
                console.error(`Failed to sync gap for ${symbol} @ ${timeframe} in vault ${vaultName}:`, error)
            }
        }

        await this.refreshInventory(vaultName)

        return { gapsFixed, barsAdded }
    }
}
