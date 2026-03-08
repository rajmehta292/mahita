'use client'

import { Star, ChevronDown } from 'lucide-react'

interface SymbolHeaderProps {
    symbol: string
    timeframe: string
    price: number
    change: number
    changePercent: number
    availableSymbols?: string[]
    availableTimeframes?: string[]
    onSymbolChange?: (symbol: string) => void
    onTimeframeChange?: (timeframe: string) => void
}

export function SymbolHeader({ 
    symbol, 
    timeframe,
    price, 
    change, 
    changePercent,
    availableSymbols = [],
    availableTimeframes = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M'],
    onSymbolChange,
    onTimeframeChange
}: SymbolHeaderProps) {
    const isPositive = change >= 0

    return (
        <div className="h-12 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-4 gap-4">
            {/* Symbol Selector */}
            <label className="flex items-center gap-2 hover:bg-[#2A2E39] px-3 py-1.5 rounded transition-colors">
                <select
                    value={symbol}
                    onChange={(event) => onSymbolChange?.(event.target.value)}
                    className="bg-transparent text-white font-semibold text-lg outline-none cursor-pointer"
                >
                    {availableSymbols.length === 0 ? (
                        <option value={symbol}>{symbol}</option>
                    ) : (
                        availableSymbols.map((item) => (
                            <option key={item} value={item} className="bg-[#1E222D] text-white">
                                {item}
                            </option>
                        ))
                    )}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400" />
            </label>

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
                {availableTimeframes.map((tf) => (
                    <button
                        key={tf}
                        onClick={() => onTimeframeChange?.(tf)}
                        aria-pressed={timeframe === tf}
                        className={`px-3 py-1.5 text-sm rounded transition-colors ${
                            timeframe === tf
                                ? 'bg-blue-500 text-white'
                                : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                        }`}
                    >
                        {tf}
                    </button>
                ))}
            </div>
        </div>
    )
}
