import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getAppServerSession } = vi.hoisted(() => ({
    getAppServerSession: vi.fn(),
}))

vi.mock('@/lib/server-session', () => ({
    getAppServerSession,
}))

vi.mock('@/lib/prisma', () => ({
    default: {
        adminAuditEvent: {
            create: vi.fn(),
        },
        adminSecretRevealGrant: {
            create: vi.fn(),
        },
        account: {
            updateMany: vi.fn(),
        },
        userPreference: {
            findUnique: vi.fn(),
        },
    },
}))

import {
    allowInsecureUserBrokeragePlatformFallback,
    createAdminSecretRevealGrant,
    hasRecentAuthentication,
    requireRouteAccess,
} from '@/lib/security/platform-security'
import { buildSecurityHeaders } from '@/lib/security/http-headers'
import prisma from '@/lib/prisma'

describe('platform-security', () => {
    const originalNodeEnv = process.env.NODE_ENV
    const originalFallbackFlag = process.env.MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK

    beforeEach(() => {
        vi.clearAllMocks()
        vi.unstubAllEnvs()
        if (originalNodeEnv !== undefined) {
            vi.stubEnv('NODE_ENV', originalNodeEnv)
        }
        process.env.MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK = originalFallbackFlag
    })

    it('only enables insecure platform brokerage fallback for explicit local development', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK', 'true')
        expect(allowInsecureUserBrokeragePlatformFallback()).toBe(false)

        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK', 'false')
        expect(allowInsecureUserBrokeragePlatformFallback()).toBe(false)

        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('MAHITA_ALLOW_INSECURE_USER_BROKERAGE_PLATFORM_FALLBACK', 'true')
        expect(allowInsecureUserBrokeragePlatformFallback()).toBe(true)
    })

    it('builds hardened security headers and only adds HSTS in production', () => {
        const devHeaders = buildSecurityHeaders({ isDevelopment: true, isProduction: false })
        const prodHeaders = buildSecurityHeaders({ isDevelopment: false, isProduction: true })
        const popupHeaders = buildSecurityHeaders({
            isDevelopment: false,
            isProduction: true,
            crossOriginOpenerPolicy: 'same-origin-allow-popups',
        })

        expect(devHeaders.find((header) => header.key === 'Content-Security-Policy')?.value).toContain("'unsafe-eval'")
        expect(devHeaders.find((header) => header.key === 'Cross-Origin-Opener-Policy')?.value).toBe('same-origin')
        expect(popupHeaders.find((header) => header.key === 'Cross-Origin-Opener-Policy')?.value).toBe('same-origin-allow-popups')
        expect(devHeaders.find((header) => header.key === 'Strict-Transport-Security')).toBeUndefined()
        expect(prodHeaders.find((header) => header.key === 'Strict-Transport-Security')?.value).toContain('max-age=31536000')
    })

    it('rejects unauthorized and non-superuser access when a route requires superuser privileges', async () => {
        getAppServerSession.mockResolvedValueOnce(null)
        const unauthorized = await requireRouteAccess({ policy: 'superuser' })
        expect(unauthorized.ok).toBe(false)
        if (!unauthorized.ok) {
            expect(unauthorized.response.status).toBe(401)
        }

        getAppServerSession.mockResolvedValueOnce({
            user: {
                id: 'user-1',
                role: 'USER',
            },
        })
        const forbidden = await requireRouteAccess({ policy: 'superuser' })
        expect(forbidden.ok).toBe(false)
        if (!forbidden.ok) {
            expect(forbidden.response.status).toBe(403)
        }

        getAppServerSession.mockResolvedValueOnce({
            user: {
                id: 'user-2',
                role: 'SUPERUSER',
            },
        })
        const allowed = await requireRouteAccess({ policy: 'superuser' })
        expect(allowed.ok).toBe(true)
        if (allowed.ok) {
            expect(allowed.userId).toBe('user-2')
            expect(allowed.role).toBe('SUPERUSER')
        }
    })

    it('allows admins through the shared admin policy without requiring superuser', async () => {
        getAppServerSession.mockResolvedValueOnce({
            user: {
                id: 'admin-1',
                role: 'ADMIN',
            },
        })

        const allowed = await requireRouteAccess({ policy: 'admin' })
        expect(allowed.ok).toBe(true)
        if (allowed.ok) {
            expect(allowed.role).toBe('ADMIN')
        }
    })

    it('requires a recent sign-in for break-glass actions', async () => {
        vi.mocked(prisma.userPreference.findUnique).mockResolvedValueOnce({
            lastSignInAt: new Date(Date.now() - 45 * 60_000),
        } as never)

        const stale = await hasRecentAuthentication({ userId: 'user-1', maxAgeMinutes: 30 })
        expect(stale.ok).toBe(false)

        vi.mocked(prisma.userPreference.findUnique).mockResolvedValueOnce({
            lastSignInAt: new Date(Date.now() - 5 * 60_000),
        } as never)

        const fresh = await hasRecentAuthentication({ userId: 'user-1', maxAgeMinutes: 30 })
        expect(fresh.ok).toBe(true)
    })

    it('creates a persisted break-glass reveal grant with an expiry window', async () => {
        vi.mocked(prisma.adminSecretRevealGrant.create).mockResolvedValueOnce({
            id: 'grant-1',
            actorUserId: 'admin-1',
            providerCredentialId: 'cred-1',
            targetUserId: 'user-1',
            reason: 'Operational recovery',
            expiresAt: new Date(Date.now() + 60_000),
            revokedAt: null,
            createdAt: new Date(),
        } as never)

        const grant = await createAdminSecretRevealGrant({
            actorUserId: 'admin-1',
            providerCredentialId: 'cred-1',
            targetUserId: 'user-1',
            reason: 'Operational recovery',
            revealWindowMs: 60_000,
        })

        expect(grant.id).toBe('grant-1')
        expect(grant.actorUserId).toBe('admin-1')
        expect(grant.providerCredentialId).toBe('cred-1')
        expect(grant.reason).toBe('Operational recovery')
        expect(vi.mocked(prisma.adminSecretRevealGrant.create)).toHaveBeenCalledTimes(1)
    })
})
