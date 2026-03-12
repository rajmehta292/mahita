import { expect, test } from '@playwright/test'

test('auth surfaces are reachable and localhost stays on the dev-bypass path', async ({
    page,
    request,
}) => {
    await page.goto('/')
    await expect(page.getByText(/strategy intelligence for live traders/i)).toBeVisible()
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByText(/continue into mahita/i)).toBeVisible()

    const authHealthResponse = await request.get('/api/health/auth')
    expect(authHealthResponse.ok()).toBeTruthy()

    const authHealth = await authHealthResponse.json()
    expect(authHealth).toMatchObject({
        usesSafeLocalOrigin: true,
        errorPagePath: '/auth/error',
        signInPath: '/auth/signin',
    })
    expect(authHealth.googleSignInEnabled).toBe(false)
    expect(authHealth.devBypassEnabled).toBe(true)

    const providersResponse = await request.get('/api/auth/providers')
    expect(providersResponse.ok()).toBeTruthy()

    const providers = await providersResponse.json()
    if (authHealth.hasGoogleProvider) {
        expect(providers.google.callbackUrl).toMatch(/^http:\/\/localhost:624\d\/api\/auth\/callback\/google$/)
    }

    await page.goto('/auth/signin')
    await expect(page.getByText(/MAHITA TERMINAL/i)).toBeVisible()
    await expect(page.getByText(/google sign-in runs on the production domain/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in with dev bypass/i })).toBeVisible()

    await page.goto('/auth/error?error=Configuration')
    await expect(page.getByText(/Authentication configuration issue/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /view auth health/i })).toBeVisible()
})

test('landing sign-in menu can render the production Google CTA when auth health reports a public-origin request', async ({
    page,
}) => {
    await page.route('**/api/health/auth', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ok: true,
                authMode: 'production-google',
                authBaseUrl: 'https://mahita.ai',
                publicAppOrigin: 'https://mahita.ai',
                hasNextAuthSecret: true,
                hasGoogleProvider: true,
                googleSignInEnabled: true,
                hasDedicatedAppSecretKey: true,
                devBypassEnabled: false,
                usesSafeLocalOrigin: true,
                allowDevGoogleAuth: false,
                errorPagePath: '/auth/error',
                signInPath: '/auth/signin',
            }),
        })
    })

    await page.goto('/')
    await page.getByRole('button', { name: /^sign in$/i }).click()
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible()
    await expect(page.getByText(/continue into mahita/i)).toBeVisible()
})
