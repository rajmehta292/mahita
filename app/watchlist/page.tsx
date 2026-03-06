'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Star, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

export default function WatchlistPage() {
    const { data: session, status } = useSession()
    const [watchlist, setWatchlist] = useState([
        { symbol: 'AAPL', name: 'Apple Inc.', price: 178.25, change: 2.5, favorite: true },
        { symbol: 'MSFT', name: 'Microsoft Corp.', price: 410.68, change: 1.35, favorite: true },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', price: 142.50, change: -0.8, favorite: false },
        { symbol: 'AMZN', name: 'Amazon.com Inc.', price: 178.90, change: 3.2, favorite: true },
        { symbol: 'TSLA', name: 'Tesla Inc.', price: 242.84, change: -1.5, favorite: false },
    ])

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
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-6">
                    <h1 className="text-white font-semibold text-lg">My Watchlist</h1>
                    <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        Add Symbol
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {watchlist.map((item) => (
                            <div key={item.symbol} className="bg-[#1E222D] rounded-lg border border-[#2A2E39] p-4 hover:border-blue-500 transition-colors">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h3 className="text-white font-semibold text-lg">{item.symbol}</h3>
                                        <p className="text-gray-400 text-xs">{item.name}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button className="p-1 hover:bg-[#2A2E39] rounded transition-colors">
                                            <Star className={`w-4 h-4 ${item.favorite ? 'text-yellow-500 fill-yellow-500' : 'text-gray-400'}`} />
                                        </button>
                                        <button className="p-1 hover:bg-[#2A2E39] rounded transition-colors">
                                            <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                        </button>
                                    </div>
                                </div>
                                <div className="flex items-end justify-between">
                                    <div>
                                        <div className="text-white text-2xl font-bold">${item.price.toFixed(2)}</div>
                                        <div className={`flex items-center gap-1 text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                            {item.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                            <span>{item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%</span>
                                        </div>
                                    </div>
                                    <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs rounded transition-colors">
                                        View Chart
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
