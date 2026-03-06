'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, TrendingUp, Activity, Clock } from 'lucide-react'

type PanelTab = 'watchlist' | 'indicators' | 'alerts'

export function RightPanel() {
    const [collapsed, setCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState<PanelTab>('watchlist')

    const tabs: { id: PanelTab; label: string; icon: any }[] = [
        { id: 'watchlist', label: 'Watchlist', icon: TrendingUp },
        { id: 'indicators', label: 'Indicators', icon: Activity },
        { id: 'alerts', label: 'Alerts', icon: Clock },
    ]

    if (collapsed) {
        return (
            <div className="w-10 bg-[#1E222D] border-l border-[#2A2E39] flex flex-col">
                <button
                    onClick={() => setCollapsed(false)}
                    className="h-10 flex items-center justify-center hover:bg-[#2A2E39] transition-colors"
                >
                    <ChevronLeft className="w-4 h-4 text-gray-400" />
                </button>
            </div>
        )
    }

    return (
        <div className="w-64 bg-[#1E222D] border-l border-[#2A2E39] flex flex-col">
            {/* Header */}
            <div className="h-10 flex items-center justify-between px-3 border-b border-[#2A2E39]">
                <div className="flex items-center gap-2">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`p-1.5 rounded transition-colors ${
                                    activeTab === tab.id
                                        ? 'bg-blue-500 text-white'
                                        : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                                }`}
                                title={tab.label}
                            >
                                <Icon className="w-4 h-4" />
                            </button>
                        )
                    })}
                </div>
                <button
                    onClick={() => setCollapsed(true)}
                    className="p-1 hover:bg-[#2A2E39] rounded transition-colors"
                >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-3">
                {activeTab === 'watchlist' && (
                    <div className="space-y-2">
                        <div className="text-xs text-gray-400 font-medium mb-2">MY WATCHLIST</div>
                        {['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA'].map((symbol) => (
                            <div
                                key={symbol}
                                className="p-2 bg-[#131722] rounded hover:bg-[#2A2E39] cursor-pointer transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-white text-sm font-medium">{symbol}</span>
                                    <span className="text-green-500 text-xs">+2.5%</span>
                                </div>
                                <div className="text-gray-400 text-xs mt-1">$150.25</div>
                            </div>
                        ))}
                    </div>
                )}
                {activeTab === 'indicators' && (
                    <div className="text-gray-400 text-sm">
                        Active indicators will appear here
                    </div>
                )}
                {activeTab === 'alerts' && (
                    <div className="text-gray-400 text-sm">
                        Price alerts will appear here
                    </div>
                )}
            </div>
        </div>
    )
}
