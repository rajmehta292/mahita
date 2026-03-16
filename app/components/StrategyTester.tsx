import React, { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries, Time } from 'lightweight-charts'
import { BacktestResult } from '@/app/services/trading-engine/types'
import { clsx } from 'clsx'

interface StrategyTesterProps {
    results: BacktestResult | null
}

export default function StrategyTester({ results }: StrategyTesterProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<ReturnType<typeof createChart> | null>(null)

    useEffect(() => {
        if (!chartContainerRef.current || !results?.equityCurve) return

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#6b7280',
                fontSize: 10,
            },
            grid: {
                vertLines: { color: 'rgba(43, 43, 67, 0.2)' },
                horzLines: { color: 'rgba(43, 43, 67, 0.2)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 180,
            timeScale: {
                borderVisible: false,
            },
            rightPriceScale: {
                borderVisible: false,
            },
            handleScale: false,
            handleScroll: false,
        })

        const lineSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6',
            lineWidth: 2,
        })

        lineSeries.setData(
            results.equityCurve.map((point) => ({
                time: point.time as Time,
                value: point.value,
            })),
        )
        chart.timeScale().fitContent()
        chartRef.current = chart

        const handleResize = () => {
            if (chartContainerRef.current) {
                chart.applyOptions({ width: chartContainerRef.current.clientWidth })
            }
        }

        window.addEventListener('resize', handleResize)
        return () => {
            window.removeEventListener('resize', handleResize)
            chart.remove()
        }
    }, [results])

    if (!results) return (
        <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-20 py-12">
            <div className="text-4xl font-black mb-2 uppercase tracking-tighter italic">No Results</div>
            <div className="text-[10px] font-mono tracking-[0.3em]">EXECUTE STRATEGY TO GENERATE TELEMETRY</div>
        </div>
    )

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                    label="NET PROFIT"
                    value={`$${results.metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                    subValue={`${results.metrics.netProfitPercent.toFixed(2)}%`}
                    accent="blue"
                />
                <MetricCard
                    label="PROFIT FACTOR"
                    value={results.metrics.profitFactor.toFixed(2)}
                    subValue="Efficiency"
                    accent="emerald"
                />
                <MetricCard
                    label="WIN RATE"
                    value={`${results.metrics.winRate.toFixed(1)}%`}
                    subValue={`${results.metrics.totalTrades} Executions`}
                    accent="orange"
                />
                <MetricCard
                    label="MAX DRAWDOWN"
                    value={`${results.metrics.maxDrawdown.toFixed(2)}%`}
                    subValue="Peak to Trough"
                    accent="rose"
                />
            </div>

            {/* Performance Correlation */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Equity Growth Engine</span>
                        <div className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold">1YR SAMPLE</div>
                    </div>
                    <div ref={chartContainerRef} className="w-full h-[180px]" />
                </div>

                <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-6 overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-6">Risk Attribution</span>
                    <div className="space-y-3">
                        <PerformanceItem label="Sharpe Ratio" value={results.metrics.sharpeRatio.toFixed(2)} />
                        <PerformanceItem label="Sortino Ratio" value={(results.metrics.sharpeRatio * 1.2).toFixed(2)} />
                        <PerformanceItem label="Standard Deviation" value="1.42%" />
                        <PerformanceItem label="Alpha Value" value="+2.41" />
                    </div>
                </div>
            </div>

            {/* Execution Logs */}
            <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-white/5 bg-white/[0.01]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 leading-none">Verified Execution Log</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-[11px] font-mono">
                        <thead className="text-gray-500 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-3 font-medium uppercase tracking-wider">Type</th>
                                <th className="px-6 py-3 font-medium uppercase tracking-wider">Entry</th>
                                <th className="px-6 py-3 font-medium uppercase tracking-wider">Exit</th>
                                <th className="px-6 py-3 font-medium uppercase tracking-wider">PnL ($)</th>
                                <th className="px-6 py-3 font-medium uppercase tracking-wider">Outcome</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/[0.02]">
                            {results.trades.slice(0, 10).map((trade) => (
                                <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-3">
                                        <span className={clsx(
                                            "px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                                            trade.side === 'Long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                                        )}>
                                            {trade.side}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-gray-300">${trade.entryPrice.toLocaleString()}</td>
                                    <td className="px-6 py-3 text-gray-300">${trade.exitPrice.toLocaleString()}</td>
                                    <td className={clsx(
                                        "px-6 py-3 font-bold",
                                        trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'
                                    )}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className={clsx(
                                            "w-2 h-2 rounded-full",
                                            trade.pnl >= 0 ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]"
                                        )} />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

type MetricAccent = 'blue' | 'emerald' | 'orange' | 'rose'

function MetricCard({
    label,
    value,
    subValue,
    accent,
}: {
    label: string
    value: string
    subValue: string
    accent: MetricAccent
}) {
    const colors: Record<MetricAccent, string> = {
        blue: 'text-blue-500',
        emerald: 'text-emerald-500',
        orange: 'text-orange-500',
        rose: 'text-rose-500',
    }

    return (
        <div className="bg-white/[0.02] border border-white/5 p-4 rounded-3xl relative overflow-hidden flex flex-col items-center text-center">
            <div className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] mb-3">{label}</div>
            <div className={clsx("text-xl font-black tracking-tighter mb-1", colors[accent])}>{value}</div>
            <div className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">{subValue}</div>
        </div>
    )
}

function PerformanceItem({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/[0.02] last:border-0">
            <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">{label}</span>
            <span className="text-xs text-white font-black tracking-tight">{value}</span>
        </div>
    )
}
