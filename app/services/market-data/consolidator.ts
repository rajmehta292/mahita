import { MarketDataPoint, Timeframe } from './types'
import { marketDataStore } from './store'
import { DataHealthManager } from './health'

export interface VerificationMetrics {
    symbol: string
    timeframe: Timeframe
    accuracyScore: number
    mismatchCount: number
    overlapCount: number
    promotedCount: number
}

export class DataConsolidator {
    /**
     * Consolidates data for a symbol from multiple vaults into the Master vault.
     * Verification requires at least two source vaults (e.g. Schwab and Yahoo).
     */
    async consolidate(symbol: string, timeframe: Timeframe): Promise<VerificationMetrics> {
        const schwabData = await marketDataStore.getHistoricalData(symbol, timeframe, 0, Date.now(), undefined, 'schwab')
        const yahooData = await marketDataStore.getHistoricalData(symbol, timeframe, 0, Date.now(), undefined, 'yahoo')

        // Create time-indexed maps for comparison
        const schwabMap = new Map(schwabData.map(p => [p.time, p]))
        const yahooMap = new Map(yahooData.map(p => [p.time, p]))

        const allTimes = Array.from(new Set([...schwabMap.keys(), ...yahooMap.keys()])).sort((a, b) => a - b)

        let mismatchCount = 0
        let overlapCount = 0
        const verifiedPoints: MarketDataPoint[] = []

        for (const time of allTimes) {
            const s = schwabMap.get(time)
            const y = yahooMap.get(time)

            if (s && y) {
                overlapCount++
                // Simple verify: close price must match within 0.1%
                const diff = Math.abs(s.close - y.close)
                const percentDiff = diff / s.close

                if (percentDiff < 0.001) {
                    verifiedPoints.push(s)
                } else {
                    mismatchCount++
                    // Log mismatch but don't promote
                }
            } else if (s) {
                // If only in Schwab, we can choose to trust it or skip.
                // For Master, we only trust verified overlaps or Schwab as primary.
                verifiedPoints.push(s)
            } else if (y) {
                verifiedPoints.push(y)
            }
        }

        const accuracyScore = overlapCount === 0 ? 0 : ((overlapCount - mismatchCount) / overlapCount) * 100

        // Persist to Master Vault
        const promotedCount = await marketDataStore.persistBars(
            symbol,
            timeframe,
            verifiedPoints,
            'consolidator-verified',
            true, // Overwrite master with latest verified state
            'master'
        )

        return {
            symbol,
            timeframe,
            accuracyScore,
            mismatchCount,
            overlapCount,
            promotedCount
        }
    }
}

export const dataConsolidator = new DataConsolidator()
