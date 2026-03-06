'use client'

import { useState } from 'react'
import { Search, Bell, Settings, User, TrendingUp, BarChart3, LineChart } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

export function TopBar() {
    const { data: session } = useSession()
    const [searchQuery, setSearchQuery] = useState('')

    return (
        <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-4 gap-4">
            {/* Logo */}
            <div className="flex items-center gap-2 text-white font-bold text-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                <span>Mahita Terminal</span>
            </div>

            {/* Symbol Search */}
            <div className="flex-1 max-w-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#131722] text-white pl-10 pr-4 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-3">
                <button className="p-2 hover:bg-[#2A2E39] rounded transition-colors">
                    <Bell className="w-4 h-4 text-gray-400" />
                </button>
                <button className="p-2 hover:bg-[#2A2E39] rounded transition-colors">
                    <Settings className="w-4 h-4 text-gray-400" />
                </button>
                {session && (
                    <div className="flex items-center gap-2 pl-3 border-l border-[#2A2E39]">
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="text-xs text-gray-400 hover:text-white transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
