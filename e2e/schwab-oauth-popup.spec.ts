import { expect, test } from '@playwright/test'

async function signInWithDevBypass(page: import('@playwright/test').Page) {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })
}

test('successful Schwab OAuth closes the popup even when window.opener is missing on callback', async ({ page }) => {
    let isConnected = false
    const context = page.context()

    await context.route('**/api/user/schwab-config', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                config: {
                    hasClientId: true,
                    hasClientSecret: true,
                    hasAccessToken: isConnected,
                    hasRefreshToken: isConnected,
                },
            }),
        })
    })

    await context.route('**/api/schwab/auth?action=authorize', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                authUrl: 'https://auth.schwab.test/authorize',
            }),
        })
    })

    await context.route('**/api/schwab/auth', async (route) => {
        if (route.request().method() === 'POST') {
            isConnected = true
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    success: true,
                }),
            })
            return
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                isConnected,
                isPendingAuthorization: !isConnected,
            }),
        })
    })

    await context.route('**/api/schwab/accounts', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                accounts: [
                    {
                        securitiesAccount: {
                            accountId: 'demo-margin-6251',
                            hashValue: 'demo-hash-6251',
                            type: 'MARGIN',
                        },
                    },
                ],
            }),
        })
    })

    await context.route('**/api/schwab/positions**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                positions: [],
                balance: {
                    cashBalance: 1,
                    equity: 1,
                    buyingPower: 1,
                    dayTradingBuyingPower: 1,
                },
            }),
        })
    })

    await context.route('**/api/schwab/orders**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                success: true,
                orders: [],
            }),
        })
    })

    await context.route('**/api/script-editor/scripts', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ drafts: [] }),
        })
    })

    await context.route('**/api/trading/deployments', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ deployments: [] }),
        })
    })

    await signInWithDevBypass(page)

    await page.goto('/active-trader')
    await expect(page.getByRole('button', { name: /connect schwab portal/i })).toBeVisible()

    const popupPromise = page.waitForEvent('popup')
    await page.getByRole('button', { name: /connect schwab portal/i }).click()
    const popup = await popupPromise

    await popup.waitForURL(/\/schwab\/connect/)
    await expect(popup.getByRole('heading', { name: /redirecting to schwab/i })).toBeVisible()

    await popup.addInitScript(() => {
        Object.defineProperty(window, 'opener', {
            value: null,
            configurable: true,
        })
    })

    await popup.goto('/schwab/callback?code=demo-auth-code&state=popup-state-123')

    await expect.poll(async () => popup.isClosed(), { timeout: 5_000 }).toBe(true)
    await expect(page.getByRole('button', { name: /connect schwab portal/i })).toHaveCount(0)
    await expect(page).not.toHaveURL(/schwab=connected/)
})
