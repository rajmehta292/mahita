import { MarketDataPoint, TimeRange, Timeframe } from './types'
import { timeframeToSeconds } from './timeframe-math'
export { timeframeToSeconds }

export function isCryptoSymbol(symbol: string): boolean {
    return symbol.includes('-USD')
}

export function shouldIgnoreMissingSpan(symbol: string, timeframe: Timeframe, diffSeconds: number): boolean {
    const isCrypto = isCryptoSymbol(symbol)
    if (isCrypto) return false

    if (timeframe === '1d' && diffSeconds <= 4 * 86400) {
        return true
    }

    if (timeframe.endsWith('m') || timeframe.endsWith('h')) {
        const sessionBreakFloor = Math.max(4 * timeframeToSeconds(timeframe), 4 * 3600)
        if (diffSeconds >= sessionBreakFloor && diffSeconds <= 84 * 3600) {
            return true
        }
    }

    return false
}

export function getMissingRanges(
    symbol: string,
    timeframe: Timeframe,
    data: MarketDataPoint[],
    startTime: number,
    endTime: number
): TimeRange[] {
    if (startTime >= endTime) return []

    const interval = timeframeToSeconds(timeframe)
    if (interval <= 0) {
        return [{ startTime, endTime }]
    }

    if (data.length === 0) {
        return [{ startTime, endTime }]
    }

    const sortedData = [...data].sort((a, b) => a.time - b.time)
    const ranges: TimeRange[] = []

    const firstBarTime = sortedData[0].time
    if (firstBarTime > startTime + Math.floor(interval * 0.5)) {
        ranges.push({
            startTime,
            endTime: Math.min(endTime, Math.max(startTime, firstBarTime - interval))
        })
    }

    for (let i = 1; i < sortedData.length; i++) {
        const previous = sortedData[i - 1]
        const current = sortedData[i]
        const diff = current.time - previous.time

        if (diff <= interval * 1.5 || shouldIgnoreMissingSpan(symbol, timeframe, diff)) {
            continue
        }

        const gapStart = previous.time + interval
        const gapEnd = current.time - interval

        if (gapStart <= gapEnd) {
            ranges.push({
                startTime: Math.max(startTime, gapStart),
                endTime: Math.min(endTime, gapEnd)
            })
        }
    }

    const lastBarTime = sortedData[sortedData.length - 1].time
    if (lastBarTime < endTime - Math.floor(interval * 0.5)) {
        ranges.push({
            startTime: Math.max(startTime, lastBarTime + interval),
            endTime
        })
    }

    return ranges.filter(range => range.startTime <= range.endTime)
}

export function dedupeMarketDataPoints(points: MarketDataPoint[]): MarketDataPoint[] {
    const byTime = new Map<number, MarketDataPoint>()

    for (const point of points) {
        byTime.set(point.time, point)
    }

    return [...byTime.values()].sort((a, b) => a.time - b.time)
}

export function calculateHeikinAshi(data: MarketDataPoint[]): MarketDataPoint[] {
    if (data.length === 0) return []

    // Ensure data is sorted by time ascending for HA calculation
    const getTime = (t: string | number) => typeof t === 'number' ? t : new Date(t).getTime()
    const sortedData = [...data].sort((a, b) => getTime(a.time) - getTime(b.time))
    const haData: MarketDataPoint[] = []

    // Initial HA Open/Close (First candle)
    let haOpen = (Number(sortedData[0].open) + Number(sortedData[0].close)) / 2
    let haClose = (Number(sortedData[0].open) + Number(sortedData[0].high) + Number(sortedData[0].low) + Number(sortedData[0].close)) / 4

    haData.push({
        ...sortedData[0],
        open: haOpen,
        close: haClose,
        high: Math.max(Number(sortedData[0].high), haOpen, haClose),
        low: Math.min(Number(sortedData[0].low), haOpen, haClose)
    })

    // Loop through remaining candles
    for (let i = 1; i < sortedData.length; i++) {
        const current = sortedData[i]

        const open = Number(current.open)
        const high = Number(current.high)
        const low = Number(current.low)
        const close = Number(current.close)

        // HA Formulas:
        // Close = Average of OHLC
        // Open = Average of previous HA Open and previous HA Close
        // High = Max of High, HA Open, HA Close
        // Low = Min of Low, HA Open, HA Close
        const currentHAClose = (open + high + low + close) / 4
        const currentHAOpen = (haOpen + haClose) / 2
        const currentHAHigh = Math.max(high, currentHAOpen, currentHAClose)
        const currentHALow = Math.min(low, currentHAOpen, currentHAClose)

        haData.push({
            ...current,
            open: currentHAOpen,
            close: currentHAClose,
            high: currentHAHigh,
            low: currentHALow
        })

        // Store for next iteration
        haOpen = currentHAOpen
        haClose = currentHAClose
    }

    return haData
}

export interface MACDResult {
    time: number
    macd: number
    signal: number
    histogram: number
    color: string
}

export function calculateMACD(data: number[], times: number[], fast = 12, slow = 26, signal = 9): MACDResult[] {
    // Basic MACD logic using EMAs
    // Since we want to use 'technicalindicators' eventually but let's implement basic for now to ensure 4-color logic matches Pine Script v6

    // Using simple EMA calculation for now or just the technicalindicators lib if we prefer robust
    // For the sake of accuracy to Pine Script v6, we need EMA comparisons.
    return [] // Placeholder for now, will implement with library below
}
