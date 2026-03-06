'use client'

import { useState } from 'react'
import { 
    TrendingUp, 
    Minus, 
    Circle, 
    Square, 
    Type, 
    Ruler, 
    Crosshair,
    ZoomIn,
    ZoomOut,
    Maximize2,
    Camera,
    Settings
} from 'lucide-react'

interface ChartToolbarProps {
    onToolSelect?: (tool: string) => void
}

export function ChartToolbar({ onToolSelect }: ChartToolbarProps) {
    const [activeTool, setActiveTool] = useState<string | null>(null)

    const tools = [
        { id: 'crosshair', icon: Crosshair, label: 'Crosshair' },
        { id: 'trendline', icon: TrendingUp, label: 'Trend Line' },
        { id: 'horizontal', icon: Minus, label: 'Horizontal Line' },
        { id: 'circle', icon: Circle, label: 'Circle' },
        { id: 'rectangle', icon: Square, label: 'Rectangle' },
        { id: 'text', icon: Type, label: 'Text' },
        { id: 'measure', icon: Ruler, label: 'Measure' },
    ]

    const handleToolClick = (toolId: string) => {
        setActiveTool(toolId === activeTool ? null : toolId)
        onToolSelect?.(toolId)
    }

    return (
        <div className="h-10 bg-[#1E222D] border-b border-[#2A2E39] flex items-center px-2 gap-1">
            {/* Drawing Tools */}
            <div className="flex items-center gap-1 pr-2 border-r border-[#2A2E39]">
                {tools.map((tool) => {
                    const Icon = tool.icon
                    return (
                        <button
                            key={tool.id}
                            onClick={() => handleToolClick(tool.id)}
                            className={`p-2 rounded transition-colors ${
                                activeTool === tool.id
                                    ? 'bg-blue-500 text-white'
                                    : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                            }`}
                            title={tool.label}
                        >
                            <Icon className="w-4 h-4" />
                        </button>
                    )
                })}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 px-2 border-r border-[#2A2E39]">
                <button className="p-2 text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors" title="Zoom In">
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors" title="Zoom Out">
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors" title="Fullscreen">
                    <Maximize2 className="w-4 h-4" />
                </button>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 px-2">
                <button className="p-2 text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors" title="Screenshot">
                    <Camera className="w-4 h-4" />
                </button>
                <button className="p-2 text-gray-400 hover:bg-[#2A2E39] hover:text-white rounded transition-colors" title="Settings">
                    <Settings className="w-4 h-4" />
                </button>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Indicator Button */}
            <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium rounded transition-colors">
                Indicators
            </button>
        </div>
    )
}
