'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import { MainLayout } from '../components/Layout/MainLayout'
import { useUserPreferences } from '../hooks/use-user-preferences'
import { parseStoredStringArray, serializeStringArray } from '@/lib/preferences-serialization'
import { TrendingIndicatorsDashboard } from '../components/TrendingIndicators/TrendingIndicatorsDashboard'
import type { TrendingIndicatorCard, TrendingStrategyInput } from '@/lib/trending-indicators'
import { AuthEntryCta } from '../components/Auth/AuthEntryCta'

interface SavedStrategy extends TrendingStrategyInput {
    createdAt?: string
    updatedAt?: string
}

export default function TrendingIndicatorsPage() {
    const { data: session, status } = useSession()
    const { preferences, updatePreferences } = useUserPreferences()
    const [strategies, setStrategies] = useState<SavedStrategy[]>([])
    const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([])
    const [cards, setCards] = useState<TrendingIndicatorCard[]>([])
    const [generatedAt, setGeneratedAt] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const watchlistSymbols = useMemo(() => {
        const preferred = parseStoredStringArray(preferences?.watchlistSymbols)
        if (preferred.length > 0) {
            return preferred
        }

        if (typeof window === 'undefined') {
            return []
        }

        try {
            const stored = window.localStorage.getItem('mahita_watchlist')
            return stored ? parseStoredStringArray(stored) : []
        } catch {
            return []
        }
    }, [preferences?.watchlistSymbols])

    useEffect(() => {
        if (typeof window === 'undefined') {
            return
        }

        try {
            const stored = window.localStorage.getItem('strategies')
            const parsed = stored ? (JSON.parse(stored) as SavedStrategy[]) : []
            setStrategies(parsed)
        } catch (parseError) {
            console.warn('Failed to parse saved strategies for Trending Indicators:', parseError)
            setStrategies([])
        }
    }, [])

    useEffect(() => {
        if (strategies.length === 0) {
            setSelectedStrategyIds([])
            return
        }

        const preferredIds = parseStoredStringArray(preferences?.trendingStrategyIds)
        const validPreferredIds = preferredIds.filter((id) => strategies.some((strategy) => strategy.id === id))
        const nextIds = validPreferredIds.length > 0
            ? validPreferredIds
            : strategies.map((strategy) => strategy.id)

        setSelectedStrategyIds(nextIds)
    }, [preferences?.trendingStrategyIds, strategies])

    const refresh = useCallback(async () => {
        if (strategies.length === 0) {
            setCards([])
            setGeneratedAt(null)
            return
        }

        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/trending-indicators/scan', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    strategies,
                    symbols: watchlistSymbols,
                }),
            })
            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Failed to evaluate strategy monitoring cards.')
            }

            setCards(Array.isArray(data.cards) ? data.cards : [])
            setGeneratedAt(data.generatedAt ?? new Date().toISOString())
        } catch (scanError) {
            setError(scanError instanceof Error ? scanError.message : 'Failed to evaluate strategy monitoring cards.')
        } finally {
            setLoading(false)
        }
    }, [strategies, watchlistSymbols])

    useEffect(() => {
        if (status !== 'authenticated') {
            return
        }

        refresh()
        const interval = window.setInterval(refresh, 30_000)
        return () => window.clearInterval(interval)
    }, [refresh, status])

    const persistSelectedIds = useCallback((nextIds: string[]) => {
        setSelectedStrategyIds(nextIds)
        updatePreferences({
            trendingStrategyIds: serializeStringArray(nextIds),
        }).catch((preferenceError) => {
            console.warn('Failed to persist Trending Indicators display state:', preferenceError)
        })
    }, [updatePreferences])

    const toggleStrategy = useCallback((strategyId: string) => {
        persistSelectedIds(
            selectedStrategyIds.includes(strategyId)
                ? selectedStrategyIds.filter((id) => id !== strategyId)
                : [...selectedStrategyIds, strategyId]
        )
    }, [persistSelectedIds, selectedStrategyIds])

    if (status === 'loading') {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex items-center justify-center h-full bg-[#131722] text-white">Loading…</div>
            </MainLayout>
        )
    }

    if (!session) {
        return (
            <MainLayout showBottomPanel={false}>
                <div className="flex h-full items-center justify-center bg-[#131722] p-6">
                    <div className="max-w-md rounded-3xl border border-[#2A2E39] bg-[#1E222D] p-10 text-center shadow-2xl">
                        <h1 className="text-2xl font-black tracking-tight text-white">Sign in to monitor strategy state</h1>
                        <p className="mt-3 text-sm leading-6 text-gray-400">
                            Trending Indicators uses your saved strategies and account-aware market context to build live strategy cards.
                        </p>
                        <div className="mt-8">
                            <AuthEntryCta className="rounded-2xl bg-blue-500 px-6 py-3 text-sm font-black uppercase tracking-[0.2em] text-white transition-colors hover:bg-blue-600" />
                        </div>
                    </div>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout showBottomPanel={false}>
            <TrendingIndicatorsDashboard
                generatedAt={generatedAt}
                strategies={strategies}
                cards={cards}
                selectedStrategyIds={selectedStrategyIds}
                loading={loading}
                error={error}
                onToggleStrategy={toggleStrategy}
                onSelectAll={() => persistSelectedIds(strategies.map((strategy) => strategy.id))}
                onClearAll={() => persistSelectedIds([])}
                onRefresh={refresh}
            />
        </MainLayout>
    )
}
