'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'

interface UseViewDemandInput {
  enabled?: boolean
  surface: string
  symbol?: string | null
  timeframe?: string | null
  providerPreference?: string | null
  priorityScore?: number
  refreshIntervalSeconds?: number
  ttlSeconds?: number
}

export function useViewDemand(input: UseViewDemandInput) {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated' || input.enabled === false || !input.surface) {
      return
    }

    let active = true
    const refreshIntervalSeconds = Math.max(3, Math.floor(input.refreshIntervalSeconds ?? 13))
    const ttlSeconds = Math.max(refreshIntervalSeconds * 3, input.ttlSeconds ?? 45)

    const pushDemand = async () => {
      try {
        await fetch('/api/user/view-demand', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            surface: input.surface,
            symbol: input.symbol ?? null,
            timeframe: input.timeframe ?? null,
            providerPreference: input.providerPreference ?? null,
            priorityScore: input.priorityScore ?? 1,
            refreshIntervalSeconds,
            ttlSeconds,
          }),
        })
      } catch (error) {
        console.warn('Mahita could not update view demand:', error)
      }
    }

    void pushDemand()
    const interval = window.setInterval(() => {
      if (active) {
        void pushDemand()
      }
    }, Math.max(5_000, refreshIntervalSeconds * 1000))

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [
    input.enabled,
    input.priorityScore,
    input.providerPreference,
    input.refreshIntervalSeconds,
    input.surface,
    input.symbol,
    input.timeframe,
    input.ttlSeconds,
    status,
  ])
}
