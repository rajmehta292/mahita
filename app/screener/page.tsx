'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Search, Filter, TrendingUp, TrendingDown } from 'lucide-react'
import { AuthEntryCta } from '../components/Auth/AuthEntryCta'

interface ScreenerRow {
    symbol: string
    name: string
    price: number
    change: number
    changePercent: number
    volume: number
    source: string
    lastBarTime: number
    healthScore: number
    targetCoveragePercent: number
}

export default function ScreenerPage() {
    const { data: session, status } = useSession()
    const [searchQuery, setSearchQuery] = useState('')
    const [rows, setRows] = useState<ScreenerRow[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status !== 'authenticated') {
            return
        }

        const fetchRows = async () => {
            setLoading(true)

            try {
                const response = await fetch('/api/trading/screener')
                const json = await response.json()
                if (Array.isArray(json.rows)) {
                    setRows(json.rows)
                } else {
                    setRows([])
                }
            } catch (error) {
                console.error('Failed to fetch screener rows:', error)
                setRows([])
            } finally {
                setLoading(false)
            }
        }

        fetchRows()
    }, [status])

    const filteredRows = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return rows

        return rows.filter((row) =>
            row.symbol.toLowerCase().includes(query) ||
            row.name.toLowerCase().includes(query)
        )
    }, [rows, searchQuery])

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
        <MainLayout showBottomPanel={false}>
            <div className="flex flex-col h-full bg-[#131722]">
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-6 gap-4">
                    <h1 className="text-white font-semibold text-lg">Stock Screener</h1>
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search stored symbols..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#131722] text-white pl-10 pr-4 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="px-4 py-2 bg-[#2A2E39] text-white rounded text-sm flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        {filteredRows.length} symbols
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-[#1E222D] rounded-lg border border-[#2A2E39] overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#2A2E39]">
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Symbol</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Price</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Change %</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Volume</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Health</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Coverage</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Updated</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Source</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                            Loading screener data...
                                        </td>
                                    </tr>
                                ) : filteredRows.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                                            No stored symbols matched your search.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => (
                                        <tr key={row.symbol} className="border-b border-[#2A2E39] hover:bg-[#2A2E39] transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <a href={`/chart?symbol=${row.symbol}&timeframe=1d`} className="text-white font-medium hover:text-blue-400">
                                                        {row.symbol}
                                                    </a>
                                                    <a href={`/chart?symbol=${row.symbol}&timeframe=1d`} className="text-xs text-gray-400 hover:text-blue-400">
                                                        Open Chart
                                                    </a>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-white">${row.price.toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className={`flex items-center justify-end gap-1 ${row.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                    {row.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                    <span>{row.change >= 0 ? '+' : ''}{row.changePercent.toFixed(2)}%</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-300 text-sm">{row.volume.toLocaleString()}</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-300 text-sm">{row.healthScore.toFixed(0)}%</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-300 text-sm">{row.targetCoveragePercent.toFixed(0)}%</span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-400 text-sm">
                                                    {row.lastBarTime ? new Date(row.lastBarTime * 1000).toLocaleDateString() : 'N/A'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-400 text-sm uppercase">{row.source}</span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
