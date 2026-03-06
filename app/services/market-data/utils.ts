import { MarketDataPoint } from './types'

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
