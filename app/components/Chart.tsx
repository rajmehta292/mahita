import {
    CandlestickSeries,
    createChart,
    createSeriesMarkers,
    HistogramSeries,
    IChartApi,
    ISeriesApi,
    ISeriesMarkersPluginApi,
    LineSeries,
    LogicalRangeChangeEventHandler,
    SeriesMarker,
    Time,
} from 'lightweight-charts'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ATR, BollingerBands, EMA, MACD, RSI, SMA } from 'technicalindicators'
import type { MarketDataPoint } from '@/app/services/market-data/types'
import type { CompletedTrade } from '@/app/services/trading-engine/types'
import { calculateHeikinAshi } from '@/app/services/market-data/utils'
import { normalizeUnknownError } from '@/lib/app-errors'

interface ChartProps {
    data: MarketDataPoint[]
    trades?: CompletedTrade[]
    chartType?: 'Standard' | 'HeikinAshi'
    indicators?: string[]
    macdParams?: { fast: number, slow: number, signal: number }
}

type NormalizedIndicatorId = 'volume' | 'macd' | 'rsi' | 'ema' | 'sma' | 'bollinger' | 'vwap' | 'atr'
type OscillatorPaneId = 'macd' | 'rsi' | 'atr'

const OVERLAY_COLORS = {
    ema: '#22c55e',
    sma: '#f59e0b',
    vwap: '#60a5fa',
    bollingerBasis: '#cbd5f5',
    bollingerBand: '#94a3b8',
    rsi: '#a855f7',
    atr: '#fb7185',
    macd: '#2962FF',
    signal: '#FF6D00',
}

function toChartTime(value: string | number | Time): Time {
    if (typeof value === 'string') {
        return Math.floor(new Date(value).getTime() / 1000) as Time
    }

    return value as Time
}

function normalizeIndicatorId(value: string): NormalizedIndicatorId | null {
    const normalized = value.trim().toLowerCase().replace(/[\s_-]+/g, '')

    switch (normalized) {
        case 'volume':
            return 'volume'
        case 'macd':
        case 'movingaverageconvergencedivergence':
            return 'macd'
        case 'rsi':
        case 'relativestrengthindex':
            return 'rsi'
        case 'ema':
        case 'exponentialmovingaverage':
            return 'ema'
        case 'sma':
        case 'simplemovingaverage':
            return 'sma'
        case 'bollinger':
        case 'bollingerbands':
            return 'bollinger'
        case 'vwap':
            return 'vwap'
        case 'atr':
        case 'averagetruerange':
            return 'atr'
        default:
            return null
    }
}

function calculateVwapSeries(data: MarketDataPoint[]) {
    let cumulativePriceVolume = 0
    let cumulativeVolume = 0

    return data.map((bar) => {
        const volume = bar.volume ?? 0
        const typicalPrice = (bar.high + bar.low + bar.close) / 3
        cumulativePriceVolume += typicalPrice * volume
        cumulativeVolume += volume
        return cumulativeVolume > 0 ? cumulativePriceVolume / cumulativeVolume : typicalPrice
    })
}

function buildLineSeriesData(data: MarketDataPoint[], values: number[]) {
    const offset = data.length - values.length
    if (offset < 0) {
        return []
    }

    return values.map((value, index) => ({
        time: toChartTime(data[index + offset].time),
        value,
    }))
}

export default function Chart({
    data,
    trades,
    chartType = 'Standard',
    indicators = ['Volume'],
    macdParams = { fast: 12, slow: 26, signal: 9 },
}: ChartProps) {
    const mainContainerRef = useRef<HTMLDivElement>(null)
    const oscillatorContainerRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const [chartError, setChartError] = useState<string | null>(null)

    const mainChartRef = useRef<IChartApi | null>(null)
    const oscillatorChartsRef = useRef<Record<string, IChartApi>>({})
    const mainSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null)
    const overlaySeriesRef = useRef<Record<string, ISeriesApi<'Line'>>>({})
    const oscillatorSeriesRef = useRef<Record<string, Record<string, ISeriesApi<'Histogram'> | ISeriesApi<'Line'>>>>({})
    const markersPluginRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)

    const normalizedIndicators = useMemo(() => {
        const ids = indicators
            .map(normalizeIndicatorId)
            .filter((indicatorId): indicatorId is NormalizedIndicatorId => indicatorId !== null)

        return Array.from(new Set(ids))
    }, [indicators])

    const oscillatorPaneIds = useMemo(
        () => normalizedIndicators.filter((indicatorId): indicatorId is OscillatorPaneId => (
            indicatorId === 'macd' || indicatorId === 'rsi' || indicatorId === 'atr'
        )),
        [normalizedIndicators]
    )

    useEffect(() => {
        if (!mainContainerRef.current) {
            return
        }

        let disposed = false
        const mainSubscriptions: Array<() => void> = []
        const paneSubscriptions: Array<() => void> = []

        try {
            queueMicrotask(() => setChartError(null))

            const mainChart = createChart(mainContainerRef.current, {
                layout: { background: { color: '#f8fafc' }, textColor: '#475569' },
                grid: { vertLines: { color: '#d8e1eb' }, horzLines: { color: '#d8e1eb' } },
                crosshair: {
                    mode: 0,
                    vertLine: { width: 1, color: '#94a3b8', style: 2, labelBackgroundColor: '#111827' },
                    horzLine: { width: 1, color: '#94a3b8', style: 2, labelBackgroundColor: '#111827' },
                },
                handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
                handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
                kineticScroll: { touch: true, mouse: true },
                width: mainContainerRef.current.clientWidth,
                height: mainContainerRef.current.clientHeight || 520,
                timeScale: { visible: true, borderVisible: false },
                rightPriceScale: { borderVisible: false },
            })

            mainChartRef.current = mainChart
            mainSeriesRef.current = mainChart.addSeries(CandlestickSeries, {
                upColor: '#22c55e',
                downColor: '#ef4444',
                borderVisible: false,
                wickUpColor: '#22c55e',
                wickDownColor: '#ef4444',
            })
            markersPluginRef.current = createSeriesMarkers(mainSeriesRef.current, [])

            if (normalizedIndicators.includes('volume')) {
                volumeSeriesRef.current = mainChart.addSeries(HistogramSeries, {
                    color: '#16a34a55',
                    priceFormat: { type: 'volume' },
                    priceScaleId: '',
                })
                mainChart.priceScale('').applyOptions({
                    scaleMargins: { top: 0.86, bottom: 0.02 },
                })
            }

            if (normalizedIndicators.includes('ema')) {
                overlaySeriesRef.current.ema = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.ema,
                    lineWidth: 2,
                    priceLineVisible: false,
                })
            }

            if (normalizedIndicators.includes('sma')) {
                overlaySeriesRef.current.sma = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.sma,
                    lineWidth: 2,
                    priceLineVisible: false,
                })
            }

            if (normalizedIndicators.includes('vwap')) {
                overlaySeriesRef.current.vwap = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.vwap,
                    lineWidth: 2,
                    priceLineVisible: false,
                })
            }

            if (normalizedIndicators.includes('bollinger')) {
                overlaySeriesRef.current.bollingerUpper = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.bollingerBand,
                    lineWidth: 1,
                    priceLineVisible: false,
                })
                overlaySeriesRef.current.bollingerBasis = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.bollingerBasis,
                    lineWidth: 2,
                    priceLineVisible: false,
                })
                overlaySeriesRef.current.bollingerLower = mainChart.addSeries(LineSeries, {
                    color: OVERLAY_COLORS.bollingerBand,
                    lineWidth: 1,
                    priceLineVisible: false,
                })
            }

            oscillatorPaneIds.forEach((paneId) => {
                const container = oscillatorContainerRefs.current[paneId]
                if (!container) {
                    return
                }

                const paneChart = createChart(container, {
                    layout: { background: { color: '#f8fafc' }, textColor: '#64748b' },
                    grid: { vertLines: { color: '#d8e1eb' }, horzLines: { color: '#d8e1eb' } },
                    width: container.clientWidth,
                    height: container.clientHeight || 118,
                    timeScale: { visible: false, borderVisible: false },
                    rightPriceScale: { borderVisible: false },
                })

                oscillatorChartsRef.current[paneId] = paneChart
                oscillatorSeriesRef.current[paneId] = {}

                if (paneId === 'macd') {
                    oscillatorSeriesRef.current[paneId].histogram = paneChart.addSeries(HistogramSeries, {
                        priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
                    })
                    oscillatorSeriesRef.current[paneId].macd = paneChart.addSeries(LineSeries, {
                        color: OVERLAY_COLORS.macd,
                        lineWidth: 2,
                    })
                    oscillatorSeriesRef.current[paneId].signal = paneChart.addSeries(LineSeries, {
                        color: OVERLAY_COLORS.signal,
                        lineWidth: 2,
                    })
                }

                if (paneId === 'rsi') {
                    oscillatorSeriesRef.current[paneId].rsi = paneChart.addSeries(LineSeries, {
                        color: OVERLAY_COLORS.rsi,
                        lineWidth: 2,
                    })
                }

                if (paneId === 'atr') {
                    oscillatorSeriesRef.current[paneId].atr = paneChart.addSeries(LineSeries, {
                        color: OVERLAY_COLORS.atr,
                        lineWidth: 2,
                    })
                }

                const syncFromMain: LogicalRangeChangeEventHandler = (range) => {
                    if (disposed || !range) {
                        return
                    }

                    try {
                        paneChart.timeScale().setVisibleLogicalRange(range)
                    } catch {
                        // Ignore dispose races during hot reload.
                    }
                }

                const syncToMain: LogicalRangeChangeEventHandler = (range) => {
                    if (disposed || !range || !mainChartRef.current) {
                        return
                    }

                    try {
                        mainChartRef.current.timeScale().setVisibleLogicalRange(range)
                    } catch {
                        // Ignore dispose races during hot reload.
                    }
                }

                mainChart.timeScale().subscribeVisibleLogicalRangeChange(syncFromMain)
                paneChart.timeScale().subscribeVisibleLogicalRangeChange(syncToMain)
                mainSubscriptions.push(() => mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncFromMain))
                paneSubscriptions.push(() => paneChart.timeScale().unsubscribeVisibleLogicalRangeChange(syncToMain))
            })

            const handleResize = () => {
                if (disposed) {
                    return
                }

                if (mainChartRef.current && mainContainerRef.current) {
                    try {
                        mainChartRef.current.applyOptions({
                            width: mainContainerRef.current.clientWidth,
                            height: mainContainerRef.current.clientHeight || 520,
                        })
                    } catch {
                        // Ignore transient disposal errors.
                    }
                }

                oscillatorPaneIds.forEach((paneId) => {
                    const paneChart = oscillatorChartsRef.current[paneId]
                    const container = oscillatorContainerRefs.current[paneId]

                    if (!paneChart || !container) {
                        return
                    }

                    try {
                        paneChart.applyOptions({
                            width: container.clientWidth,
                            height: container.clientHeight || 118,
                        })
                    } catch {
                        // Ignore transient disposal errors.
                    }
                })
            }

            const resizeObserver = typeof ResizeObserver !== 'undefined'
                ? new ResizeObserver(() => handleResize())
                : null

            resizeObserver?.observe(mainContainerRef.current)
            oscillatorPaneIds.forEach((paneId) => {
                const container = oscillatorContainerRefs.current[paneId]
                if (container) {
                    resizeObserver?.observe(container)
                }
            })

            handleResize()
            window.addEventListener('resize', handleResize)

            return () => {
                disposed = true
                resizeObserver?.disconnect()
                window.removeEventListener('resize', handleResize)
                mainSubscriptions.forEach((unsubscribe) => unsubscribe())
                paneSubscriptions.forEach((unsubscribe) => unsubscribe())

                markersPluginRef.current?.detach()
                markersPluginRef.current = null
                mainSeriesRef.current = null
                volumeSeriesRef.current = null
                overlaySeriesRef.current = {}
                oscillatorSeriesRef.current = {}

                Object.values(oscillatorChartsRef.current).forEach((chart) => {
                    chart.remove()
                })
                oscillatorChartsRef.current = {}

                if (mainChartRef.current) {
                    const chart = mainChartRef.current
                    mainChartRef.current = null
                    chart.remove()
                }
            }
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'MahaCharts could not initialize the chart panel.')
            queueMicrotask(() => setChartError(normalized.message))
        }
    }, [normalizedIndicators, oscillatorPaneIds])

    useEffect(() => {
        if (!mainSeriesRef.current || data.length === 0) {
            return
        }

        try {
            queueMicrotask(() => setChartError(null))

            const candleInput = chartType === 'HeikinAshi' ? calculateHeikinAshi(data) : data
            const candleData = candleInput.map((bar) => ({
                time: toChartTime(bar.time),
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
            }))
            mainSeriesRef.current.setData(candleData)

            if (volumeSeriesRef.current) {
                volumeSeriesRef.current.setData(data.map((bar) => ({
                    time: toChartTime(bar.time),
                    value: bar.volume || 0,
                    color: bar.close >= bar.open ? '#22c55e70' : '#ef444470',
                })))
            }

            const closes = data.map((bar) => bar.close)
            const highs = data.map((bar) => bar.high)
            const lows = data.map((bar) => bar.low)

            if (overlaySeriesRef.current.ema) {
                overlaySeriesRef.current.ema.setData(buildLineSeriesData(data, EMA.calculate({
                    period: 21,
                    values: closes,
                })))
            }

            if (overlaySeriesRef.current.sma) {
                overlaySeriesRef.current.sma.setData(buildLineSeriesData(data, SMA.calculate({
                    period: 50,
                    values: closes,
                })))
            }

            if (overlaySeriesRef.current.vwap) {
                overlaySeriesRef.current.vwap.setData(buildLineSeriesData(data, calculateVwapSeries(data)))
            }

            if (
                overlaySeriesRef.current.bollingerUpper
                && overlaySeriesRef.current.bollingerBasis
                && overlaySeriesRef.current.bollingerLower
            ) {
                const bands = BollingerBands.calculate({
                    period: 20,
                    values: closes,
                    stdDev: 2,
                })
                const offset = data.length - bands.length
                const upper = bands.map((entry, index) => ({
                    time: toChartTime(data[index + offset].time),
                    value: entry.upper,
                }))
                const basis = bands.map((entry, index) => ({
                    time: toChartTime(data[index + offset].time),
                    value: entry.middle,
                }))
                const lower = bands.map((entry, index) => ({
                    time: toChartTime(data[index + offset].time),
                    value: entry.lower,
                }))
                overlaySeriesRef.current.bollingerUpper.setData(upper)
                overlaySeriesRef.current.bollingerBasis.setData(basis)
                overlaySeriesRef.current.bollingerLower.setData(lower)
            }

            if (
                oscillatorSeriesRef.current.macd?.histogram
                && oscillatorSeriesRef.current.macd?.macd
                && oscillatorSeriesRef.current.macd?.signal
            ) {
                const macdResults = MACD.calculate({
                    values: closes,
                    fastPeriod: macdParams.fast,
                    slowPeriod: macdParams.slow,
                    signalPeriod: macdParams.signal,
                    SimpleMAOscillator: false,
                    SimpleMASignal: false,
                })

                const offset = data.length - macdResults.length
                const histogramSeries = oscillatorSeriesRef.current.macd.histogram as ISeriesApi<'Histogram'>
                const macdSeries = oscillatorSeriesRef.current.macd.macd as ISeriesApi<'Line'>
                const signalSeries = oscillatorSeriesRef.current.macd.signal as ISeriesApi<'Line'>

                histogramSeries.setData(macdResults.map((entry, index) => {
                    const histogram = entry.histogram ?? 0
                    const previousHistogram = index > 0 ? macdResults[index - 1].histogram ?? 0 : 0
                    const color = histogram >= 0
                        ? histogram > previousHistogram ? '#22c55e' : '#bbf7d0'
                        : histogram > previousHistogram ? '#fecaca' : '#ef4444'

                    return {
                        time: toChartTime(data[index + offset].time),
                        value: histogram,
                        color,
                    }
                }))
                macdSeries.setData(macdResults.map((entry, index) => ({
                    time: toChartTime(data[index + offset].time),
                    value: entry.MACD ?? 0,
                })))
                signalSeries.setData(macdResults.map((entry, index) => ({
                    time: toChartTime(data[index + offset].time),
                    value: entry.signal ?? 0,
                })))
            }

            if (oscillatorSeriesRef.current.rsi?.rsi) {
                const rsiResults = RSI.calculate({
                    period: 14,
                    values: closes,
                })
                ;(oscillatorSeriesRef.current.rsi.rsi as ISeriesApi<'Line'>).setData(
                    buildLineSeriesData(data, rsiResults)
                )
            }

            if (oscillatorSeriesRef.current.atr?.atr) {
                const atrResults = ATR.calculate({
                    period: 14,
                    high: highs,
                    low: lows,
                    close: closes,
                })
                ;(oscillatorSeriesRef.current.atr.atr as ISeriesApi<'Line'>).setData(
                    buildLineSeriesData(data, atrResults)
                )
            }

            if (markersPluginRef.current) {
                const markers: SeriesMarker<Time>[] = []

                trades?.forEach((trade) => {
                    markers.push({
                        time: toChartTime(trade.entryTime),
                        position: trade.side === 'Long' ? 'belowBar' : 'aboveBar',
                        color: trade.side === 'Long' ? '#22c55e' : '#ef4444',
                        shape: trade.side === 'Long' ? 'arrowUp' : 'arrowDown',
                        text: `Entry ${trade.side}`,
                    })

                    if (trade.exitTime) {
                        markers.push({
                            time: toChartTime(trade.exitTime),
                            position: trade.side === 'Long' ? 'aboveBar' : 'belowBar',
                            color: '#f59e0b',
                            shape: trade.side === 'Long' ? 'arrowDown' : 'arrowUp',
                            text: `Exit ${trade.pnl.toFixed(2)}`,
                        })
                    }
                })

                markers.sort((left, right) => Number(left.time) - Number(right.time))
                markersPluginRef.current.setMarkers(markers)
            }

            mainChartRef.current?.timeScale().fitContent()
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'MahaCharts could not render the current chart state.')
            queueMicrotask(() => setChartError(normalized.message))
        }
    }, [chartType, data, macdParams, trades])

    if (chartError) {
        return (
            <div className="flex h-full items-center justify-center bg-[#f8fafc] px-6 text-center text-slate-900">
                <div className="max-w-md rounded-2xl border border-rose-500/20 bg-rose-50 px-6 py-5">
                    <p className="text-sm font-medium">Chart unavailable</p>
                    <p className="mt-2 text-sm text-rose-700">{chartError}</p>
                </div>
            </div>
        )
    }

    return (
        <div data-testid="mahacharts-chart-root" className="flex h-full min-h-[460px] w-full flex-col bg-[#f8fafc]">
            <div
                ref={mainContainerRef}
                data-testid="mahacharts-chart-main"
                className="relative min-h-[340px] w-full flex-1"
            />
            {oscillatorPaneIds.map((paneId) => (
                <div
                    key={paneId}
                    ref={(element) => {
                        oscillatorContainerRefs.current[paneId] = element
                    }}
                    data-testid={`mahacharts-chart-pane-${paneId}`}
                    className="h-[118px] w-full overflow-hidden border-t border-slate-200/80"
                />
            ))}
        </div>
    )
}
