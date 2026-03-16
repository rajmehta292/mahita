import { expect, test } from '@playwright/test'
import { signInWithDevBypass } from '@/e2e/support/session'

test('authenticated user can reach main screens and log out cleanly', async ({ page }) => {
    await signInWithDevBypass(page, '/dashboard')

    await expect(page.getByRole('link', { name: 'Portfolio' })).toBeVisible()

    await page.getByRole('link', { name: 'Portfolio' }).click()
    await page.waitForURL(/\/portfolio/)
    await expect(page.getByRole('heading', { name: /connect schwab account/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /connect schwab portal/i })).toBeVisible()

    await page.getByRole('link', { name: 'Active Trader' }).click()
    await page.waitForURL(/\/active-trader/)
    await expect(page.getByRole('button', { name: /connect schwab portal/i })).toBeVisible()

    await page.getByRole('link', { name: 'Trade History' }).click()
    await page.waitForURL(/\/history/)
    await expect(page.locator('main')).toContainText(/trade history|connect schwab account/i)

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
