import { createHash } from 'crypto'
import { PineTS } from 'pinets'
import type { MarketDataPoint } from '../market-data/types'

export type PinetsSeriesMap = Record<string, number[]>
const PREPARED_SERIES_CACHE = new Map<string, PinetsSeriesMap>()

function toPinetsCandles(data: MarketDataPoint[], timeframe: string) {
    const tfSeconds = timeframe === '1m'
        ? 60
        : timeframe === '15m'
            ? 900
            : timeframe === '1h'
                ? 3600
                : timeframe === '1d'
                    ? 86400
                    : 60

    return data.map((bar, index) => ({
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
        volume: bar.volume,
        openTime: bar.time * 1000,
        closeTime: index < data.length - 1
            ? data[index + 1].time * 1000
            : (bar.time + tfSeconds) * 1000,
    }))
}

function sanitizeForIndicatorPreparation(script: string) {
    const lines = script.replace(/\r\n/g, '\n').split('\n')
    const kept: string[] = ['//@version=6', 'indicator("Mahita PineTS Preparation", overlay=true)']
    const plotTargets: string[] = []
    let skipDebugBlock = false
    let debugIndent = -1

    for (const rawLine of lines) {
        const trimmed = rawLine.trim()
        if (!trimmed || trimmed.startsWith('//')) {
            continue
        }

        const indent = rawLine.match(/^\s*/)?.[0].length ?? 0

        if (skipDebugBlock) {
            if (indent <= debugIndent && trimmed.length > 0) {
                skipDebugBlock = false
            } else {
                continue
            }
        }

        if (/^if\s+showDebug\s+and\s+barstate\.islast/.test(trimmed)) {
            skipDebugBlock = true
            debugIndent = indent
            continue
        }

        if (/^(strategy|indicator)\s*\(/.test(trimmed)) {
            continue
        }

        if (/^(plot|plotshape|plotchar|label\.)/.test(trimmed)) {
            continue
        }

        if (/^\w+\s*=\s*input\./.test(trimmed)) {
            kept.push(trimmed)
            continue
        }

        const destructuredMatch = trimmed.match(/^\[([^\]]+)\]\s*=\s*(ta\.[A-Za-z_]\w*\([^)]*\))$/)
        if (destructuredMatch) {
            const targets = destructuredMatch[1]
                .split(',')
                .map((target) => target.trim())
                .filter(Boolean)
            plotTargets.push(...targets)
            kept.push(trimmed)
            continue
        }

        const assignmentMatch = trimmed.match(/^([A-Za-z_]\w*)\s*=\s*(ta\.[A-Za-z_]\w*\([^)]*\))$/)
        if (assignmentMatch) {
            plotTargets.push(assignmentMatch[1])
            kept.push(trimmed)
        }
    }

    for (const target of Array.from(new Set(plotTargets))) {
        kept.push(`plot(${target}, "${target}")`)
    }

    return kept.join('\n')
}

function buildSeriesArrayFromPlot(
    plotEntries: Array<{ time: number; value: number }>,
    data: MarketDataPoint[]
) {
    const byTime = new Map<number, number>()
    for (const entry of plotEntries) {
        byTime.set(Math.floor(entry.time / 1000), entry.value)
    }

    return data.map((bar) => {
        const value = byTime.get(bar.time)
        return typeof value === 'number' ? value : Number.NaN
    })
}

function buildDataHash(data: MarketDataPoint[]) {
    const hash = createHash('sha256')
    for (const bar of data) {
        hash.update(`${bar.time}:${bar.open}:${bar.high}:${bar.low}:${bar.close}:${bar.volume}|`)
    }

    return hash.digest('hex')
}

export async function preparePinetsSeries(
    data: MarketDataPoint[],
    script: string,
    timeframe: string
): Promise<PinetsSeriesMap> {
    const prepSource = sanitizeForIndicatorPreparation(script)
    const cacheKey = `${timeframe}:${buildDataHash(data)}:${createHash('sha256').update(prepSource).digest('hex')}`
    const cached = PREPARED_SERIES_CACHE.get(cacheKey)
    if (cached) {
        return cached
    }

    const pine = new PineTS(toPinetsCandles(data, timeframe), 'MAHITA', timeframe, data.length)
    const context = await pine.run(prepSource)
    const plots = context.plots ?? {}
    const series: PinetsSeriesMap = {}

    for (const [title, plot] of Object.entries<any>(plots)) {
        if (!plot?.data) {
            continue
        }
        series[title] = buildSeriesArrayFromPlot(plot.data, data)
    }

    PREPARED_SERIES_CACHE.set(cacheKey, series)
    return series
}

export async function validateWithPinets(script: string) {
    const syntheticData: MarketDataPoint[] = Array.from({ length: 60 }, (_, index) => ({
        time: 1_700_000_000 + index * 60,
        open: 100 + index * 0.3,
        high: 100 + index * 0.3 + 0.8,
        low: 100 + index * 0.3 - 0.8,
        close: 100 + index * 0.3 + (index % 2 === 0 ? 0.2 : -0.1),
        volume: 1000 + index * 5,
    }))

    await preparePinetsSeries(syntheticData, script, '1m')
}
