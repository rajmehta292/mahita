'use client'

import { useMemo, useState } from 'react'
import {
    Activity,
    ChevronDown,
    ChevronUp,
    Filter,
    Radar,
    RefreshCw,
    Signal,
    TrendingUp,
} from 'lucide-react'
import clsx from 'clsx'
import type { TrendingIndicatorCard, TrendingStrategyInput } from '@/lib/trending-indicators'

interface TrendingIndicatorsDashboardProps {
    generatedAt?: string | null
    strategies: TrendingStrategyInput[]
    cards: TrendingIndicatorCard[]
    selectedStrategyIds: string[]
    loading: boolean
    error: string | null
    onToggleStrategy: (strategyId: string) => void
    onSelectAll: () => void
    onClearAll: () => void
    onRefresh: () => void
}

export function TrendingIndicatorsDashboard({
    generatedAt,
    strategies,
    cards,
    selectedStrategyIds,
    loading,
    error,
    onToggleStrategy,
    onSelectAll,
    onClearAll,
    onRefresh,
}: TrendingIndicatorsDashboardProps) {
    const [selectorOpen, setSelectorOpen] = useState(false)
    const visibleCards = useMemo(
        () => cards.filter((card) => selectedStrategyIds.includes(card.strategyId)),
        [cards, selectedStrategyIds]
    )

    return (
        <div className="flex-1 overflow-auto bg-[#131722]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <section className="rounded-[32px] border border-[#2A2E39] bg-[#1E222D] p-6 shadow-2xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <div className="mb-3 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-blue-400">
                                <Radar className="h-4 w-4" />
                                Trending Indicators
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Live strategy state across your selected strategies</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                Each card shows the latest confirmed strategy state on the most recent closed bar: full strategy matches, new triggers,
                                and the individual indicator conditions driving the entry logic.
                            </p>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                            <div className="text-right">
                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-gray-500">Live As Of</div>
                                <div className="mt-1 text-sm font-bold text-white">
                                    {generatedAt ? new Date(generatedAt).toLocaleString() : 'Awaiting first scan'}
                                </div>
                            </div>

                            <div className="relative">
                                <button
                                    onClick={() => setSelectorOpen((current) => !current)}
                                    className="flex items-center gap-2 rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-white transition-colors hover:border-blue-500/40"
                                >
                                    <Filter className="h-4 w-4 text-blue-400" />
                                    Strategy Display
                                    {selectorOpen ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                                </button>

                                {selectorOpen && (
                                    <div className="absolute right-0 top-full z-30 mt-3 w-[320px] rounded-3xl border border-[#2A2E39] bg-[#11141B] p-4 shadow-2xl">
                                        <div className="mb-4 flex items-center justify-between">
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Visible Strategies</div>
                                                <div className="mt-1 text-sm font-bold text-white">{selectedStrategyIds.length} selected</div>
                                            </div>
                                            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em]">
                                                <button onClick={onSelectAll} className="text-blue-400 transition-colors hover:text-blue-300">All</button>
                                                <button onClick={onClearAll} className="text-gray-500 transition-colors hover:text-white">Clear</button>
                                            </div>
                                        </div>

                                        <div className="space-y-2">
                                            {strategies.length === 0 ? (
                                                <div className="rounded-2xl border border-dashed border-[#2A2E39] px-4 py-5 text-sm text-gray-500">
                                                    Save a strategy in Backtester to begin monitoring it here.
                                                </div>
                                            ) : (
                                                strategies.map((strategy) => {
                                                    const selected = selectedStrategyIds.includes(strategy.id)
                                                    return (
                                                        <label
                                                            key={strategy.id}
                                                            className={clsx(
                                                                'flex cursor-pointer items-start gap-3 rounded-2xl border px-3 py-3 transition-colors',
                                                                selected
                                                                    ? 'border-blue-500/40 bg-blue-500/10'
                                                                    : 'border-[#2A2E39] bg-[#171B24] hover:border-[#3B4050]'
                                                            )}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                checked={selected}
                                                                onChange={() => onToggleStrategy(strategy.id)}
                                                                className="mt-0.5 h-4 w-4 rounded border-[#3B4050] bg-[#0D0F14] text-blue-500 focus:ring-blue-500"
                                                            />
                                                            <div className="min-w-0">
                                                                <div className="truncate text-sm font-bold text-white">{strategy.name}</div>
                                                                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-gray-500">
                                                                    {strategy.timeframe || '1d'} {strategy.symbol ? `• ${strategy.symbol}` : ''}
                                                                </div>
                                                            </div>
                                                        </label>
                                                    )
                                                })
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </section>

                <div className="flex items-center justify-between gap-3 rounded-3xl border border-[#2A2E39] bg-[#1E222D] px-5 py-4">
                    <div className="flex items-center gap-3 text-sm text-gray-300">
                        <Signal className="h-4 w-4 text-blue-400" />
                        <span>Closed-bar confirmed signals only. Unsupported scripts are flagged instead of estimated.</span>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="flex items-center gap-2 rounded-2xl border border-[#2A2E39] bg-[#131722] px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300 transition-colors hover:text-white disabled:opacity-50"
                    >
                        <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin text-blue-400')} />
                        Refresh Scan
                    </button>
                </div>

                {error ? (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm text-rose-300">{error}</div>
                ) : null}

                {visibleCards.length === 0 && !loading ? (
                    <div className="rounded-[32px] border border-dashed border-[#2A2E39] bg-[#1E222D] px-6 py-16 text-center">
                        <TrendingUp className="mx-auto h-12 w-12 text-blue-500/40" />
                        <h2 className="mt-4 text-xl font-black text-white">No strategy cards selected</h2>
                        <p className="mt-3 text-sm text-gray-400">
                            Use the strategy selector to choose which saved strategies should appear in this monitoring view.
                        </p>
                    </div>
                ) : null}

                <div className="grid gap-6 xl:grid-cols-2">
                    {visibleCards.map((card) => (
                        <article key={card.strategyId} className="overflow-hidden rounded-[30px] border border-[#2A2E39] bg-[#1E222D] shadow-2xl">
                            <div className="border-b border-[#2A2E39] bg-white/[0.02] px-6 py-5">
                                <div className="flex flex-wrap items-start justify-between gap-4">
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-xl font-black tracking-tight text-white">{card.name}</h2>
                                            <StatusBadge status={card.status} />
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-gray-500">
                                            <span>{card.timeframe}</span>
                                            <span>Full Matches {card.summary.fullEntryMatches}</span>
                                            <span>New Triggers {card.summary.newTriggers}</span>
                                            <span>Near Misses {card.summary.nearMisses}</span>
                                        </div>
                                    </div>

                                    <div className="text-right text-xs text-gray-500">
                                        <div className="font-black uppercase tracking-[0.18em]">Last Scan</div>
                                        <div className="mt-1 font-medium text-gray-300">
                                            {card.lastScanAt ? new Date(card.lastScanAt).toLocaleString() : 'No scan data'}
                                        </div>
                                    </div>
                                </div>

                                {card.supportNote ? (
                                    <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                        {card.supportNote}
                                    </div>
                                ) : null}
                            </div>

                            <div className="grid gap-5 px-6 py-5">
                                <section className="rounded-3xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-blue-400">
                                        <Activity className="h-4 w-4" />
                                        Full Strategy Buy Matches
                                    </div>
                                    {card.fullStrategyMatches.length === 0 ? (
                                        <EmptyMatchState message="No symbols satisfy the full entry logic on the latest confirmed bar." />
                                    ) : (
                                        <TickerList matches={card.fullStrategyMatches} />
                                    )}
                                </section>

                                <div className="grid gap-4 md:grid-cols-2">
                                    <section className="rounded-3xl border border-[#2A2E39] bg-[#131722] p-4">
                                        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-400">New Triggers</div>
                                        {card.newTriggers.length === 0 ? (
                                            <EmptyMatchState message="No fresh entry transitions were detected on the latest bar." />
                                        ) : (
                                            <TickerList matches={card.newTriggers} />
                                        )}
                                    </section>

                                    <section className="rounded-3xl border border-[#2A2E39] bg-[#131722] p-4">
                                        <div className="mb-3 text-[11px] font-black uppercase tracking-[0.22em] text-orange-400">Near Misses</div>
                                        {card.nearMisses.length === 0 ? (
                                            <EmptyMatchState message="No symbols are one condition away from a full entry match." />
                                        ) : (
                                            <TickerList matches={card.nearMisses} />
                                        )}
                                    </section>
                                </div>

                                <section className="rounded-3xl border border-[#2A2E39] bg-[#131722] p-4">
                                    <div className="mb-4 text-[11px] font-black uppercase tracking-[0.22em] text-gray-400">Indicator State</div>
                                    <div className="space-y-4">
                                        {card.indicators.map((indicator) => (
                                            <div key={indicator.conditionId} className="rounded-3xl border border-[#2A2E39] bg-[#171B24] p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <div className="text-sm font-black text-white">{indicator.label}</div>
                                                        <div className="mt-1 text-xs text-gray-500">{indicator.ruleText}</div>
                                                    </div>
                                                    <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-blue-300">
                                                        {indicator.matchCount} matches
                                                    </div>
                                                </div>

                                                {indicator.matches.length === 0 ? (
                                                    <EmptyMatchState message="No symbols currently satisfy this indicator condition." className="mt-4" compact />
                                                ) : (
                                                    <ul className="mt-4 space-y-3">
                                                        {indicator.matches.map((match) => (
                                                            <li key={`${indicator.conditionId}-${match.symbol}`} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3">
                                                                <div className="flex flex-wrap items-center justify-between gap-3">
                                                                    <div>
                                                                        <div className="text-sm font-black text-white">{match.symbol}</div>
                                                                        <div className="mt-1 text-xs text-gray-500">{match.reason}</div>
                                                                    </div>
                                                                    <div className="text-right text-xs text-gray-400">
                                                                        <div>${match.price.toFixed(2)}</div>
                                                                        <div>{new Date(match.matchedAt).toLocaleTimeString()}</div>
                                                                    </div>
                                                                </div>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: TrendingIndicatorCard['status'] }) {
    if (status === 'active') {
        return <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">Active</span>
    }

    if (status === 'data_stale') {
        return <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-orange-300">Data Stale</span>
    }

    return <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-rose-300">Unsupported</span>
}

function TickerList({ matches }: { matches: Array<{ symbol: string; price: number; matchedAt: string; matchedConditions: number; totalConditions: number; isNewTrigger?: boolean }> }) {
    return (
        <ul className="space-y-3">
            {matches.map((match) => (
                <li key={`${match.symbol}-${match.matchedAt}`} className="rounded-2xl border border-[#2A2E39] bg-[#171B24] px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-black text-white">{match.symbol}</span>
                                {match.isNewTrigger ? (
                                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                                        New
                                    </span>
                                ) : null}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                                {match.matchedConditions}/{match.totalConditions} conditions • {new Date(match.matchedAt).toLocaleTimeString()}
                            </div>
                        </div>
                        <div className="text-right text-sm font-bold text-white">${match.price.toFixed(2)}</div>
                    </div>
                </li>
            ))}
        </ul>
    )
}

function EmptyMatchState({ message, className, compact = false }: { message: string; className?: string; compact?: boolean }) {
    return (
        <div className={clsx('rounded-2xl border border-dashed border-[#2A2E39] px-4 text-sm text-gray-500', compact ? 'py-4' : 'py-5', className)}>
            {message}
        </div>
    )
}
