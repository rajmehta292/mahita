import { expect, test } from '@playwright/test'

async function signInWithDevBypass(page: import('@playwright/test').Page) {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })
}

test('signed-in user can save Schwab credentials and a superuser can load admin tabs', async ({ page }) => {
    await signInWithDevBypass(page)

    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible()

    await page.getByPlaceholder(/client id/i).fill('playwright-client-id')
    await page.getByPlaceholder(/client secret/i).fill('playwright-client-secret')
    await page.getByRole('button', { name: /save credentials|update credentials/i }).click()
    await expect(page.getByText(/saved successfully/i)).toBeVisible()

    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: /admin control/i })).toBeVisible()

    await page.getByRole('button', { name: /provider pool/i }).click()
    await expect(page.getByText(/promote provider/i)).toBeVisible()

    await page.getByRole('button', { name: /data command/i }).click()
    await expect(page.getByText(/operator actions/i)).toBeVisible()

    await page.getByRole('button', { name: /users/i }).click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    await page.getByRole('button', { name: /audit log/i }).click()
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()
})
