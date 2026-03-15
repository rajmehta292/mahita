import { expect, test } from '@playwright/test'

async function signInWithDevBypass(page: import('@playwright/test').Page) {
  await page.goto('/auth/signin')
  await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
  await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
    timeout: 15_000,
  })
}

test('superuser can use DI-UI sections and start the stage 2 scheduler', async ({ page }) => {
  await signInWithDevBypass(page)

  await page.goto('/admin?tab=di-ui')
  await expect(page.getByRole('heading', { name: /admin control/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'DI-UI' })).toBeVisible()

  await expect(page.getByRole('heading', { name: /live scheduler policy/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Caller$/i }).click()
  await expect(page.getByRole('heading', { name: /live request stream/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Processor$/i }).click()
  await expect(page.getByRole('heading', { name: /processor timeline/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Verification$/i }).click()
  await expect(page.getByRole('heading', { name: /verification controls/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Storage$/i }).click()
  await expect(page.getByRole('heading', { name: /vault browser/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Scheduler$/i }).click()
  await expect(page.getByRole('heading', { name: /live scheduler policy/i })).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Start$/i }).click()
  await expect(page.getByText(/running cycle|sleeping \d+s before next cycle/i)).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Stop$/i }).click()
  await expect(page.getByText(/^idle$/i)).toBeVisible({ timeout: 20_000 })
})
