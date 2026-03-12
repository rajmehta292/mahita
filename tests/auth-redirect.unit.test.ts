import {
    AUTH_POST_SIGNIN_PATH,
    isTrackableAuthenticatedPath,
    resolvePostSignInPath,
    resolveSignedInHomePath,
    SIGNUP_PATH,
} from '@/lib/auth-redirect'

describe('auth redirect helpers', () => {
    it('routes signed-in users to their recent page when the session sign-in is still fresh', () => {
        const destination = resolveSignedInHomePath({
            lastVisitedPath: '/portfolio?account=abc123',
            lastSignInAt: new Date(Date.now() - 30 * 60 * 1000),
        })

        expect(destination).toBe('/portfolio?account=abc123')
    })

    it('falls back to dashboard when the last sign-in is stale', () => {
        const destination = resolveSignedInHomePath({
            lastVisitedPath: '/active-trader',
            lastSignInAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
        })

        expect(destination).toBe('/dashboard')
    })

    it('uses the prior sign-in window for post-sign-in resume behavior', () => {
        const destination = resolvePostSignInPath({
            lastVisitedPath: '/backtest',
            previousSignInAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        })

        expect(destination).toBe('/backtest')
    })

    it('routes first-time sign-ins into setup', () => {
        const destination = resolvePostSignInPath({
            lastVisitedPath: null,
            previousSignInAt: null,
        })

        expect(destination).toBe(SIGNUP_PATH)
    })

    it('rejects unsafe auth or api paths from redirect restoration', () => {
        expect(resolvePostSignInPath({
            lastVisitedPath: '/auth/signin',
            previousSignInAt: new Date(),
        })).toBe('/dashboard')

        expect(resolveSignedInHomePath({
            lastVisitedPath: '/api/user/preferences',
            lastSignInAt: new Date(),
        })).toBe('/dashboard')
    })

    it('never treats the post-sign-in route itself as a trackable app page', () => {
        expect(isTrackableAuthenticatedPath('/dashboard')).toBe(true)
        expect(isTrackableAuthenticatedPath(AUTH_POST_SIGNIN_PATH)).toBe(false)
        expect(isTrackableAuthenticatedPath('/auth/signin')).toBe(false)
        expect(isTrackableAuthenticatedPath('/api/auth/session')).toBe(false)
    })
})
