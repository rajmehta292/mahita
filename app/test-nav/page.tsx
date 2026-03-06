'use client'

import Link from 'next/link'

export default function TestNav() {
    const pages = [
        { name: 'Dashboard', path: '/dashboard' },
        { name: 'Chart', path: '/chart' },
        { name: 'Backtest', path: '/backtest' },
        { name: 'Screener', path: '/screener' },
        { name: 'Orders', path: '/orders' },
        { name: 'History', path: '/history' },
        { name: 'Watchlist', path: '/watchlist' },
    ]

    return (
        <div className="min-h-screen bg-[#131722] p-8">
            <h1 className="text-white text-3xl font-bold mb-8">Navigation Test</h1>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pages.map((page) => (
                    <Link
                        key={page.path}
                        href={page.path}
                        className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-6 hover:border-blue-500 transition-colors text-center"
                    >
                        <div className="text-white font-semibold text-lg">{page.name}</div>
                        <div className="text-gray-400 text-sm mt-2">{page.path}</div>
                    </Link>
                ))}
            </div>
        </div>
    )
}
