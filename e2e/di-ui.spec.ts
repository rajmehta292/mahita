import { expect, test } from '@playwright/test'
import { installDiUiFixtures } from '@/e2e/support/runtime-fixtures'
import { signInWithDevBypass } from '@/e2e/support/session'

test('superuser can use DI-UI sections and start the stage 2 scheduler', async ({ page }) => {
  await installDiUiFixtures(page.context())
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
  await expect(page.getByText(/^Running$/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/running cycle/i)).toBeVisible({ timeout: 20_000 })

  await page.getByRole('button', { name: /^Stop$/i }).click()
  await expect(page.getByText(/^Stopped$/i)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/^idle$/i)).toBeVisible({ timeout: 20_000 })
})
