'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import {
    LayoutGrid,
    Activity,
    BarChart3,
    Settings,
    Star,
    ChevronLeft,
    ChevronRight,
    Zap,
    BookOpen,
    X,
    Briefcase,
    Code,
    BarChart2,
    FileText,
    FlaskConical,
    Database,
    MonitorSmartphone,
    TrendingUp,
    ScrollText
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { isAdminRole } from '@/lib/roles'

const menuItems = [
    { icon: LayoutGrid, label: 'Dashboard', href: '/dashboard' },
    { icon: Briefcase, label: 'Portfolio', href: '/portfolio' },
    { icon: Zap, label: 'Active Trader', href: '/active-trader' },
    { icon: BarChart2, label: 'Screener', href: '/screener' },
    { icon: FileText, label: 'Trade History', href: '/history' },
    { icon: Star, label: 'Watchlist', href: '/watchlist' },
    { icon: Code, label: 'Script Editor', href: '/script-editor' },
    { icon: BarChart3, label: 'Backtester', href: '/backtest' },
    { icon: TrendingUp, label: 'Trending Indicators', href: '/trending-indicators' },
    { icon: Database, label: 'Schwab Data', href: '/schwab-data' },
    { icon: BookOpen, label: 'Learn', href: '/learn' },
    { icon: Code, label: 'AI Chat', href: '/ai-chat' },
    { icon: MonitorSmartphone, label: 'Desktop Expansion', href: '/desktop-expansion' },
    { icon: Activity, label: 'Admin Control', href: '/admin', requiresAdmin: true },
    { icon: FlaskConical, label: 'Dev Tests', href: '/dev-tests', requiresAdmin: true },
]

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const [collapsed, setCollapsed] = useState(false)
    const pathname = usePathname()
    const { data: session } = useSession()
    const canViewAdminItems = isAdminRole(session?.user?.role)

    const visibleMenuItems = menuItems.filter((item) => !item.requiresAdmin || canViewAdminItems)

    return (
        <>
            <div
                className={`fixed inset-y-0 left-0 z-50 transform lg:relative lg:translate-x-0 transition-all duration-300 ease-in-out bg-[#1E222D] border-r border-[#2A2E39] flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    } ${collapsed ? 'lg:w-14' : 'lg:w-56'
                    } w-64`}
            >
                {/* Header (Mobile ONLY Close) */}
                <div className="h-12 flex lg:hidden items-center justify-between px-4 border-b border-[#2A2E39]">
                    <span className="text-white font-bold text-sm">Menu Navigation</span>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-[#2A2E39] rounded"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Menu Items */}
                <nav className="flex-1 py-4 overflow-y-auto">
                    {visibleMenuItems.map((item) => {
                        const Icon = item.icon
                        const isActive = pathname === item.href

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => {
                                    if (window.innerWidth < 1024) onClose()
                                }}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isActive
                                    ? 'bg-[#2A2E39] text-blue-500 border-l-2 border-blue-500'
                                    : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                                    }`}
                            >
                                <Icon className="w-5 h-5 flex-shrink-0" />
                                <span className={`text-sm font-medium transition-opacity duration-300 ${collapsed ? 'lg:opacity-0 lg:w-0 overflow-hidden' : 'opacity-100'}`}>
                                    {item.label}
                                </span>
                            </Link>
                        )
                    })}
                </nav>

                {/* Settings & Collapse at Bottom */}
                <div className="border-t border-[#2A2E39]">
                    <Link
                        href="/docs"
                        onClick={() => {
                            if (window.innerWidth < 1024) onClose()
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-[#2A2E39] hover:text-white transition-colors"
                    >
                        <ScrollText className="w-5 h-5 flex-shrink-0" />
                        <span className={`text-sm font-medium transition-opacity duration-300 ${collapsed ? 'lg:opacity-0 lg:w-0 overflow-hidden' : 'opacity-100'}`}>
                            Documentation
                        </span>
                    </Link>

                    <Link
                        href="/settings"
                        onClick={() => {
                            if (window.innerWidth < 1024) onClose()
                        }}
                        className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:bg-[#2A2E39] hover:text-white transition-colors"
                    >
                        <Settings className="w-5 h-5 flex-shrink-0" />
                        <span className={`text-sm font-medium transition-opacity duration-300 ${collapsed ? 'lg:opacity-0 lg:w-0 overflow-hidden' : 'opacity-100'}`}>
                            Settings
                        </span>
                    </Link>

                    {/* Desktop Collapse Toggle at Bottom */}
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="hidden lg:flex w-full items-center gap-3 px-4 py-3 text-gray-500 hover:text-white hover:bg-[#2A2E39] transition-colors border-t border-[#2A2E39]/50"
                    >
                        {collapsed ? (
                            <ChevronRight className="w-5 h-5 flex-shrink-0" />
                        ) : (
                            <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                        )}
                        <span className={`text-xs font-bold uppercase tracking-widest transition-opacity duration-300 ${collapsed ? 'opacity-0 w-0 overflow-hidden' : 'opacity-100'}`}>
                            Collapse Menu
                        </span>
                    </button>
                </div>
            </div>
        </>
    )
}
