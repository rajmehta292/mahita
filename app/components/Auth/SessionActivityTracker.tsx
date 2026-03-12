'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { isTrackableAuthenticatedPath } from '@/lib/auth-redirect'

export function SessionActivityTracker() {
    const pathname = usePathname()
    const { status } = useSession()
    const lastTrackedPath = useRef<string | null>(null)

    useEffect(() => {
        if (status !== 'authenticated' || !pathname) {
            return
        }

        const queryString = typeof window !== 'undefined'
            ? window.location.search.replace(/^\?/, '')
            : ''
        const path = queryString ? `${pathname}?${queryString}` : pathname

        if (!isTrackableAuthenticatedPath(path) || lastTrackedPath.current === path) {
            return
        }

        lastTrackedPath.current = path

        void fetch('/api/user/session-activity', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ path }),
            keepalive: true,
        }).catch(() => {
            // Route tracking is best-effort and should never block navigation.
        })
    }, [pathname, status])

    return null
}
