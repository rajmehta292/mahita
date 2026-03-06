'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Search, Filter, TrendingUp, TrendingDown, Activity } from 'lucide-react'

export default function ScreenerPage() {
    const { data: session, status } = useSession()
    const [searchQuery, setSearchQuery] = useState('')

    const mockStocks = [
        { symbol: 'AAPL', name: 'Apple Inc.', price: 178.25, change: 2.5, volume: '52.3M', marketCap: '2.8T', pe: 29.5 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 410.68, change: 1.35, volume: '23.1M', marketCap: '3.1T', pe: 35.2 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.50, change: -0.8, volume: '18.7M', marketCap: '1.8T', pe: 26.8 },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: 3.2, volume: '45.2M', marketCap: '1.9T', pe: 68.4 },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.84, change: -1.5, volume: '98.5M', marketCap: '771B', pe: 75.3 },
    ]

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
        <MainLayout showBottomPanel={false}>
            <div className="flex flex-col h-full bg-[#131722]">
                {/* Header */}
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-6 gap-4">
                    <h1 className="text-white font-semibold text-lg">Stock Screener</h1>
                    <div className="flex-1 max-w-md">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search stocks..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#131722] text-white pl-10 pr-4 py-2 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                    <button className="px-4 py-2 bg-[#2A2E39] hover:bg-[#363A45] text-white rounded text-sm transition-colors flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filters
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-[#1E222D] rounded-lg border border-[#2A2E39]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#2A2E39]">
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Symbol</th>
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Name</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Price</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Change %</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Volume</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Market Cap</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">P/E</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockStocks.map((stock) => (
                                    <tr key={stock.symbol} className="border-b border-[#2A2E39] hover:bg-[#2A2E39] transition-colors cursor-pointer">
                                        <td className="px-6 py-4">
                                            <span className="text-white font-medium">{stock.symbol}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-gray-400 text-sm">{stock.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white">${stock.price.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`flex items-center justify-end gap-1 ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {stock.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                <span>{stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}%</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-gray-400 text-sm">{stock.volume}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-gray-400 text-sm">{stock.marketCap}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-gray-400 text-sm">{stock.pe.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
