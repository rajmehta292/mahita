'use client'

import { useEffect, useState } from 'react'

export interface AuthHealthState {
    ok: boolean
    authMode: 'production-google' | 'production-misconfigured' | 'development-public-google' | 'development-bypass'
    hasGoogleProvider: boolean
    googleSignInEnabled: boolean
    devBypassEnabled: boolean
    usesSafeLocalOrigin: boolean
    publicAppOrigin: string
}

export function useAuthHealth() {
    const [authHealth, setAuthHealth] = useState<AuthHealthState | null>(null)

    useEffect(() => {
        let active = true

        fetch('/api/health/auth')
            .then((response) => response.json())
            .then((data: AuthHealthState) => {
                if (active) {
                    setAuthHealth(data)
                }
            })
            .catch(() => {
                if (active) {
                    setAuthHealth(null)
                }
            })

        return () => {
            active = false
        }
    }, [])

    return authHealth
}
