import { MarketDataPoint } from './types'

export function calculateHeikinAshi(data: MarketDataPoint[]): MarketDataPoint[] {
    if (data.length === 0) return []

    const haData: MarketDataPoint[] = []

    // Initial HA Open/Close
    let prevOpen = (data[0].open + data[0].close) / 2
    let prevClose = (data[0].open + data[0].high + data[0].low + data[0].close) / 4

    haData.push({
        ...data[0],
        open: prevOpen,
        close: prevClose,
        high: Math.max(data[0].high, prevOpen, prevClose),
        low: Math.min(data[0].low, prevOpen, prevClose)
    })

    for (let i = 1; i < data.length; i++) {
        const current = data[i]

        const haClose = (current.open + current.high + current.low + current.close) / 4
        const haOpen = (prevOpen + prevClose) / 2
        const haHigh = Math.max(current.high, haOpen, haClose)
        const haLow = Math.min(current.low, haOpen, haClose)

        haData.push({
            ...current,
            open: haOpen,
            close: haClose,
            high: haHigh,
            low: haLow
        })

        prevOpen = haOpen
        prevClose = haClose
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
