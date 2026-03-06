'use client'

import { useState } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { Plus, X } from 'lucide-react'

export default function OrdersPage() {
    const { data: session, status } = useSession()

    const mockOrders = [
        { id: 1, symbol: 'AAPL', type: 'Limit Buy', quantity: 100, price: 175.00, status: 'Pending', time: '10:30 AM' },
        { id: 2, symbol: 'MSFT', type: 'Market Buy', quantity: 50, price: 410.50, status: 'Filled', time: '09:15 AM' },
        { id: 3, symbol: 'GOOGL', type: 'Stop Loss', quantity: 75, price: 140.00, status: 'Active', time: '08:45 AM' },
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
                    <h1 className="text-white font-semibold text-lg">Orders</h1>
                    <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors flex items-center gap-2">
                        <Plus className="w-4 h-4" />
                        New Order
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <div className="bg-[#1E222D] rounded-lg border border-[#2A2E39]">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-[#2A2E39]">
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Time</th>
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Symbol</th>
                                    <th className="text-left text-gray-400 text-xs font-medium px-6 py-3">Type</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Quantity</th>
                                    <th className="text-right text-gray-400 text-xs font-medium px-6 py-3">Price</th>
                                    <th className="text-center text-gray-400 text-xs font-medium px-6 py-3">Status</th>
                                    <th className="text-center text-gray-400 text-xs font-medium px-6 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-[#2A2E39] hover:bg-[#2A2E39] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-gray-400 text-sm">{order.time}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-white font-medium">{order.symbol}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-gray-400 text-sm">{order.type}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white">{order.quantity}</span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="text-white">${order.price.toFixed(2)}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                                order.status === 'Filled' ? 'bg-green-500/20 text-green-500' :
                                                order.status === 'Pending' ? 'bg-yellow-500/20 text-yellow-500' :
                                                'bg-blue-500/20 text-blue-500'
                                            }`}>
                                                {order.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <button className="p-1 hover:bg-red-500/20 rounded transition-colors">
                                                <X className="w-4 h-4 text-red-500" />
                                            </button>
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
