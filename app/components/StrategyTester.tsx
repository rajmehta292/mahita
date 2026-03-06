import React, { useEffect, useRef } from 'react'
import { createChart, ColorType, LineSeries } from 'lightweight-charts'
import { BacktestResult, CompletedTrade } from '@/app/services/trading-engine/types'

interface StrategyTesterProps {
    results: BacktestResult | null
}

export default function StrategyTester({ results }: StrategyTesterProps) {
    const chartContainerRef = useRef<HTMLDivElement>(null)
    const chartRef = useRef<any>(null)

    useEffect(() => {
        if (!chartContainerRef.current || !results?.equityCurve) return

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: 'transparent' },
                textColor: '#C3C2D4',
            },
            grid: {
                vertLines: { color: 'rgba(43, 43, 67, 0.5)' },
                horzLines: { color: 'rgba(43, 43, 67, 0.5)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: 300,
            timeScale: {
                borderVisible: false,
            },
            rightPriceScale: {
                borderVisible: false,
            },
        })

        const lineSeries = chart.addSeries(LineSeries, {
            color: '#26a69a',
            lineWidth: 2,
        })

        lineSeries.setData(results.equityCurve as any)

        // Add Benchmark if available (simulated for now by showing a reference line or similar)

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

    if (!results) return null

    return (
        <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Summary Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard
                    label="Net Profit"
                    value={`$${results.metrics.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    subValue={`${results.metrics.netProfitPercent.toFixed(2)}%`}
                    trend={results.metrics.netProfit >= 0 ? 'up' : 'down'}
                />
                <MetricCard
                    label="Win Rate"
                    value={`${results.metrics.winRate.toFixed(1)}%`}
                    subValue={`${results.metrics.totalTrades} total trades`}
                />
                <MetricCard
                    label="Max Drawdown"
                    value={`${results.metrics.maxDrawdown.toFixed(2)}%`}
                    color="text-red-400"
                />
                <MetricCard
                    label="Sharpe Ratio"
                    value={results.metrics.sharpeRatio.toFixed(2)}
                    subValue={`vs. Benchmark: ${results.metrics.benchmarkReturnPercent.toFixed(2)}%`}
                />
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Equity Curve */}
                <div className="lg:col-span-2 bg-[#1a1b1e]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6">
                    <h3 className="text-sm font-medium text-white/60 mb-6 uppercase tracking-wider">Equity Curve</h3>
                    <div ref={chartContainerRef} className="w-full h-[300px]" />
                </div>

                {/* Performance Table */}
                <div className="bg-[#1a1b1e]/60 backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden flex flex-col">
                    <h3 className="text-sm font-medium text-white/60 mb-6 uppercase tracking-wider">Performance Detailed</h3>
                    <div className="space-y-4 flex-grow">
                        <PerformanceItem label="Profit Factor" value={results.metrics.profitFactor.toFixed(2)} />
                        <PerformanceItem label="Avg. Trade Duration" value="~14 bars" />
                        <PerformanceItem label="Recovery Factor" value={(results.metrics.netProfit / (results.metrics.maxDrawdown || 1)).toFixed(2)} />
                        <PerformanceItem label="Total Closed PnL" value={`$${results.metrics.netProfit.toFixed(2)}`} />
                    </div>
                    <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/5">
                        <div className="text-[10px] text-white/40 uppercase mb-1">Buy & Hold Return</div>
                        <div className="text-lg font-semibold text-white/80">{results.metrics.benchmarkReturnPercent.toFixed(2)}%</div>
                    </div>
                </div>
            </div>

            {/* Trade Log */}
            <div className="bg-[#1a1b1e]/60 backdrop-blur-xl border border-white/5 rounded-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5">
                    <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Execution Log</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.02] text-white/40 border-b border-white/5">
                            <tr>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">Side</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">Entry Price</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">Exit Price</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">Quantity</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">Duration</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">PnL ($)</th>
                                <th className="px-6 py-4 font-medium uppercase text-[10px]">PnL (%)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {results.trades.map((trade, idx) => (
                                <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.side === 'Long' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                                            {trade.side}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-white/80">${trade.entryPrice.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-white/80">${trade.exitPrice.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-white/60">{trade.quantity.toFixed(2)}</td>
                                    <td className="px-6 py-4 text-white/60">{trade.durationBars} bars</td>
                                    <td className={`px-6 py-4 font-medium ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {trade.pnl >= 0 ? '+' : ''}{trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </td>
                                    <td className={`px-6 py-4 font-medium ${trade.pnlPercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
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

function MetricCard({ label, value, subValue, trend, color }: any) {
    return (
        <div className="bg-[#1a1b1e]/60 backdrop-blur-xl border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/10 to-transparent rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-110" />
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">{label}</div>
            <div className={`text-2xl font-bold ${color || 'text-white/90'} tracking-tight`}>{value}</div>
            <div className="mt-1 flex items-center space-x-2">
                {subValue && <span className="text-xs text-white/40 font-medium">{subValue}</span>}
                {trend && (
                    <span className={`text-[10px] font-bold ${trend === 'up' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {trend === 'up' ? '▲ POSITIVE' : '▼ NEGATIVE'}
                    </span>
                )}
            </div>
        </div>
    )
}

function PerformanceItem({ label, value }: { label: string, value: string }) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/[0.02]">
            <span className="text-xs text-white/40 font-medium">{label}</span>
            <span className="text-sm text-white/80 font-semibold">{value}</span>
        </div>
    )
}
