import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:6245',
        trace: 'on-first-retry'
    },
    webServer: {
        command: 'npx next build && ENABLE_DEV_AUTH_BYPASS=true ADMIN_EMAILS=dev@mahita.ai MAHITA_SECRET_KEY=mahita-playwright-secret-key NEXTAUTH_URL=http://localhost:6245 npx next start -p 6245',
        url: 'http://localhost:6245/auth/signin',
        reuseExistingServer: false,
        timeout: 120_000,
    },
})
