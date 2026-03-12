'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Bell, Settings, User, TrendingUp, Menu, X, LogOut, ChevronDown } from 'lucide-react'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { resolveClientCallbackUrl } from '@/lib/auth-redirect'

interface TopBarProps {
    onMenuClick: () => void
}

export function TopBar({ onMenuClick }: TopBarProps) {
    const { data: session } = useSession()
    const router = useRouter()
    const [searchQuery, setSearchQuery] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
    const accountMenuRef = useRef<HTMLDivElement | null>(null)
    const landingUrl = resolveClientCallbackUrl('/')

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
                setIsAccountMenuOpen(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [])

    const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && searchQuery.trim()) {
            router.push(`/chart?symbol=${searchQuery.trim().toUpperCase()}&timeframe=1d`)
            setIsSearchOpen(false)
            setSearchQuery('')
        }
    }

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
                        onKeyDown={handleSearch}
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
                    <div className="relative pl-3 border-l border-[#2A2E39]" ref={accountMenuRef}>
                        <button
                            onClick={() => setIsAccountMenuOpen((current) => !current)}
                            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-gray-300 transition-colors hover:bg-[#2A2E39] hover:text-white"
                        >
                            <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <User className="w-4 h-4 text-white" />
                            </div>
                            <span className="hidden md:inline text-xs font-medium max-w-[180px] truncate">
                                {session.user.email || 'Account'}
                            </span>
                            <ChevronDown className={`w-4 h-4 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {isAccountMenuOpen && (
                            <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-[#2A2E39] bg-[#1E222D] p-2 shadow-2xl shadow-black/40">
                                <div className="px-3 py-2 border-b border-[#2A2E39]">
                                    <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">Signed in</p>
                                    <p className="mt-1 text-sm text-white truncate">{session.user.email || 'Mahita User'}</p>
                                </div>

                                <button
                                    onClick={() => {
                                        setIsAccountMenuOpen(false)
                                        void signOut({ callbackUrl: landingUrl })
                                    }}
                                    className="mt-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-[#2A2E39] hover:text-white"
                                >
                                    <LogOut className="w-4 h-4" />
                                    <span>Log out</span>
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
