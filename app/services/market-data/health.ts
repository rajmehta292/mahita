import prisma from "@/lib/prisma"
import { Timeframe } from "./types"

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
    healthScore: number // 0-100
    gaps: DataGap[]
}

export class DataHealthManager {
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
        const data = await prisma.marketData.findMany({
            where: { symbol, timeframe },
            orderBy: { time: 'asc' },
            select: { time: true }
        })

        if (data.length === 0) {
            return {
                symbol,
                timeframe,
                count: 0,
                startIndex: null,
                endIndex: null,
                healthScore: 0,
                gaps: []
            }
        }

        const interval = this.timeframeToSeconds(timeframe)
        const gaps: DataGap[] = []
        let missingBarsTotal = 0

        for (let i = 1; i < data.length; i++) {
            const diff = (data[i].time.getTime() - data[i - 1].time.getTime()) / 1000

            // Allow some slack (e.g., 20% jitter) but if it's > 1.5x interval, it's a gap
            if (diff > interval * 1.5) {
                // Ignore weekends for daily data (Friday to Monday is 3 days = 259200s)
                if (timeframe === '1d' && diff <= 3 * 86400) continue

                const missingBars = Math.round(diff / interval) - 1
                if (missingBars > 0) {
                    gaps.push({
                        start: data[i - 1].time,
                        end: data[i].time,
                        missingBars
                    })
                    missingBarsTotal += missingBars
                }
            }
        }

        const totalExpectedBars = data.length + missingBarsTotal
        const healthScore = Math.max(0, Math.min(100, (data.length / totalExpectedBars) * 100))

        return {
            symbol,
            timeframe,
            count: data.length,
            startIndex: data[0].time,
            endIndex: data[data.length - 1].time,
            healthScore: Math.round(healthScore),
            gaps
        }
    }

    static async getAllHealth(): Promise<HealthReport[]> {
        const inventory = await prisma.marketData.groupBy({
            by: ['symbol', 'timeframe']
        })

        const reports = await Promise.all(
            inventory.map(item => this.getHealth(item.symbol, item.timeframe as Timeframe))
        )

        return reports
    }
}
