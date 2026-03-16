import type { Page } from '@playwright/test'

export async function signInWithDevBypass(page: Page, destination = '/dashboard') {
    await page.goto('/auth/signin')
    await page.getByRole('button', { name: /sign in with dev bypass/i }).click()
    await page.waitForURL((url) => !/\/auth\/(signin|post-signin)/.test(url.pathname), {
        timeout: 15_000,
    })

    if (!page.url().includes(destination)) {
        await page.goto(destination)
    }
}
