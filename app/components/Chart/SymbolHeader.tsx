'use client'

import { Star, ChevronDown } from 'lucide-react'

interface SymbolHeaderProps {
    symbol: string
    price: number
    change: number
    changePercent: number
    onSymbolChange?: (symbol: string) => void
}

export function SymbolHeader({ 
    symbol, 
    price, 
    change, 
    changePercent,
    onSymbolChange 
}: SymbolHeaderProps) {
    const isPositive = change >= 0

    return (
        <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-4 gap-4">
            {/* Symbol Selector */}
            <button className="flex items-center gap-2 hover:bg-[#2A2E39] px-3 py-1.5 rounded transition-colors">
                <span className="text-white font-semibold text-lg">{symbol}</span>
                <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>

            {/* Favorite */}
            <button className="p-1.5 hover:bg-[#2A2E39] rounded transition-colors">
                <Star className="w-4 h-4 text-gray-400 hover:text-yellow-500" />
            </button>

            {/* Price Info */}
            <div className="flex items-center gap-4 pl-4 border-l border-[#2A2E39]">
                <div>
                    <div className="text-white font-semibold text-lg">
                        ${price.toFixed(2)}
                    </div>
                    <div className={`text-xs ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(2)} ({isPositive ? '+' : ''}{changePercent.toFixed(2)}%)
                    </div>
                </div>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center gap-1 ml-auto">
                {['1m', '5m', '15m', '1h', '4h', '1D', '1W', '1M'].map((tf) => (
                    <button
                        key={tf}
                        className="px-3 py-1.5 text-sm text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors"
                    >
                        {tf}
                    </button>
                ))}
            </div>
        </div>
    )
}
