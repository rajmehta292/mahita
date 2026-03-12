'use client'

import { Fragment, useMemo, useState } from 'react'
import {
    ChevronDown,
    ChevronUp,
    MoreHorizontal,
    ArrowUpDown,
    Settings,
    Check,
    Download,
} from 'lucide-react'

export interface PositionLot {
    id?: string
    openedAt?: string
    quantity: number
    averagePrice: number
}

export interface Position {
    symbol: string
    quantity: number
    averagePrice: number
    currentPrice: number
    marketValue: number
    unrealizedPL: number
    unrealizedPLPercent: number
    description?: string // Full name
    lots?: PositionLot[]
}

interface PositionTableProps {
    positions: Position[]
    onExport: () => void
    onAction: (symbol: string, side: 'BUY' | 'SELL', amount?: number | 'ALL') => void
    initialColumns?: ColumnConfig[]
    onConfigChange?: (config: ColumnConfig[]) => void
}

type ColumnId = 'ticker' | 'qty_entry' | 'market_profile' | 'performance' | 'actions'

export interface ColumnConfig {
    id: ColumnId
    label: string
    visible: boolean
    order: number
}

const DEFAULT_COLUMNS: ColumnConfig[] = [
    { id: 'ticker', label: 'Ticker', visible: true, order: 0 },
    { id: 'qty_entry', label: 'Qty / Avg Price', visible: true, order: 1 },
    { id: 'market_profile', label: 'Last Price / MV', visible: true, order: 2 },
    { id: 'performance', label: '% Change / Net', visible: true, order: 3 },
    { id: 'actions', label: 'Actions', visible: true, order: 4 },
]

export function PositionTable({
    positions,
    onExport,
    onAction,
    initialColumns,
    onConfigChange
}: PositionTableProps) {
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
    const [sortConfig, setSortConfig] = useState<{ key: keyof Position, direction: 'asc' | 'desc' } | null>(null)
    const [columnConfig, setColumnConfig] = useState<ColumnConfig[]>(() => {
        if (initialColumns && initialColumns.length > 0) {
            return initialColumns
        }

        if (typeof window === 'undefined') {
            return DEFAULT_COLUMNS
        }

        const saved = window.localStorage.getItem('mahita_portfolio_columns')
        if (!saved) {
            return DEFAULT_COLUMNS
        }

        try {
            return JSON.parse(saved) as ColumnConfig[]
        } catch {
            return DEFAULT_COLUMNS
        }
    })
    const [showSettings, setShowSettings] = useState(false)

    const saveConfig = (newConfig: ColumnConfig[]) => {
        setColumnConfig(newConfig)
        localStorage.setItem('mahita_portfolio_columns', JSON.stringify(newConfig))
        onConfigChange?.(newConfig)
    }

    const toggleRow = (symbol: string) => {
        const next = new Set(expandedRows)
        if (next.has(symbol)) next.delete(symbol)
        else next.add(symbol)
        setExpandedRows(next)
    }

    const sortedPositions = useMemo(() => {
        if (!sortConfig) return positions
        return [...positions].sort((a, b) => {
            const aVal = a[sortConfig.key] ?? 0
            const bVal = b[sortConfig.key] ?? 0
            if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
            if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
            return 0
        })
    }, [positions, sortConfig])

    const requestSort = (key: keyof Position) => {
        let direction: 'asc' | 'desc' = 'asc'
        if (sortConfig?.key === key && sortConfig.direction === 'asc') {
            direction = 'desc'
        }
        setSortConfig({ key, direction })
    }

    const visibleColumns = [...columnConfig].sort((a, b) => a.order - b.order).filter(c => c.visible)

    return (
        <div className="flex h-full min-h-0 flex-col bg-[#1E222D] border border-[#2A2E39] rounded-3xl overflow-hidden shadow-2xl">
            {/* Toolbar */}
            <div className="px-8 py-5 border-b border-[#2A2E39] flex items-center justify-between bg-white/[0.02]">
                <div className="flex items-center gap-4">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-white">
                        Asset Distribution
                        <span className="text-[10px] bg-blue-500/10 text-blue-500 px-2.5 py-1 rounded-lg border border-blue-500/20">{positions.length} Active</span>
                    </h3>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors border border-transparent hover:border-[#2A2E39]"
                        title="Configure Columns"
                    >
                        <Settings className="w-4 h-4" />
                    </button>
                    <button
                        onClick={onExport}
                        className="text-[10px] font-bold text-gray-500 hover:text-white uppercase tracking-wider flex items-center gap-1.5 transition-colors bg-[#131722] px-3 py-1.5 rounded-lg border border-[#2A2E39]"
                    >
                        Export CSV <Download className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {/* Column Visibility Settings Overlay */}
            {showSettings && (
                <div className="mx-8 mt-4 p-4 bg-[#131722] border border-[#2A2E39] rounded-2xl animate-in fade-in zoom-in duration-200 z-20 relative">
                    <div className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] mb-4">View Customization</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {columnConfig.map((col, idx) => (
                            <div
                                key={col.id}
                                className="flex items-center justify-between p-2 bg-[#1E222D] rounded-xl border border-[#2A2E39] group"
                            >
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => {
                                            const next = [...columnConfig]
                                            next[idx].visible = !next[idx].visible
                                            saveConfig(next)
                                        }}
                                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${col.visible ? 'bg-blue-500 border-blue-500' : 'border-[#3B4050] hover:border-gray-500'}`}
                                    >
                                        {col.visible && <Check className="w-3 h-3 text-white" />}
                                    </button>
                                    <span className="text-xs font-bold text-gray-300">{col.label}</span>
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                        onClick={() => {
                                            if (idx === 0) return
                                            const next = [...columnConfig]
                                            const temp = next[idx - 1]
                                            next[idx - 1] = next[idx]
                                            next[idx] = temp
                                            saveConfig(next)
                                        }}
                                        className="p-1 hover:text-white text-gray-500"
                                    >
                                        <ChevronUp className="w-3 h-3" />
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (idx === columnConfig.length - 1) return
                                            const next = [...columnConfig]
                                            const temp = next[idx + 1]
                                            next[idx + 1] = next[idx]
                                            next[idx] = temp
                                            saveConfig(next)
                                        }}
                                        className="p-1 hover:text-white text-gray-500"
                                    >
                                        <ChevronDown className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="min-h-0 flex-1 overflow-auto">
                <table className="w-full min-w-[960px] text-left border-collapse">
                    <thead>
                        <tr className="bg-[#131722]/80 border-b border-[#2A2E39]">
                            {visibleColumns.map(col => (
                                <th
                                    key={col.id}
                                    className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest text-gray-500 select-none ${['qty_entry', 'market_profile', 'performance'].includes(col.id) ? 'text-right' : ''}`}
                                >
                                    <div
                                        className={`flex items-center gap-2 cursor-pointer hover:text-white transition-colors ${['qty_entry', 'market_profile', 'performance'].includes(col.id) ? 'justify-end' : ''}`}
                                        onClick={() => {
                                            if (col.id === 'ticker') requestSort('symbol')
                                            if (col.id === 'qty_entry') requestSort('quantity')
                                            if (col.id === 'market_profile') requestSort('marketValue')
                                            if (col.id === 'performance') requestSort('unrealizedPL')
                                        }}
                                    >
                                        {col.label}
                                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[#2A2E39]">
                        {sortedPositions.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumns.length} className="px-8 py-32 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-4 opacity-30">
                                        <MoreHorizontal className="w-16 h-16" />
                                        <p className="text-sm font-bold uppercase tracking-widest leading-loose">
                                            Awaiting Positioning<br />
                                            <span className="text-[10px] opacity-60">Fetch live accounts to begin analysis</span>
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            sortedPositions.map((pos) => (
                                <Fragment key={pos.symbol}>
                                    <tr
                                        className={`hover:bg-white/[0.03] transition-all group cursor-pointer ${expandedRows.has(pos.symbol) ? 'bg-white/[0.04]' : ''}`}
                                        onClick={() => toggleRow(pos.symbol)}
                                    >
                                        {visibleColumns.map(col => (
                                            <td key={col.id} className="px-8 py-6">
                                                {col.id === 'ticker' && (
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 bg-gradient-to-br from-white/10 to-transparent rounded-xl flex items-center justify-center font-black text-xs group-hover:from-blue-500/20 transition-all border border-white/5 relative`}>
                                                            {pos.symbol.substring(0, 2)}
                                                            {expandedRows.has(pos.symbol) && (
                                                                <div className="absolute -bottom-1 -right-1 bg-blue-500 w-3 h-3 rounded-full flex items-center justify-center border-2 border-[#1E222D]">
                                                                    <div className="w-1 h-1 bg-white rounded-full"></div>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-base tracking-tight">{pos.symbol}</div>
                                                            <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate max-w-[120px]">
                                                                {pos.description || 'Common Stock'}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {col.id === 'qty_entry' && (
                                                    <div className="text-right">
                                                            <div className="font-bold text-sm text-gray-300">{pos.quantity.toLocaleString()} Shares</div>
                                                            <div className="text-[10px] text-gray-500 font-bold mt-1 tracking-tighter uppercase tabular-nums">
                                                                AVG: <span className="text-gray-400">${pos.averagePrice.toFixed(2)}</span>
                                                            </div>
                                                    </div>
                                                )}

                                                {col.id === 'market_profile' && (
                                                    <div className="text-right font-mono">
                                                        <div className="font-bold text-white tabular-nums">${pos.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                                                        <div className="text-[10px] text-gray-500 font-bold mt-1 tracking-tighter uppercase">
                                                            MV: <span className="text-gray-400">${pos.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                        </div>
                                                    </div>
                                                )}

                                                {col.id === 'performance' && (
                                                    <div className="text-right">
                                                        <div className={`flex flex-col items-end ${pos.unrealizedPL >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                                            <div className="flex items-center gap-1 text-[10px] font-black uppercase mt-1 bg-black/20 px-1.5 py-0.5 rounded border border-white/5 tabular-nums">
                                                                {pos.unrealizedPLPercent >= 0 ? '+' : ''}{pos.unrealizedPLPercent.toFixed(2)}%
                                                            </div>
                                                            <span className="font-black text-sm tracking-tighter tabular-nums mt-2">
                                                                {pos.unrealizedPL >= 0 ? '+' : ''}${Math.abs(pos.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}

                                                {col.id === 'actions' && (
                                                    <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                                        <button
                                                            onClick={() => onAction(pos.symbol, 'BUY')}
                                                            className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-emerald-500/20"
                                                        >
                                                            Buy
                                                        </button>
                                                        <button
                                                            onClick={() => onAction(pos.symbol, 'SELL', 'ALL')}
                                                            className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                                                        >
                                                            Sell All
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const response = window.prompt(`Sell how many shares of ${pos.symbol}?`, String(pos.quantity))
                                                                if (!response) {
                                                                    return
                                                                }

                                                                const quantity = Number(response)
                                                                if (Number.isFinite(quantity) && quantity > 0) {
                                                                    onAction(pos.symbol, 'SELL', quantity)
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500 text-amber-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-amber-500/20"
                                                        >
                                                            Sell Custom
                                                        </button>
                                                    </div>
                                                )}
                                            </td>
                                        ))}
                                    </tr>

                                    {/* Expanded Row Content */}
                                    {expandedRows.has(pos.symbol) && (
                                        <tr className="bg-[#131722]/50 animate-in slide-in-from-top-2 duration-300">
                                            <td colSpan={visibleColumns.length} className="px-8 py-6">
                                                <div className="border-l-2 border-blue-500/50 pl-6 space-y-4">
                                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                                        <div>
                                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Active Position Detail</div>
                                                            <div className="overflow-hidden rounded-2xl border border-[#2A2E39]">
                                                                <table className="min-w-[420px] text-left text-xs">
                                                                    <thead className="bg-[#0F1218] text-[10px] uppercase tracking-widest text-gray-500">
                                                                        <tr>
                                                                            <th className="px-4 py-3">Position</th>
                                                                            <th className="px-4 py-3 text-right">Qty</th>
                                                                            <th className="px-4 py-3 text-right">Avg Price</th>
                                                                            <th className="px-4 py-3 text-right">Last Price</th>
                                                                            <th className="px-4 py-3 text-right">Market Value</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {(pos.lots && pos.lots.length > 0 ? pos.lots : [
                                                                            {
                                                                                id: `${pos.symbol}-aggregate`,
                                                                                quantity: pos.quantity,
                                                                                averagePrice: pos.averagePrice,
                                                                            }
                                                                        ]).map((lot, index) => (
                                                                            <tr key={lot.id ?? `${pos.symbol}-${index}`} className="border-t border-[#2A2E39]">
                                                                                <td className="px-4 py-3 text-gray-300">
                                                                                    {lot.openedAt ? new Date(lot.openedAt).toLocaleString() : 'Current Holding'}
                                                                                </td>
                                                                                <td className="px-4 py-3 text-right font-mono text-white">{lot.quantity.toLocaleString()}</td>
                                                                                <td className="px-4 py-3 text-right font-mono text-white">${lot.averagePrice.toFixed(2)}</td>
                                                                                <td className="px-4 py-3 text-right font-mono text-white">${pos.currentPrice.toFixed(2)}</td>
                                                                                <td className="px-4 py-3 text-right font-mono text-white">${(lot.quantity * pos.currentPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        </div>

                                                        <div className="min-w-[220px] rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
                                                            <div className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Position Snapshot</div>
                                                            <div className="space-y-2 text-xs">
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-500">Avg Price</span>
                                                                    <span className="font-mono text-white">${pos.averagePrice.toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-500">Last Price</span>
                                                                    <span className="font-mono text-white">${pos.currentPrice.toFixed(2)}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-500">Market Value</span>
                                                                    <span className="font-mono text-white">${pos.marketValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                                                </div>
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-gray-500">Net Since Purchase</span>
                                                                    <span className={`font-mono ${pos.unrealizedPL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                                        {pos.unrealizedPL >= 0 ? '+' : '-'}${Math.abs(pos.unrealizedPL).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <button
                                                            onClick={() => onAction(pos.symbol, 'SELL', 'ALL')}
                                                            className="px-4 py-2 bg-[#2A2E39] hover:bg-rose-500/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-[#3B4050]"
                                                        >
                                                            Sell All
                                                        </button>
                                                        <button
                                                            onClick={() => onAction(pos.symbol, 'BUY')}
                                                            className="px-4 py-2 bg-[#2A2E39] hover:bg-blue-500/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-[#3B4050]"
                                                        >
                                                            Buy More
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                const response = window.prompt(`Sell how many shares of ${pos.symbol}?`, String(pos.quantity))
                                                                if (!response) {
                                                                    return
                                                                }

                                                                const quantity = Number(response)
                                                                if (Number.isFinite(quantity) && quantity > 0) {
                                                                    onAction(pos.symbol, 'SELL', quantity)
                                                                }
                                                            }}
                                                            className="px-4 py-2 bg-[#2A2E39] hover:bg-amber-500/20 text-white rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border border-[#3B4050]"
                                                        >
                                                            Sell Custom
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </Fragment>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
