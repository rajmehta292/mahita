import { expect, test } from '@playwright/test'
import { installScreenerFixtures } from '@/e2e/support/runtime-fixtures'
import { signInWithDevBypass } from '@/e2e/support/session'

test('screener workspace loads and global search routes to chart results', async ({ page }) => {
    await installScreenerFixtures(page.context())
    await signInWithDevBypass(page)

    await page.goto('/screener')
    await expect(page.getByRole('button', { name: /filters/i })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible()
    await expect(page.getByText(/matches/i)).toBeVisible({ timeout: 30_000 })

    await page.locator('tbody tr').first().getByRole('link').first().click()
    await page.waitForURL(/\/chart\?symbol=.*&timeframe=1d/)
    await page.goBack()
    await expect(page.getByText(/matches/i)).toBeVisible({ timeout: 30_000 })

    await page.locator('select').first().selectOption({ label: 'Dow 30' })
    await expect(page.getByText(/matches/i)).toBeVisible({ timeout: 30_000 })

    const filterSearch = page.getByPlaceholder('Search filters...')
    if (!(await filterSearch.isVisible().catch(() => false))) {
        await page.getByRole('button', { name: /filters/i }).click()
    }
    await expect(filterSearch).toBeVisible()

    await page.getByRole('button', { name: /search symbols, presets, strategies, docs/i }).click()
    await expect(page.getByRole('dialog', { name: /global search/i })).toBeVisible()
    await page.getByPlaceholder(/search instruments, screener presets, strategies, docs/i).fill('AAPL')

    await expect(page.getByText('Instruments')).toBeVisible({ timeout: 30_000 })
    const instrumentGroup = page.locator('div').filter({ has: page.getByText('Instruments') }).first()
    await expect(page.getByText('AAPL').first()).toBeVisible({ timeout: 30_000 })
    await instrumentGroup.getByText('AAPL').first().click()
    await page.waitForURL(/\/chart\?symbol=AAPL&timeframe=1d/)

    await expect(page.locator('select').first()).toHaveValue('AAPL')

    await page.getByRole('button', { name: /search symbols, presets, strategies, docs/i }).click()
    await expect(page.getByRole('dialog', { name: /global search/i })).toBeVisible()
    await page.getByPlaceholder(/search instruments, screener presets, strategies, docs/i).fill('MSFT')

    await expect(page.getByText('Instruments')).toBeVisible({ timeout: 30_000 })
    const chartInstrumentGroup = page.locator('div').filter({ has: page.getByText('Instruments') }).first()
    await expect(page.getByText('MSFT').first()).toBeVisible({ timeout: 30_000 })
    await chartInstrumentGroup.getByText('MSFT').first().click()
    await page.waitForURL(/\/chart\?symbol=MSFT&timeframe=1d/)
    await expect(page.locator('select').first()).toHaveValue('MSFT')
})
