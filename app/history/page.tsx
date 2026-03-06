'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Calendar, Filter, Download } from 'lucide-react'

export default function HistoryPage() {
    const { data: session, status } = useSession()

    const mockTrades = [
        { id: 1, symbol: 'AAPL', type: 'Long', entry: 175.50, exit: 178.25, pnl: 275, date: '2026-03-05', duration: '2h 15m' },
        { id: 2, symbol: 'MSFT', type: 'Long', entry: 405.20, exit: 410.68, pnl: 548, date: '2026-03-04', duration: '1d 3h' },
        { id: 3, symbol: 'GOOGL', type: 'Short', entry: 145.00, exit: 142.50, pnl: 250, date: '2026-03-03', duration: '4h 30m' },
        { id: 4, symbol: 'TSLA', type: 'Long', entry: 245.00, exit: 242.84, pnl: -216, date: '2026-03-02', duration: '6h 45m' },
        { id: 5, symbol: 'AMZN', type: 'Long', entry: 175.50, exit: 178.90, pnl: 340, date: '2026-03-01', duration: '1d 2h' },
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
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-6">
                    <h1 className="text-white font-semibold text-lg">Trade History</h1>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-[#2A2E39] hover:bg-[#363A45] text-white rounded text-sm transition-colors flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Date Range
                        </button>
                        <button className="px-4 py-2 bg-[#2A2E39] hover:bg-[#363A45] text-white rounded text-sm transition-colors flex items-center gap-2">
                            <Filter className="w-4 h-4" />
                            Filter
                        </button>
                        <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors flex items-center gap-2">
                            <Download className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-[#1E222D] rounded-lg border border-[#2A2E39]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#2A2E39]">
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Date</th>
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Symbol</th>
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Type</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Entry</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Exit</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">P&L</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Duration</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockTrades.map((trade) => (
                                    <tr key={trade.id} className="border-b border-[#2A2E39] hover:bg-[#2A2E39] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-gray-400 text-sm">{trade.date}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white font-medium">{trade.symbol}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-xs ${trade.type === 'Long' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                                                {trade.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white">${trade.entry.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white">${trade.exit.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={trade.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>
                                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-gray-400 text-sm">{trade.duration}</span>
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
