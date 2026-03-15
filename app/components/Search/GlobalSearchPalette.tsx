'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Command, FileText, Search, Star, Wallet, X } from 'lucide-react'
import type { GlobalSearchGroup } from '@/lib/screener/types'

interface GlobalSearchPaletteProps {
    open: boolean
    onClose: () => void
}

const GROUP_ICONS = {
    instruments: Search,
    presets: Star,
    strategies: Command,
    watchlist: Star,
    portfolio: Wallet,
    documentation: FileText,
} as const

export function GlobalSearchPalette({ open, onClose }: GlobalSearchPaletteProps) {
    const router = useRouter()
    const [query, setQuery] = useState('')
    const [groups, setGroups] = useState<GlobalSearchGroup[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedIndex, setSelectedIndex] = useState(0)

    const flatResults = useMemo(
        () => groups.flatMap((group) => group.results.map((result) => ({ ...result, groupLabel: group.label }))),
        [groups]
    )

    useEffect(() => {
        function onKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
                event.preventDefault()
                if (open) onClose()
                else {
                    const openButton = document.getElementById('mahita-global-search-trigger')
                    openButton?.click()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [onClose, open])

    useEffect(() => {
        if (!open) {
            setQuery('')
            setGroups([])
            setSelectedIndex(0)
            setError(null)
            return
        }

        const handle = window.setTimeout(async () => {
            if (!query.trim()) {
                setGroups([])
                setLoading(false)
                setError(null)
                return
            }

            setLoading(true)
            setError(null)

            try {
                const response = await fetch(`/api/search/global?q=${encodeURIComponent(query.trim())}`, {
                    cache: 'no-store',
                })
                if (!response.ok) {
                    throw new Error('Failed to search Mahita.')
                }

                const json = await response.json()
                setGroups(json.groups ?? [])
                setSelectedIndex(0)
            } catch (searchError) {
                setGroups([])
                setError(searchError instanceof Error ? searchError.message : 'Failed to search Mahita.')
            } finally {
                setLoading(false)
            }
        }, 180)

        return () => window.clearTimeout(handle)
    }, [open, query])

    useEffect(() => {
        if (!open) return

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                event.preventDefault()
                onClose()
                return
            }

            if (event.key === 'ArrowDown') {
                event.preventDefault()
                setSelectedIndex((current) => Math.min(flatResults.length - 1, current + 1))
                return
            }

            if (event.key === 'ArrowUp') {
                event.preventDefault()
                setSelectedIndex((current) => Math.max(0, current - 1))
                return
            }

            if (event.key === 'Enter') {
                const selected = flatResults[selectedIndex]
                if (selected) {
                    event.preventDefault()
                    router.push(selected.href)
                    onClose()
                } else if (query.trim()) {
                    event.preventDefault()
                    router.push(`/superchart?symbol=${encodeURIComponent(query.trim().toUpperCase())}&timeframe=1d`)
                    onClose()
                }
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [flatResults, onClose, open, query, router, selectedIndex])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 px-4 pt-24 backdrop-blur-sm" onClick={onClose}>
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Global search"
                className="w-full max-w-4xl overflow-hidden rounded-3xl border border-[#2A2E39] bg-[#171a24] shadow-2xl shadow-black/50"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center gap-3 border-b border-[#2A2E39] px-5 py-4">
                    <Search className="h-5 w-5 text-gray-500" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search instruments, screener presets, strategies, docs..."
                        className="w-full bg-transparent text-base text-white placeholder:text-gray-500 focus:outline-none"
                    />
                    <div className="hidden items-center gap-1 rounded-lg border border-[#343847] bg-[#11131a] px-2 py-1 text-xs text-gray-400 sm:flex">
                        <Command className="h-3.5 w-3.5" />
                        <span>K</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-[#343847] bg-[#11131a] p-2 text-gray-400 transition hover:bg-[#202433] hover:text-white"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="max-h-[65vh] overflow-y-auto p-4">
                    {!query.trim() ? (
                        <div className="rounded-2xl border border-[#2A2E39] bg-[#11131a] p-6 text-sm text-gray-400">
                            Search instruments, screener presets, strategies, watchlist symbols, portfolio holdings, and documentation from one place.
                        </div>
                    ) : loading ? (
                        <div className="rounded-2xl border border-[#2A2E39] bg-[#11131a] p-6 text-sm text-gray-400">
                            Searching Mahita...
                        </div>
                    ) : error ? (
                        <div className="rounded-2xl border border-[#5a2630] bg-[#32161c] p-6 text-sm text-red-200">
                            {error}
                        </div>
                    ) : flatResults.length === 0 ? (
                        <div className="rounded-2xl border border-[#2A2E39] bg-[#11131a] p-6 text-sm text-gray-400">
                            No results matched that search. Press Enter to open MahaCharts directly for <span className="text-white">{query.trim().toUpperCase()}</span>.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {groups.map((group) => {
                                const Icon = GROUP_ICONS[group.key] ?? Search
                                return (
                                    <div key={group.key} className="rounded-2xl border border-[#2A2E39] bg-[#11131a]">
                                        <div className="flex items-center gap-2 border-b border-[#2A2E39] px-4 py-3 text-xs font-medium uppercase tracking-[0.18em] text-gray-500">
                                            <Icon className="h-4 w-4" />
                                            <span>{group.label}</span>
                                        </div>
                                        <div className="divide-y divide-[#1f2330]">
                                            {group.results.map((result) => {
                                                const resultIndex = flatResults.findIndex((item) => item.id === result.id)
                                                const isSelected = resultIndex === selectedIndex
                                                return (
                                                    <Link
                                                        key={result.id}
                                                        href={result.href}
                                                        onMouseEnter={() => setSelectedIndex(resultIndex)}
                                                        onClick={onClose}
                                                        className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition ${
                                                            isSelected ? 'bg-blue-500/10' : 'hover:bg-[#1a2030]'
                                                        }`}
                                                    >
                                                        <div>
                                                            <div className="text-sm font-medium text-white">{result.title}</div>
                                                            {result.subtitle && <div className="text-xs text-gray-400">{result.subtitle}</div>}
                                                        </div>
                                                        {result.badge && (
                                                            <span className="rounded-full border border-[#343847] bg-[#171b26] px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-gray-400">
                                                                {result.badge}
                                                            </span>
                                                        )}
                                                    </Link>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
