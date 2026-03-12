import { expect, test } from '@playwright/test'

async function signInWithDevBypass(page: import('@playwright/test').Page) {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })
}

test('backtest workspace loads with a stable editor surface', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
        if (message.type() === 'error') {
            consoleErrors.push(message.text())
        }
    })

    await signInWithDevBypass(page)
    await page.goto('/backtest')

    await expect(page.getByText(/mahita engine v6/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /run strategy/i })).toBeVisible()

    const editorSurface = page.locator('[data-testid="monaco-editor"], textarea')
    await expect(editorSurface.first()).toBeVisible()

    expect(consoleErrors.some((entry) => entry.includes('Monaco initialization'))).toBeFalsy()
    expect(consoleErrors.some((entry) => entry.includes('[object Event]'))).toBeFalsy()
})
