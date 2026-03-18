import { expect, test } from '@playwright/test'
import { signInWithDevBypass } from '@/e2e/support/session'

test('signed-in user can save Schwab credentials and a superuser can load admin tabs', async ({ page }) => {
    await signInWithDevBypass(page, '/dashboard', { email: 'raj.dmehta292@gmail.com' })

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

    await page.getByRole('button', { name: /di-ui/i }).click()
    await expect(page.getByRole('heading', { name: 'DI-UI' })).toBeVisible()

    await page.getByRole('button', { name: /users/i }).click()
    await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible()

    await page.getByRole('button', { name: /audit log/i }).click()
    await expect(page.getByRole('heading', { name: 'Audit Log' })).toBeVisible()
})
