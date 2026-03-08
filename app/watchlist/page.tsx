'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Star, Plus, Trash2, TrendingUp, TrendingDown } from 'lucide-react'

export default function WatchlistPage() {
    const { data: session, status } = useSession()
    const [symbols, setSymbols] = useState<string[]>(['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'BTC-USD', 'NVDA'])
    const [quotes, setQuotes] = useState<any[]>([])
    const [newSymbol, setNewSymbol] = useState('')
    const [isAdding, setIsAdding] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    // Load saved symbols
    useEffect(() => {
        const saved = localStorage.getItem('mahita_watchlist')
        if (saved) {
            try {
                setSymbols(JSON.parse(saved))
            } catch (e) { }
        }
    }, [])

    // Poll live quotes
    useEffect(() => {
        if (symbols.length === 0) {
            setQuotes([])
            setIsLoading(false)
            return
        }

        const fetchQuotes = async () => {
            try {
                const res = await fetch(`/api/trading/quotes?symbols=${symbols.join(',')}`)
                const data = await res.json()
                if (data.success) {
                    setQuotes(data.quotes)
                }
            } catch (error) {
                console.error("Failed to fetch watchlist quotes", error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchQuotes()
        const interval = setInterval(fetchQuotes, 5000)
        return () => clearInterval(interval)
    }, [symbols])

    const handleAdd = (e: React.FormEvent) => {
        e.preventDefault()
        if (newSymbol.trim() && !symbols.includes(newSymbol.trim().toUpperCase())) {
            const up = [...symbols, newSymbol.trim().toUpperCase()]
            setSymbols(up)
            localStorage.setItem('mahita_watchlist', JSON.stringify(up))
        }
        setNewSymbol('')
        setIsAdding(false)
    }

    const handleRemove = (sym: string) => {
        const up = symbols.filter(s => s !== sym)
        setSymbols(up)
        localStorage.setItem('mahita_watchlist', JSON.stringify(up))
    }

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
                    {isAdding ? (
                        <form onSubmit={handleAdd} className="flex items-center gap-2">
                            <input
                                autoFocus
                                type="text"
                                placeholder="Enter symbol (e.g. NVDA)"
                                value={newSymbol}
                                onChange={(e) => setNewSymbol(e.target.value)}
                                className="bg-[#131722] text-white px-3 py-1.5 rounded border border-[#2A2E39] text-sm focus:outline-none focus:border-blue-500"
                            />
                            <button type="submit" className="px-3 py-1.5 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 transition-colors">Add</button>
                            <button type="button" onClick={() => setIsAdding(false)} className="px-3 py-1.5 bg-gray-600 text-white rounded text-sm hover:bg-gray-700 transition-colors">Cancel</button>
                        </form>
                    ) : (
                        <button onClick={() => setIsAdding(true)} className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Add Symbol
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-auto p-6">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="text-gray-400">Loading quotes...</div>
                        </div>
                    ) : quotes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-[#2A2E39] rounded-lg">
                            <div className="text-gray-400 mb-2">Watchlist is empty</div>
                            <button onClick={() => setIsAdding(true)} className="text-blue-500 hover:underline text-sm font-semibold">+ Add your first ticker</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {quotes.map((item) => (
                                <div key={item.symbol} className="bg-[#1E222D] rounded-lg border border-[#2A2E39] p-4 hover:border-blue-500 transition-colors group">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="overflow-hidden">
                                            <h3 className="text-white font-semibold text-lg">{item.symbol}</h3>
                                            <p className="text-gray-400 text-xs truncate whitespace-nowrap">{item.name}</p>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => handleRemove(item.symbol)} className="p-1 hover:bg-[#2A2E39] rounded transition-colors" title="Remove">
                                                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <div className="text-white text-2xl font-bold">${(item.price || 0).toFixed(2)}</div>
                                            <div className={`flex items-center gap-1 text-sm ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                {item.change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                                                <span>{item.change >= 0 ? '+' : ''}{(item.change || 0).toFixed(2)} ({(item.changePercent || 0).toFixed(2)}%)</span>
                                            </div>
                                        </div>
                                        <a href={`/data-doctor?symbol=${item.symbol}`} className="px-3 py-1.5 bg-[#2A2E39] hover:bg-blue-500 text-white text-xs rounded transition-colors whitespace-nowrap">
                                            Commands
                                        </a>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    )
}
