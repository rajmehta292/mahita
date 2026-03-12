'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

export interface UserPreferencesState {
    id?: string
    userId?: string
    selectedAccountId?: string | null
    portfolioColumns?: string | null
    portfolioSortKey?: string | null
    portfolioSortDirection?: string | null
    dashboardLayout?: string | null
    watchlistSymbols?: string | null
    trendingStrategyIds?: string | null
}

export function useUserPreferences() {
    const { status } = useSession()
    const [preferences, setPreferences] = useState<UserPreferencesState | null>(null)
    const [loading, setLoading] = useState(true)
    const preferencesRef = useRef<UserPreferencesState | null>(null)

    useEffect(() => {
        preferencesRef.current = preferences
    }, [preferences])

    const refresh = useCallback(async () => {
        if (status === 'unauthenticated') {
            setPreferences(null)
            setLoading(false)
            return
        }

        if (status !== 'authenticated') {
            return
        }

        setLoading(true)
        try {
            const response = await fetch('/api/user/preferences', { cache: 'no-store' })
            if (!response.ok) {
                throw new Error('Failed to load preferences')
            }

            const data = await response.json()
            const nextPreferences = data.preferences ?? null
            preferencesRef.current = nextPreferences
            setPreferences(nextPreferences)
        } catch (error) {
            console.error('Preference load failed:', error)
        } finally {
            setLoading(false)
        }
    }, [status])

    useEffect(() => {
        void refresh()
    }, [refresh])

    const updatePreferences = useCallback(async (patch: Partial<UserPreferencesState>) => {
        if (status !== 'authenticated') {
            return preferencesRef.current
        }

        const currentPreferences = preferencesRef.current
        const patchEntries = Object.entries(patch) as Array<[keyof UserPreferencesState, UserPreferencesState[keyof UserPreferencesState]]>
        const hasChanges = patchEntries.some(([key, value]) => currentPreferences?.[key] !== value)

        if (!hasChanges) {
            return currentPreferences
        }

        const previousPreferences = currentPreferences
        const optimisticPreferences = { ...(currentPreferences ?? {}), ...patch }
        preferencesRef.current = optimisticPreferences
        setPreferences(optimisticPreferences)

        try {
            const response = await fetch('/api/user/preferences', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(patch)
            })

            if (!response.ok) {
                throw new Error('Failed to update preferences')
            }

            const data = await response.json()
            const nextPreferences = data.preferences ?? null
            preferencesRef.current = nextPreferences
            setPreferences(nextPreferences)
            return data.preferences as UserPreferencesState | null
        } catch (error) {
            preferencesRef.current = previousPreferences ?? null
            setPreferences(previousPreferences ?? null)
            throw error
        }
    }, [status])

    return {
        preferences,
        loading,
        refresh,
        updatePreferences
    }
}
