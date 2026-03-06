'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown, X } from 'lucide-react'

type PanelTab = 'trades' | 'orders' | 'positions' | 'logs'

export function BottomPanel() {
    const [isExpanded, setIsExpanded] = useState(false)
    const [activeTab, setActiveTab] = useState<PanelTab>('trades')
    const [isVisible, setIsVisible] = useState(true)

    if (!isVisible) return null

    const tabs: { id: PanelTab; label: string }[] = [
        { id: 'trades', label: 'Trades' },
        { id: 'orders', label: 'Orders' },
        { id: 'positions', label: 'Positions' },
        { id: 'logs', label: 'Logs' },
    ]

    return (
        <div 
            className={`bg-[#1E222D] border-t border-[#2A2E39] transition-all duration-300 ${
                isExpanded ? 'h-64' : 'h-10'
            }`}
        >
            {/* Header */}
            <div className="h-10 flex items-center justify-between px-4 border-b border-[#2A2E39]">
                <div className="flex items-center gap-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`text-sm font-medium transition-colors ${
                                activeTab === tab.id
                                    ? 'text-blue-500'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="p-1 hover:bg-[#2A2E39] rounded transition-colors"
                    >
                        {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400" />
                        ) : (
                            <ChevronUp className="w-4 h-4 text-gray-400" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsVisible(false)}
                        className="p-1 hover:bg-[#2A2E39] rounded transition-colors"
                    >
                        <X className="w-4 h-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Content */}
            {isExpanded && (
                <div className="h-[calc(100%-2.5rem)] overflow-auto p-4">
                    <div className="text-gray-400 text-sm">
                        {activeTab === 'trades' && 'Trade history will appear here'}
                        {activeTab === 'orders' && 'Active orders will appear here'}
                        {activeTab === 'positions' && 'Open positions will appear here'}
                        {activeTab === 'logs' && 'System logs will appear here'}
                    </div>
                </div>
            )}
        </div>
    )
}
