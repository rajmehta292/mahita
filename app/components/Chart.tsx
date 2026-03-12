import { createChart, IChartApi, ISeriesApi, Time, CandlestickSeries, HistogramSeries, LineSeries } from 'lightweight-charts'
import React, { useEffect, useRef, useState } from 'react'
import { MarketDataPoint } from '@/app/services/market-data/types'
import { CompletedTrade } from '@/app/services/trading-engine/types'
import { calculateHeikinAshi } from '@/app/services/market-data/utils'
import { MACD, RSI } from 'technicalindicators'
import { normalizeUnknownError } from '@/lib/app-errors'

interface ChartProps {
    data: MarketDataPoint[]
    trades?: CompletedTrade[]
    chartType?: 'Standard' | 'HeikinAshi'
    indicators?: string[] // ['MACD', 'RSI', 'Volume']
    macdParams?: { fast: number, slow: number, signal: number }
}

export default function Chart({
    data,
    trades,
    chartType = 'Standard',
    indicators = ['Volume'],
    macdParams = { fast: 12, slow: 26, signal: 9 }
}: ChartProps) {
    const mainContainerRef = useRef<HTMLDivElement>(null)
    const oscillatorContainerRef = useRef<HTMLDivElement>(null)
    const [chartError, setChartError] = useState<string | null>(null)

    const mainChartRef = useRef<IChartApi | null>(null)
    const oscChartRef = useRef<IChartApi | null>(null)

    const mainSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
    const macdSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null)
    const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null)
    const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null)

    useEffect(() => {
        if (!mainContainerRef.current) return
        try {
            setChartError(null)

            const handleResize = () => {
                if (mainChartRef.current && mainContainerRef.current) {
                    mainChartRef.current.applyOptions({ width: mainContainerRef.current.clientWidth })
                }
                if (oscChartRef.current && oscillatorContainerRef.current) {
                    oscChartRef.current.applyOptions({ width: oscillatorContainerRef.current.clientWidth })
                }
            }

            // --- Create Main Chart ---
            const mainChart = createChart(mainContainerRef.current, {
                layout: { background: { color: '#1a1b1e' }, textColor: '#C3C2D4' },
                grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
                crosshair: {
                    mode: 0,
                    vertLine: { width: 1, color: '#C3C2D4', style: 2, labelBackgroundColor: '#26a69a' },
                    horzLine: { width: 1, color: '#C3C2D4', style: 2, labelBackgroundColor: '#26a69a' },
                },
                handleScale: { mouseWheel: true, pinch: true, axisPressedMouseMove: true },
                handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
                kineticScroll: { touch: true, mouse: true },
                width: mainContainerRef.current.clientWidth,
                height: indicators.includes('MACD') ? 350 : 500,
                timeScale: { visible: true, borderVisible: false }
            })

            mainChartRef.current = mainChart
            mainSeriesRef.current = mainChart.addSeries(CandlestickSeries, {
                upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
                wickUpColor: '#26a69a', wickDownColor: '#ef5350',
            })

            if (indicators.includes('Volume')) {
                volumeSeriesRef.current = mainChart.addSeries(HistogramSeries, {
                    color: '#26a69a40',
                    priceFormat: { type: 'volume' },
                    priceScaleId: '', // overlay
                })
                mainChart.priceScale('').applyOptions({
                    scaleMargins: { top: 0.8, bottom: 0 },
                })
            }

            // --- Create Oscillator Chart (MACD) ---
            let oscChart: IChartApi | null = null
            let syncUnsubMain: (() => void) | null = null
            let syncUnsubOsc: (() => void) | null = null

            if (indicators.includes('MACD') && oscillatorContainerRef.current) {
                oscChart = createChart(oscillatorContainerRef.current, {
                    layout: { background: { color: '#1a1b1e' }, textColor: '#C3C2D4' },
                    grid: { vertLines: { color: '#2B2B43' }, horzLines: { color: '#2B2B43' } },
                    width: oscillatorContainerRef.current.clientWidth,
                    height: 200,
                    timeScale: { visible: false },
                })
                oscChartRef.current = oscChart

                macdSeriesRef.current = oscChart.addSeries(HistogramSeries, {
                    color: '#26a69a',
                    priceFormat: { type: 'volume' },
                })
                macdLineRef.current = oscChart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 })
                macdSignalRef.current = oscChart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 2 })

                // Sync Time Scales
                const onVisibleLogicalRangeChangeMain = (range: any) => {
                    if (oscChartRef.current) oscChartRef.current.timeScale().setVisibleLogicalRange(range)
                }
                const onVisibleLogicalRangeChangeOsc = (range: any) => {
                    if (mainChartRef.current) mainChartRef.current.timeScale().setVisibleLogicalRange(range)
                }

                mainChart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeMain)
                oscChart.timeScale().subscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeOsc)

                syncUnsubMain = () => mainChart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeMain)
                if (oscChart) {
                    const chart = oscChart;
                    syncUnsubOsc = () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(onVisibleLogicalRangeChangeOsc)
                }
            }

            window.addEventListener('resize', handleResize)

            return () => {
                window.removeEventListener('resize', handleResize)

                // Unsubscribe first to prevent sync crashes during destruction
                if (syncUnsubMain) syncUnsubMain()
                if (syncUnsubOsc) syncUnsubOsc()

                if (mainChartRef.current) {
                    const c = mainChartRef.current
                    mainChartRef.current = null // Null out immediately to prevent resize races
                    c.remove()
                }
                if (oscChartRef.current) {
                    const c = oscChartRef.current
                    oscChartRef.current = null
                    c.remove()
                }

                mainSeriesRef.current = null
                volumeSeriesRef.current = null
                macdSeriesRef.current = null
                macdLineRef.current = null
                macdSignalRef.current = null
            }
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Mahita could not initialize the chart panel.')
            setChartError(normalized.message)
        }
    }, [indicators]) // Rebuild on indicator toggle

    useEffect(() => {
        if (!mainSeriesRef.current || data.length === 0) return
        try {
            setChartError(null)
            const activeData = chartType === 'HeikinAshi' ? calculateHeikinAshi(data) : data

            // Main Candles
            const chartData = activeData.map(d => ({
                time: (typeof d.time === 'string' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time) as Time,
                open: d.open, high: d.high, low: d.low, close: d.close,
            }))
            mainSeriesRef.current.setData(chartData)

        // Volume
            if (volumeSeriesRef.current) {
            volumeSeriesRef.current.setData(data.map(d => ({
                time: (typeof d.time === 'string' ? Math.floor(new Date(d.time).getTime() / 1000) : d.time) as Time,
                value: d.volume || 0,
                color: d.close >= d.open ? '#26a69a80' : '#ef535080'
            })))
            }

            if (mainChartRef.current && data.length > 0) {
            mainChartRef.current.timeScale().fitContent()
            }

        // MACD v6 Logic
            if (macdSeriesRef.current && macdLineRef.current && macdSignalRef.current) {
            const closes = data.map(d => d.close)
            const macdInput = {
                values: closes,
                fastPeriod: macdParams.fast,
                slowPeriod: macdParams.slow,
                signalPeriod: macdParams.signal,
                SimpleMAOscillator: false,
                SimpleMASignal: false
            }
            const macdData = MACD.calculate(macdInput)

            // Align with time scale (data starts after slowPeriod + signalPeriod - 2 roughly)
            const offset = data.length - macdData.length

            const histData = macdData.map((m, i) => {
                const hist = m.histogram || 0
                const prevHist = i > 0 ? macdData[i - 1].histogram || 0 : 0

                // Pine Script v6 Color Logic:
                // hist >= 0 ? hist > hist[1] ? #26a69a : #b2dfdb : hist > hist[1] ? #ffcdd2 : #ff5252
                let color = '#26a69a' // Dark Teal (Bullish Rising)
                if (hist >= 0) {
                    color = hist > prevHist ? '#26a69a' : '#b2dfdb' // Light Teal (Bullish Falling)
                } else {
                    color = hist > prevHist ? '#ffcdd2' : '#ff5252' // Light Red (Bearish Rising) -> Red (Bearish Falling)
                }

                return {
                    time: data[i + offset].time as Time,
                    value: hist,
                    color
                }
            })

            const lineData = macdData.map((m, i) => ({
                time: data[i + offset].time as Time,
                value: m.MACD || 0
            }))

            const signalData = macdData.map((m, i) => ({
                time: data[i + offset].time as Time,
                value: m.signal || 0
            }))

                macdSeriesRef.current.setData(histData)
                macdLineRef.current.setData(lineData)
                macdSignalRef.current.setData(signalData)
            }

        // Add Trade Markers if trades provided
            if (trades && trades.length > 0 && mainSeriesRef.current) {
            const markers: any[] = []

            trades.forEach(trade => {
                markers.push({
                    time: trade.entryTime as Time,
                    position: trade.side === 'Long' ? 'belowBar' : 'aboveBar',
                    color: trade.side === 'Long' ? '#26a69a' : '#ef5350',
                    shape: trade.side === 'Long' ? 'arrowUp' : 'arrowDown',
                    text: `Entry ${trade.side}`,
                })

                if (trade.exitTime) {
                    markers.push({
                        time: trade.exitTime as Time,
                        position: trade.side === 'Long' ? 'aboveBar' : 'belowBar',
                        color: '#e1ad01',
                        shape: trade.side === 'Long' ? 'arrowDown' : 'arrowUp',
                        text: `Exit PnL: ${trade.pnl.toFixed(2)}`,
                    })
                }
            })

            markers.sort((a, b) => (a.time as number) - (b.time as number));

                if (mainSeriesRef.current && typeof (mainSeriesRef.current as any).setMarkers === 'function') {
                    (mainSeriesRef.current as any).setMarkers(markers);
                } else {
                    console.warn('[Chart] setMarkers not available on mainSeries');
                }
            }
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Mahita could not render the current chart state.')
            setChartError(normalized.message)
        }
    }, [data, trades, chartType, macdParams])

    if (chartError) {
        return (
            <div className="h-full flex items-center justify-center bg-[#11141c] px-6 text-center text-white">
                <div className="max-w-md rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-5">
                    <p className="text-sm font-medium">Chart unavailable</p>
                    <p className="mt-2 text-sm text-rose-100/80">{chartError}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col w-full h-full min-h-[400px] lg:min-h-[600px]">
            <div ref={mainContainerRef} className="w-full flex-grow relative" style={{ minHeight: '300px' }} />
            <div
                ref={oscillatorContainerRef}
                className={`w-full overflow-hidden transition-all duration-300 ${indicators.includes('MACD') ? 'h-[180px] mt-4' : 'h-0'}`}
                style={{ borderTop: indicators.includes('MACD') ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
            />
        </div>
    )
}
