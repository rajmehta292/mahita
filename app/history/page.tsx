'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Calendar, Filter, Download, ChevronRight } from 'lucide-react'

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
                <div className="flex-1 flex items-center justify-center bg-[#131722]">
                    <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex-1 flex items-center justify-center bg-[#131722] p-6 text-center">
                    <div className="max-w-md">
                        <h2 className="text-2xl font-bold text-white mb-4">Trade History</h2>
                        <p className="text-gray-400 mb-6">Please sign in to view your trading history and performance metrics.</p>
                        <button
                            onClick={() => signIn('google')}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors font-medium"
                        >
                            Sign in with Google
                        </button>
                    </div>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <div className="flex flex-col h-full bg-[#131722]">
                {/* Header */}
                <div className="bg-[#1E222D] border-b border-[#2A2E39] flex flex-col sm:flex-row sm:items-center justify-between px-4 py-3 sm:h-14 sm:px-6 shrink-0 gap-3">
                    <h1 className="text-white font-semibold text-lg">Trade History</h1>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button className="flex-1 sm:flex-none px-3 py-1.5 bg-[#2A2E39] hover:bg-[#363A45] text-white rounded text-xs transition-colors flex items-center justify-center gap-2">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="xs:inline">Dates</span>
                        </button>
                        <button className="flex-1 sm:flex-none px-3 py-1.5 bg-[#2A2E39] hover:bg-[#363A45] text-white rounded text-xs transition-colors flex items-center justify-center gap-2">
                            <Filter className="w-3.5 h-3.5" />
                            <span className="xs:inline">Filter</span>
                        </button>
                        <button className="flex-1 sm:flex-none px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors flex items-center justify-center gap-2">
                            <Download className="w-3.5 h-3.5" />
                            <span className="xs:inline">Export</span>
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto p-4 sm:p-6">
                    {/* Desktop Table */}
                    <div className="hidden md:block bg-[#1E222D] rounded-xl border border-[#2A2E39] overflow-hidden">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="border-b border-[#2A2E39] bg-white/5">
                                    <th className="text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Date</th>
                                    <th className="text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Symbol</th>
                                    <th className="text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Type</th>
                                    <th className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Entry</th>
                                    <th className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Exit</th>
                                    <th className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">P&L</th>
                                    <th className="text-right text-gray-400 text-[10px] font-bold uppercase tracking-widest px-6 py-4">Duration</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#2A2E39]">
                                {mockTrades.map((trade) => (
                                    <tr key={trade.id} className="hover:bg-white/[0.02] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-gray-400 text-sm font-mono">{trade.date}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white font-bold">{trade.symbol}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.type === 'Long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                                {trade.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white font-mono">${trade.entry.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white font-mono">${trade.exit.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className={`font-bold font-mono ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-gray-400 text-xs">{trade.duration}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile List View */}
                    <div className="md:hidden space-y-3">
                        {mockTrades.map((trade) => (
                            <div key={trade.id} className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-4 active:bg-[#2A2E39] transition-colors">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-white font-bold text-lg">{trade.symbol}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${trade.type === 'Long' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                            {trade.type}
                                        </span>
                                    </div>
                                    <div className={`text-lg font-bold ${trade.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-white/20 uppercase font-bold text-[9px] tracking-widest">Entry / Exit</span>
                                        <span className="text-white/80 font-mono">${trade.entry.toFixed(2)} → ${trade.exit.toFixed(2)}</span>
                                    </div>
                                    <div className="flex flex-col gap-1 text-right">
                                        <span className="text-white/20 uppercase font-bold text-[9px] tracking-widest">Date / Duration</span>
                                        <span className="text-white/80 font-mono">{trade.date} <span className="text-white/20">•</span> {trade.duration}</span>
                                    </div>
                                </div>
                                <div className="mt-3 pt-3 border-t border-[#2A2E39] flex justify-end">
                                    <button className="text-[10px] font-bold text-blue-500 uppercase tracking-widest flex items-center gap-1">
                                        View Details <ChevronRight className="w-3 h-3" />
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
