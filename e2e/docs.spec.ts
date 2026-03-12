import { expect, test } from '@playwright/test'

test('documentation home is visible signed-out and internal docs stay gated', async ({ page }) => {
    await page.goto('/docs')

    await expect(page.getByText(/Mahita documentation, evidence, and senior project guidebook/i)).toBeVisible()
    await expect(page.getByRole('link', { name: /How To Use This Documentation/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Executive Overview/i }).first()).toBeVisible()
    await expect(page.getByRole('link', { name: /Senior Project Report Draft/i }).first()).toBeVisible()

    await page.goto('/docs/guidebook/documentation-maintenance')
    await expect(page.getByText(/Sign in to view internal documentation/i)).toBeVisible()
})
