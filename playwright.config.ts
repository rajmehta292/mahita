import { defineConfig } from '@playwright/test'

function withEnv(
    vars: Record<string, string>,
    command: string
) {
    if (process.platform === 'win32') {
        const assignments = Object.entries(vars)
            .map(([key, value]) => `set "${key}=${value}"`)
            .join(' && ')
        return `${assignments} && ${command}`
    }

    const assignments = Object.entries(vars)
        .map(([key, value]) => `${key}=${value}`)
        .join(' ')
    return `${assignments} ${command}`
}

const playwrightEnv = {
    DATABASE_URL: 'file:./demo.db',
    NEXT_DIST_DIR: '.next-playwright',
}

const playwrightRuntimeEnv = {
    ...playwrightEnv,
    ENABLE_DEV_AUTH_BYPASS: 'true',
    ADMIN_EMAILS: 'dev@mahita.ai',
    MAHITA_SECRET_KEY: 'mahita-playwright-secret-key',
    NEXTAUTH_URL: 'http://localhost:6245',
}

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:6245',
        trace: 'on-first-retry'
    },
    webServer: {
        command: [
            `node -e "const fs=require('fs'); try { fs.rmSync('.next-playwright', { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (error) { if (error?.code !== 'ENOENT') throw error; }"`,
            withEnv(playwrightEnv, 'npx prisma db push --skip-generate'),
            withEnv(playwrightEnv, 'npx next build'),
            withEnv(playwrightRuntimeEnv, 'npx next start -p 6245'),
        ].join(' && '),
        url: 'http://localhost:6245/auth/signin',
        reuseExistingServer: false,
        timeout: 600_000,
    },
})
