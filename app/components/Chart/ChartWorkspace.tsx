'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ArrowUpRight, CandlestickChart, Cpu, GaugeCircle } from 'lucide-react'
import { MarketDataPoint } from '../../services/market-data/types'
import { MainLayout } from '../Layout/MainLayout'
import { SymbolHeader } from './SymbolHeader'
import { AuthEntryCta } from '../Auth/AuthEntryCta'
import { useUserPreferences } from '../../hooks/use-user-preferences'
import { useViewDemand } from '../../hooks/use-view-demand'
import { readJsonResponse } from '@/lib/app-errors'

const Chart = dynamic(() => import('../Chart'), { ssr: false })

interface ChartCatalogResponse {
    catalog?: Array<{ symbol: string; timeframes: string[] }>
}

interface ChartMarketDataResponse {
    data?: MarketDataPoint[]
    metadata?: {
        warnings?: string[]
    }
}

const TIMEFRAME_ORDER = ['1m', '3m', '5m', '10m', '15m', '30m', '45m', '1h', '2h', '3h', '4h', '1d', '1w', '1M']

export function ChartWorkspace() {
    const { data: session, status } = useSession()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { preferences } = useUserPreferences()
    const selectedSymbol = searchParams.get('symbol')?.trim().toUpperCase() || 'AAPL'
    const selectedTimeframe = searchParams.get('timeframe')?.trim() || '1d'
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [catalog, setCatalog] = useState<Array<{ symbol: string; timeframes: string[] }>>([])
    const [dataMessage, setDataMessage] = useState('Loading market data...')
    const requestIdRef = useRef(0)
    const chartType: 'Standard' | 'HeikinAshi' = 'Standard'
    const activeIndicators = ['Volume']

    useViewDemand({
        enabled: status === 'authenticated' && !!selectedSymbol,
        surface: 'chart',
        symbol: selectedSymbol,
        timeframe: selectedTimeframe,
        providerPreference: 'schwab',
        priorityScore: 1.5,
        refreshIntervalSeconds: preferences?.viewRefreshIntervalSeconds ?? 13,
    })

    const safeFetchJson = useCallback(async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
        try {
            const res = await fetch(url, options)
            if (res.redirected) {
                window.location.href = res.url
                return null
            }
            return await readJsonResponse<T>(res, `Request failed for ${url}.`)
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return null
            }
            console.warn(`[API Error] ${url}:`, error)
            return null
        }
    }, [])

    const replaceRoute = useCallback((nextSymbol: string, nextTimeframe: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('symbol', nextSymbol)
        params.set('timeframe', nextTimeframe)
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [pathname, router, searchParams])

    const updateRoute = useCallback((nextSymbol: string, nextTimeframe: string) => {
        setData([])
        setDataMessage('Loading market data...')
        replaceRoute(nextSymbol, nextTimeframe)
    }, [replaceRoute])

    useEffect(() => {
        if (status !== 'authenticated') {
            return
        }

        const fetchInventory = async () => {
            const json = await safeFetchJson<ChartCatalogResponse>('/api/platform/chart-catalog')
            if (json?.catalog) {
                setCatalog(json.catalog)
            }
        }

        void fetchInventory()
    }, [status, safeFetchJson])

    useEffect(() => {
        if (status !== 'authenticated' || !selectedSymbol) {
            return
        }

        const requestId = ++requestIdRef.current
        const controller = new AbortController()

        const fetchMarketData = async () => {
            setDataMessage('Loading market data...')
            const json = await safeFetchJson<ChartMarketDataResponse>(
                `/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`,
                { signal: controller.signal },
            )

            if (controller.signal.aborted || requestId !== requestIdRef.current) {
                return
            }

            if (json && Array.isArray(json.data)) {
                setData(json.data)

                if (json.data.length === 0) {
                    const warning = Array.isArray(json.metadata?.warnings) && json.metadata.warnings.length > 0
                        ? json.metadata.warnings[0]
                        : 'No bars are stored for this symbol and timeframe yet.'
                    setDataMessage(warning)
                } else {
                    setDataMessage('')
                }

                return
            }

            setData([])
            setDataMessage('Provider fetch failed or returned a non-JSON response.')
        }

        void fetchMarketData()

        return () => {
            controller.abort()
        }
    }, [safeFetchJson, selectedSymbol, selectedTimeframe, status])

    const availableSymbols = useMemo(() => {
        return Array.from(new Set([selectedSymbol, ...catalog.map((item) => item.symbol)])).sort()
    }, [catalog, selectedSymbol])

    const availableTimeframes = useMemo(() => {
        return [...(catalog.find((item) => item.symbol === selectedSymbol)?.timeframes ?? [])].sort((left, right) => {
            return TIMEFRAME_ORDER.indexOf(left) - TIMEFRAME_ORDER.indexOf(right)
        })
    }, [catalog, selectedSymbol])

    useEffect(() => {
        if (availableTimeframes.length > 0 && !availableTimeframes.includes(selectedTimeframe)) {
            replaceRoute(selectedSymbol, availableTimeframes[0])
        }
    }, [availableTimeframes, replaceRoute, selectedSymbol, selectedTimeframe])

    if (status === 'loading') {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center">
                    <div className="text-white">Loading...</div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center">
                    <AuthEntryCta className="bg-blue-500 text-white hover:bg-blue-600" />
                </div>
            </MainLayout>
        )
    }

    const latestPoint = data.length > 0 ? data[data.length - 1] : null
    const change = data.length > 1 ? data[data.length - 1].close - data[data.length - 2].close : 0
    const previousClose = data.length > 1 ? data[data.length - 2].close : 0
    const changePercent = previousClose > 0 ? (change / previousClose) * 100 : 0
    const statusTone = data.length > 0 ? 'text-emerald-300' : 'text-amber-300'
    const statusLabel = data.length > 0 ? `${data.length} bars loaded` : dataMessage || 'No cached bars loaded'
    const classicChartHref = `/superchart?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`
    const backtestHref = `/backtest?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`
    const editorHref = `/script-editor?symbol=${encodeURIComponent(selectedSymbol)}&timeframe=${encodeURIComponent(selectedTimeframe)}`
    const activeTraderHref = `/active-trader?symbol=${encodeURIComponent(selectedSymbol)}`

    return (
        <MainLayout showBottomPanel={false}>
            <div className="flex h-full flex-col overflow-hidden bg-[#131722]">
                <div className="flex-shrink-0">
                    <SymbolHeader
                        symbol={selectedSymbol}
                        timeframe={selectedTimeframe}
                        price={latestPoint?.close ?? 0}
                        change={change}
                        changePercent={changePercent}
                        availableSymbols={availableSymbols}
                        availableTimeframes={availableTimeframes.length > 0 ? availableTimeframes : undefined}
                        onSymbolChange={(nextSymbol) => updateRoute(nextSymbol, selectedTimeframe)}
                        onTimeframeChange={(nextTimeframe) => updateRoute(selectedSymbol, nextTimeframe)}
                    />
                    <div className="border-b border-[#2A2E39] bg-[#161B26] px-4 py-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Focused View</div>
                                <div className="mt-1 flex items-center gap-2 text-sm font-semibold text-white">
                                    <CandlestickChart className="h-4 w-4 text-blue-300" />
                                    MahaCharts view for fast browsing
                                </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Data Status</div>
                                <div className={`mt-1 text-sm font-semibold ${statusTone}`}>{statusLabel}</div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Preference Loop</div>
                                <div className="mt-1 text-sm font-semibold text-white">
                                    Refresh every {preferences?.viewRefreshIntervalSeconds ?? 13}s
                                </div>
                            </div>
                            <div className="ml-auto flex flex-wrap items-center gap-2">
                                <Link
                                    href={classicChartHref}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-blue-400/40 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-blue-100 transition hover:bg-blue-500/25"
                                >
                                    <ArrowUpRight className="h-4 w-4" />
                                    Open MahaCharts
                                </Link>
                                <Link
                                    href={backtestHref}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                                >
                                    <GaugeCircle className="h-4 w-4 text-emerald-300" />
                                    Backtest
                                </Link>
                                <Link
                                    href={editorHref}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                                >
                                    <Cpu className="h-4 w-4 text-violet-300" />
                                    Script Editor
                                </Link>
                                <Link
                                    href={activeTraderHref}
                                    className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                                >
                                    Trade
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex flex-1 overflow-hidden bg-[#131722]">
                    <div className="flex min-h-0 flex-1 flex-col">
                        <div className="grid gap-4 border-b border-[#2A2E39] bg-[#131722] px-4 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                            <div className="grid gap-3 sm:grid-cols-3">
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Latest Close</div>
                                    <div className="mt-2 text-2xl font-semibold text-white">
                                        {latestPoint ? `$${latestPoint.close.toFixed(2)}` : '--'}
                                    </div>
                                    <div className={`mt-1 text-sm font-medium ${change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                                        {change >= 0 ? '+' : ''}{change.toFixed(2)} ({change >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Visible Indicators</div>
                                    <div className="mt-2 flex flex-wrap gap-2">
                                        {activeIndicators.map((indicator) => (
                                            <span key={indicator} className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-100">
                                                {indicator}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Route State</div>
                                    <div className="mt-2 text-sm font-semibold text-white">{selectedSymbol} - {selectedTimeframe}</div>
                                    <div className="mt-1 text-sm text-slate-400">URL-driven state stays in sync with the focused chart.</div>
                                </div>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-[#171D2A] p-4">
                                <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Workspace Shortcuts</div>
                                <div className="mt-3 grid gap-2">
                                    <Link href={classicChartHref} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
                                        Jump into MahaCharts with current symbol/timeframe
                                    </Link>
                                    <Link href={backtestHref} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
                                        Run the same market through Backtester
                                    </Link>
                                    <Link href={editorHref} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
                                        Open Script Editor on this symbol
                                    </Link>
                                    <Link href={activeTraderHref} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/[0.08]">
                                        Open Active Trader order flow
                                    </Link>
                                </div>
                            </div>
                        </div>
                        {data.length > 0 ? (
                            <div className="min-h-0 flex-1">
                                <Chart
                                    key={`${selectedSymbol}:${selectedTimeframe}`}
                                    data={data}
                                    chartType={chartType}
                                    indicators={activeIndicators}
                                />
                            </div>
                        ) : (
                            <div className="flex flex-1 items-center justify-center px-6 text-center text-gray-400">
                                {dataMessage || 'No data available'}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
