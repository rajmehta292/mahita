import { expect, test } from '@playwright/test'

test('authenticated user can reach main screens and log out cleanly', async ({ page }) => {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })

    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible()

    await page.getByRole('link', { name: 'Portfolio' }).click()
    await page.waitForURL(/\/portfolio/)
    await expect(page.getByRole('heading', { name: /asset distribution/i })).toBeVisible()

    await page.getByRole('link', { name: 'Active Trader' }).click()
    await page.waitForURL(/\/active-trader/)
    await expect(page.getByRole('heading', { name: /active trader/i })).toBeVisible()

    await page.getByRole('link', { name: 'Trade History' }).click()
    await page.waitForURL(/\/history/)
    await expect(page.getByRole('heading', { name: /trade history/i })).toBeVisible()

    await page.getByRole('link', { name: 'Backtester' }).click()
    await page.waitForURL(/\/backtest/)
    await expect(page.getByRole('button', { name: /run strategy/i })).toBeVisible()

    await page.getByRole('link', { name: 'Settings' }).click()
    await page.waitForURL(/\/settings/)
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    await page.getByRole('button', { name: /dev@mahita.ai|account/i }).click()
    await page.getByRole('button', { name: /log out/i }).click()
    await page.waitForURL(/\/$/)
    await expect(page.getByText(/strategy intelligence for live traders/i)).toBeVisible()
})
