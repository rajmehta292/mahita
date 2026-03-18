import type { Page } from '@playwright/test'

export async function signInWithDevBypass(
    page: Page,
    destination = '/dashboard',
    options?: { email?: string }
) {
    const email = options?.email ?? 'dev@mahita.ai'

    await page.goto('/auth/signin')

    const signInResult = await page.evaluate(async ({ email: devEmail }) => {
        const csrfResponse = await fetch('/api/auth/csrf', {
            credentials: 'include',
        })
        const { csrfToken } = await csrfResponse.json()

        const body = new URLSearchParams({
            csrfToken,
            email: devEmail,
            password: 'password',
            callbackUrl: '/auth/post-signin',
            json: 'true',
        })

        const response = await fetch('/api/auth/callback/credentials?json=true', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
        })

        return response.json().catch(async () => ({
            ok: response.ok,
            error: `Non-JSON credentials callback response: ${await response.text()}`,
        }))
    }, { email })

    if (signInResult?.error) {
        throw new Error(`Dev bypass sign-in failed for ${email}: ${signInResult.error}`)
    }

    if (!page.url().includes(destination)) {
        await page.goto(destination)
    }
}
