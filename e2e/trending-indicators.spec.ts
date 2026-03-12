import { test, expect } from '@playwright/test'

test('trending indicators redirects unauthenticated users into the sign-in flow', async ({ page }) => {
    await page.goto('/trending-indicators')
    await page.waitForURL(/\/auth\/signin/)
    await expect(page.getByText(/MAHITA TERMINAL/i)).toBeVisible()
    await expect(page.getByText(/google sign-in runs on the production domain/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in with dev bypass/i })).toBeVisible()
})
