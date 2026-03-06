'use client'

import { useState } from 'react'
import { 
    LayoutGrid, 
    TrendingUp, 
    Activity, 
    BarChart3, 
    Settings, 
    Clock,
    Star,
    List,
    ChevronLeft,
    ChevronRight,
    Zap
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const menuItems = [
    { icon: LayoutGrid, label: 'Dashboard', href: '/dashboard' },
    { icon: TrendingUp, label: 'Chart', href: '/chart' },
    { icon: Activity, label: 'Screener', href: '/screener' },
    { icon: BarChart3, label: 'Backtest', href: '/backtest' },
    { icon: Zap, label: 'Active Trader', href: '/active-trader' },
    { icon: Clock, label: 'History', href: '/history' },
    { icon: Star, label: 'Watchlist', href: '/watchlist' },
    { icon: List, label: 'Orders', href: '/orders' },
]

export function Sidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const pathname = usePathname()

    return (
        <div 
            className={`bg-[#1E222D] border-r border-[#2A2E39] flex flex-col transition-all duration-300 ${
                collapsed ? 'w-14' : 'w-56'
            }`}
        >
            {/* Collapse Toggle */}
            <button
                onClick={() => setCollapsed(!collapsed)}
                className="h-10 flex items-center justify-center border-b border-[#2A2E39] hover:bg-[#2A2E39] transition-colors"
            >
                {collapsed ? (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                ) : (
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                )}
            </button>

            {/* Menu Items */}
            <nav className="flex-1 py-4">
                {menuItems.map((item) => {
                    const Icon = item.icon
                    const isActive = pathname === item.href
                    
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                                isActive 
                                    ? 'bg-[#2A2E39] text-blue-500 border-l-2 border-blue-500' 
                                    : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                            }`}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && (
                                <span className="text-sm font-medium">{item.label}</span>
                            )}
                        </Link>
                    )
                })}
            </nav>

            {/* Settings at Bottom */}
            <div className="border-t border-[#2A2E39]">
                <Link
                    href="/settings"
                    className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-[#2A2E39] hover:text-white transition-colors"
                >
                    <Settings className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium">Settings</span>}
                </Link>
            </div>
        </div>
    )
}
