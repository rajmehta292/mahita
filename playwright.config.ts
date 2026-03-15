import { defineConfig } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 30_000,
    use: {
        baseURL: 'http://localhost:6245',
        trace: 'on-first-retry'
    },
    webServer: {
        command: `node -e "const fs=require('fs'); try { fs.rmSync('.next-playwright', { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch (error) { if (error?.code !== 'ENOENT') throw error; }" && DATABASE_URL=file:./demo.db NEXT_DIST_DIR=.next-playwright npx prisma db push --skip-generate && DATABASE_URL=file:./demo.db NEXT_DIST_DIR=.next-playwright npx next build && DATABASE_URL=file:./demo.db NEXT_DIST_DIR=.next-playwright ENABLE_DEV_AUTH_BYPASS=true ADMIN_EMAILS=dev@mahita.ai MAHITA_SECRET_KEY=mahita-playwright-secret-key NEXTAUTH_URL=http://localhost:6245 npx next start -p 6245`,
        url: 'http://localhost:6245/auth/signin',
        reuseExistingServer: false,
        timeout: 600_000,
    },
})
