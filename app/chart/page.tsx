'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { MarketDataPoint } from '../services/market-data/types'
import { MainLayout } from '../components/Layout/MainLayout'
import { SymbolHeader } from '../components/Chart/SymbolHeader'
import { ChartToolbar } from '../components/Chart/ChartToolbar'
import { RightPanel } from '../components/Chart/RightPanel'
import { AuthEntryCta } from '../components/Auth/AuthEntryCta'

const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

export default function ChartPage() {
    const { data: session, status } = useSession()
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [catalog, setCatalog] = useState<Array<{ symbol: string; timeframes: string[] }>>([])
    const [dataMessage, setDataMessage] = useState('Loading market data...')
    const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
    const [selectedTimeframe, setSelectedTimeframe] = useState("1d")

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search)
            const sym = urlParams.get('symbol')
            const tf = urlParams.get('timeframe')
            if (sym) setSelectedSymbol(sym.toUpperCase())
            if (tf) setSelectedTimeframe(tf)
        }
    }, [])
    const chartType: 'Standard' | 'HeikinAshi' = 'Standard'
    const activeIndicators = ['Volume']

    const safeFetchJson = useCallback(async (url: string, options?: RequestInit) => {
        try {
            const res = await fetch(url, options)
            if (res.redirected) {
                window.location.href = res.url
                return null
            }
            if (!res.ok) {
                const text = await res.text()
                if (text.trim().startsWith('<!DOCTYPE') || text.trim().startsWith('<html')) {
                    throw new Error(`Server returned HTML instead of JSON (Status ${res.status}).`)
                }
                const errorData = JSON.parse(text)
                throw new Error(errorData.error || `Request failed with status ${res.status}`)
            }
            const contentType = res.headers.get('content-type')
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Server did not return a JSON response.')
            }
            return await res.json()
        } catch (error) {
            console.warn(`[API Error] ${url}:`, error)
            return null
        }
    }, [])

    useEffect(() => {
        if (status !== 'authenticated') return
        const fetchInventory = async () => {
            const json = await safeFetchJson('/api/platform/chart-catalog')
            if (json?.catalog) setCatalog(json.catalog)
        }
        fetchInventory()
    }, [status, safeFetchJson])

    useEffect(() => {
        if (status !== 'authenticated' || !selectedSymbol) return
        const fetchMarketData = async () => {
            setDataMessage('Loading market data...')
            const json = await safeFetchJson(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)

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
            } else {
                setData([])
                setDataMessage('Provider fetch failed or returned a non-JSON response.')
            }
        }
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe, status, safeFetchJson])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const params = new URLSearchParams(window.location.search)
        params.set('symbol', selectedSymbol)
        params.set('timeframe', selectedTimeframe)
        const nextUrl = `${window.location.pathname}?${params.toString()}`
        window.history.replaceState({}, '', nextUrl)
    }, [selectedSymbol, selectedTimeframe])

    const availableSymbols = Array.from(
        new Set([selectedSymbol, ...catalog.map((item) => item.symbol)])
    ).sort()

    const availableTimeframes = [...(catalog.find((item) => item.symbol === selectedSymbol)?.timeframes ?? [])].sort((left, right) => {
        const order = ['1m', '3m', '5m', '10m', '15m', '30m', '45m', '1h', '2h', '3h', '4h', '1d', '1w', '1M']
        return order.indexOf(left) - order.indexOf(right)
    })

    useEffect(() => {
        if (availableTimeframes.length > 0 && !availableTimeframes.includes(selectedTimeframe)) {
            setSelectedTimeframe(availableTimeframes[0])
        }
    }, [availableTimeframes, selectedTimeframe])

    if (status === 'loading') {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex items-center justify-center h-full">
                    <div className="text-white">Loading...</div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex items-center justify-center h-full">
                    <AuthEntryCta className="bg-blue-500 hover:bg-blue-600 text-white" />
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={true}>
            <div className="flex flex-col h-full bg-[#131722] overflow-hidden">
                <div className="flex-shrink-0">
                    <SymbolHeader
                        symbol={selectedSymbol}
                        timeframe={selectedTimeframe}
                        price={data.length > 0 ? data[data.length - 1].close : 0}
                        change={data.length > 1 ? data[data.length - 1].close - data[data.length - 2].close : 0}
                        changePercent={data.length > 1 ? ((data[data.length - 1].close - data[data.length - 2].close) / data[data.length - 2].close) * 100 : 0}
                        availableSymbols={availableSymbols}
                        availableTimeframes={availableTimeframes.length > 0 ? availableTimeframes : undefined}
                        onSymbolChange={setSelectedSymbol}
                        onTimeframeChange={setSelectedTimeframe}
                    />
                    <ChartToolbar />
                </div>
                <div className="flex flex-1 overflow-hidden relative">
                    <div className="flex-1 flex flex-col bg-[#131722] min-h-0">
                        {data.length > 0 ? (
                            <div className="flex-1 min-h-0">
                                <Chart
                                    data={data}
                                    chartType={chartType}
                                    indicators={activeIndicators}
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400">
                                {dataMessage || 'No data available'}
                            </div>
                        )}
                    </div>
                    {/* Only show RightPanel on Desktop */}
                    <div className="hidden lg:block w-80 flex-shrink-0 border-l border-[#2A2E39]">
                        <RightPanel />
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
