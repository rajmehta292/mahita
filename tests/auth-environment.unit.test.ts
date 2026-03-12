import { afterEach, describe, expect, it } from 'vitest'
import {
    getAuthBaseUrl,
    getAuthHealthSnapshot,
    getAuthHealthSnapshotForOrigin,
    getPublicAppOrigin,
    isGoogleAuthEnabled,
    normalizeAuthEnvironment,
} from '@/lib/auth-environment'

const ORIGINAL_ENV = { ...process.env }

function restoreEnv() {
    for (const key of Object.keys(process.env)) {
        if (!(key in ORIGINAL_ENV)) {
            delete process.env[key]
        }
    }

    Object.assign(process.env, ORIGINAL_ENV)
}

afterEach(() => {
    restoreEnv()
})

describe('auth-environment helpers', () => {
    it('respects an explicitly configured public auth origin in development', () => {
        Object.assign(process.env, {
            NODE_ENV: 'development',
            PORT: '6244',
            NEXTAUTH_URL: 'https://mahita.ai',
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret',
        })

        normalizeAuthEnvironment()

        expect(process.env.NEXTAUTH_URL).toBe('https://mahita.ai')
        expect(getAuthBaseUrl()).toBe('https://mahita.ai')
        expect(isGoogleAuthEnabled()).toBe(true)
    })

    it('reports dev-bypass health for localhost requests in development', () => {
        Object.assign(process.env, {
            NODE_ENV: 'development',
            PORT: '6244',
            NEXTAUTH_URL: 'https://mahita.ai',
            NEXTAUTH_SECRET: 'test-secret',
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret',
            ENABLE_DEV_AUTH_BYPASS: 'true',
        })

        const health = getAuthHealthSnapshotForOrigin('http://localhost:6244')

        expect(health.hasGoogleProvider).toBe(true)
        expect(health.googleSignInEnabled).toBe(false)
        expect(health.devBypassEnabled).toBe(true)
        expect(health.hasNextAuthSecret).toBe(true)
        expect(health.usesSafeLocalOrigin).toBe(true)
        expect(health.authMode).toBe('development-public-google')
        expect(health.authBaseUrl).toBe('https://mahita.ai')
        expect(health.publicAppOrigin).toBe('https://mahita.ai')
    })

    it('reports Google auth as available for public-domain requests in development', () => {
        Object.assign(process.env, {
            NODE_ENV: 'development',
            NEXTAUTH_URL: 'https://mahita.ai',
            NEXTAUTH_SECRET: 'test-secret',
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret',
            ENABLE_DEV_AUTH_BYPASS: 'true',
        })

        const health = getAuthHealthSnapshotForOrigin('https://mahita.ai')

        expect(health.googleSignInEnabled).toBe(true)
        expect(health.devBypassEnabled).toBe(false)
        expect(health.authBaseUrl).toBe('https://mahita.ai')
        expect(health.usesSafeLocalOrigin).toBe(true)
    })

    it('uses production Google auth on the public app origin', () => {
        Object.assign(process.env, {
            NODE_ENV: 'production',
            NEXTAUTH_URL: 'https://mahita.ai',
            NEXTAUTH_SECRET: 'test-secret',
            GOOGLE_CLIENT_ID: 'client-id',
            GOOGLE_CLIENT_SECRET: 'client-secret',
            MAHITA_PUBLIC_APP_ORIGIN: 'https://mahita.ai',
        })

        expect(getPublicAppOrigin()).toBe('https://mahita.ai')
        expect(isGoogleAuthEnabled()).toBe(true)

        const health = getAuthHealthSnapshot()
        expect(health.authMode).toBe('production-google')
        expect(health.googleSignInEnabled).toBe(true)
        expect(health.authBaseUrl).toBe('https://mahita.ai')
    })
})
