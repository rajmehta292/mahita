'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession, signIn } from 'next-auth/react'
import dynamic from 'next/dynamic'
import { MarketDataPoint } from '../services/market-data/types'
import { MainLayout } from '../components/Layout/MainLayout'
import { SymbolHeader } from '../components/Chart/SymbolHeader'
import { ChartToolbar } from '../components/Chart/ChartToolbar'
import { RightPanel } from '../components/Chart/RightPanel'

const Chart = dynamic(() => import('../components/Chart'), { ssr: false })

export default function ChartPage() {
    const { data: session, status } = useSession()
    const [data, setData] = useState<MarketDataPoint[]>([])
    const [inventory, setInventory] = useState<any[]>([])
    const [selectedSymbol, setSelectedSymbol] = useState("AAPL")
    const [selectedTimeframe, setSelectedTimeframe] = useState("1d")
    const [chartType, setChartType] = useState<'Standard' | 'HeikinAshi'>('Standard')
    const [activeIndicators, setActiveIndicators] = useState<string[]>(['Volume'])

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
        } catch (error: any) {
            console.error(`[API Error] ${url}:`, error)
            return null
        }
    }, [])

    useEffect(() => {
        if (status !== 'authenticated') return
        const fetchInventory = async () => {
            const json = await safeFetchJson('/api/trading/inventory')
            if (json) setInventory(json)
        }
        fetchInventory()
    }, [status, safeFetchJson])

    useEffect(() => {
        if (status !== 'authenticated' || !selectedSymbol) return
        const fetchMarketData = async () => {
            const json = await safeFetchJson(`/api/trading/market-data?symbol=${selectedSymbol}&timeframe=${selectedTimeframe}`)
            if (json) setData(json)
        }
        fetchMarketData()
    }, [selectedSymbol, selectedTimeframe, status, safeFetchJson])

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
                    <button
                        onClick={() => signIn('google')}
                        className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
                    >
                        Sign in with Google
                    </button>
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
                        price={data.length > 0 ? data[data.length - 1].close : 0}
                        change={data.length > 1 ? data[data.length - 1].close - data[data.length - 2].close : 0}
                        changePercent={data.length > 1 ? ((data[data.length - 1].close - data[data.length - 2].close) / data[data.length - 2].close) * 100 : 0}
                        onSymbolChange={setSelectedSymbol}
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
                                No data available
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
