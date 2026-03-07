'use client'

import { useState } from 'react'
import { Search, Bell, Settings, User, TrendingUp, Menu, X } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'

interface TopBarProps {
    onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
    const { data: session } = useSession()
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)

    return (
        <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-4 gap-4 sticky top-0 z-50">
            {/* Mobile Menu Toggle */}
            <button
                className="lg:hidden p-2 hover:bg-[#2A2E39] rounded text-gray-400"
                onClick={onMenuClick}
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Logo */}
            <div className="flex items-center gap-2 text-white font-bold text-lg flex-shrink-0">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                <span className="hidden sm:inline">Mahita Terminal</span>
                <span className="sm:hidden">Mahita</span>
            </div>

            {/* Symbol Search */}
            <div className={`flex-1 max-w-md ${isSearchOpen ? 'fixed inset-x-0 top-0 h-12 bg-[#1E222D] px-4 flex items-center z-50 lg:relative lg:inset-auto lg:h-auto lg:bg-transparent lg:px-0' : 'hidden lg:block'}`}>
                <div className="relative w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search symbols..."
                        autoFocus={isSearchOpen}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#131722] text-white pl-10 pr-10 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    {isSearchOpen && (
                        <button
                            className="absolute right-3 top-1/2 -translate-y-1/2 lg:hidden"
                            onClick={() => setIsSearchOpen(false)}
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    )}
                </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1 sm:gap-3 ml-auto">
                <button
                    className="p-2 lg:hidden hover:bg-[#2A2E39] rounded transition-colors"
                    onClick={() => setIsSearchOpen(true)}
                >
                    <Search className="w-4 h-4 text-gray-400" />
                </button>
                <button className="hidden sm:p-2 hover:bg-[#2A2E39] rounded transition-colors">
                    <Bell className="w-4 h-4 text-gray-400" />
                </button>
                <button className="hidden sm:p-2 hover:bg-[#2A2E39] rounded transition-colors">
                    <Settings className="w-4 h-4 text-gray-400" />
                </button>
                {session && (
                    <div className="flex items-center gap-2 pl-3 border-l border-[#2A2E39]">
                        <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-white" />
                        </div>
                        <button
                            onClick={() => signOut()}
                            className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap hidden xs:block"
                        >
                            Sign Out
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
