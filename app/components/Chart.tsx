'use client'

import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts'
import React, { useEffect, useRef } from 'react'
import { MarketDataPoint } from '@/app/services/market-data/types'
import { CompletedTrade } from '@/app/services/trading-engine/types'

interface ChartProps {
    data: MarketDataPoint[]
    trades?: CompletedTrade[]
}

export default function Chart({ data, trades }: ChartProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<IChartApi | null>(null)
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)

    useEffect(() => {
        if (!chartContainerRef.current) return

        const handleResize = () => {
            chartRef.current?.applyOptions({ width: chartContainerRef.current?.clientWidth })
        }

        chartRef.current = createChart(chartContainerRef.current, {
            layout: {
                background: { color: '#1a1b1e' },
                textColor: '#C3C2D4',
            },
            grid: {
                vertLines: { color: '#2B2B43' },
                horzLines: { color: '#2B2B43' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 500,
        })

        chartRef.current.timeScale().fitContent()

        seriesRef.current = chartRef.current.addCandlestickSeries({
            upColor: '#26a69a',
            downColor: '#ef5350',
            borderVisible: false,
            wickUpColor: '#26a69a',
            wickDownColor: '#ef5350',
        })

        window.addEventListener('resize', handleResize)

        return () => {
            window.removeEventListener('resize', handleResize)
            chartRef.current?.remove()
        }
    }, [])

    useEffect(() => {
        if (!seriesRef.current || data.length === 0) return

        // Transform generic data to TradingView format
        const chartData = data.map(d => ({
            time: d.time as Time,
            open: d.open,
            high: d.high,
            low: d.low,
            close: d.close,
        }))

        seriesRef.current.setData(chartData)

        // Add Trade Markers if trades provided
        if (trades && trades.length > 0) {
            const markers: any[] = []

            trades.forEach(trade => {
                // Entry Marker
                markers.push({
                    time: trade.entryTime as Time,
                    position: trade.side === 'Long' ? 'belowBar' : 'aboveBar',
                    color: trade.side === 'Long' ? '#26a69a' : '#ef5350',
                    shape: trade.side === 'Long' ? 'arrowUp' : 'arrowDown',
                    text: `Entry ${trade.side}`,
                })

                // Exit Marker
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

            // Sort markers chronologically required by lightweight-charts
            markers.sort((a, b) => (a.time as number) - (b.time as number))
            seriesRef.current.setMarkers(markers)
        }

    }, [data, trades])

    return <div ref={chartContainerRef} className="w-full h-[500px]" />
}
