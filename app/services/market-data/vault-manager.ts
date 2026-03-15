import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs'
import { execSync } from 'child_process'
import prisma from '@/lib/prisma'

const VAULTS_DIR = path.join(process.cwd(), 'data', 'vaults')

export interface VaultInfo {
    id: string
    name: string
    type: string
    dbPath: string
}

class VaultManager {
    private clients: Map<string, PrismaClient> = new Map()
    private clientInit: Map<string, Promise<void>> = new Map()

    constructor() {
        if (!fs.existsSync(VAULTS_DIR)) {
            fs.mkdirSync(VAULTS_DIR, { recursive: true })
        }
    }

    /**
     * Get a Prisma client for a specific vault.
     * Initializes the DB if it doesn't exist.
     */
    async getClient(vaultName: string): Promise<PrismaClient> {
        let vault = await prisma.vault.findUnique({
            where: { name: vaultName }
        })

        if (!vault) {
            await this.seedVaults()
            vault = await prisma.vault.findUnique({
                where: { name: vaultName }
            })
        }

        if (!vault) {
            throw new Error(`Vault "${vaultName}" not found in registry.`)
        }

        if (this.clients.has(vault.id)) {
            const client = this.clients.get(vault.id)!
            const init = this.clientInit.get(vault.id)
            if (init) {
                await init
            }
            return client
        }

        const dbFile = vault.dbPath || path.join(VAULTS_DIR, `${vault.name}.db`)
        const fullPath = path.isAbsolute(dbFile) ? dbFile : path.join(process.cwd(), dbFile)

        // Ensure directory exists
        const dir = path.dirname(fullPath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        // Initialize/Sync schema if file is new
        if (!fs.existsSync(fullPath)) {
            console.log(`[VaultManager] Initializing new database for vault: ${vault.name}`)
            this.syncSchema(fullPath)
        }

        const client = new PrismaClient({
            datasources: {
                db: {
                    url: `file:${fullPath}`
                }
            }
        })

        this.clients.set(vault.id, client)
        const init = this.initializeClient(client)
        this.clientInit.set(vault.id, init)
        await init
        return client
    }

    private async initializeClient(client: PrismaClient) {
        await client.$connect()
        await client.$queryRawUnsafe("PRAGMA journal_mode=WAL;")
        await client.$queryRawUnsafe("PRAGMA synchronous=NORMAL;")
        await client.$queryRawUnsafe("PRAGMA busy_timeout=10000;")
        await client.$queryRawUnsafe("PRAGMA temp_store=MEMORY;")
        await client.$queryRawUnsafe("PRAGMA foreign_keys=ON;")
    }

    /**
     * Seeds the initial vaults into the registry if they don't exist.
     */
    async seedVaults() {
        const defaultVaults = [
            { name: 'schwab', type: 'provider' },
            { name: 'yahoo', type: 'provider' },
            { name: 'google', type: 'provider' },
            { name: 'ollama', type: 'ai' },
            { name: 'csv', type: 'manual' },
            { name: 'master', type: 'master' }
        ]

        for (const v of defaultVaults) {
            await prisma.vault.upsert({
                where: { name: v.name },
                update: {},
                create: {
                    name: v.name,
                    type: v.type,
                    dbPath: `data/vaults/${v.name}.db`
                }
            })
        }
    }

    /**
     * Syncs the current Prisma schema to a specific SQLite file.
     * Uses prisma db push for simplicity.
     */
    private syncSchema(dbPath: string) {
        try {
            // Environment variable override for the push command
            const env = {
                ...process.env,
                DATABASE_URL: `file:${dbPath}`,
                PRISMA_SKIP_POSTINSTALL_GENERATE: 'true'
            }

            execSync('npx prisma db push --skip-generate', { env, stdio: 'inherit' })
        } catch (error) {
            console.error(`[VaultManager] Failed to sync schema for ${dbPath}:`, error)
            throw error
        }
    }

    async closeAll() {
        for (const client of this.clients.values()) {
            await client.$disconnect()
        }
        this.clients.clear()
        this.clientInit.clear()
    }
}

export function isVaultBusyError(error: unknown) {
    if (!(error instanceof Error)) {
        return false
    }

    const message = error.message
    return (
        message.includes("Socket timeout") ||
        message.includes("database is locked") ||
        message.includes("SQLITE_BUSY")
    )
}

export async function withVaultQueryRetry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
    let lastError: unknown

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await operation()
        } catch (error) {
            lastError = error
            if (!isVaultBusyError(error) || attempt === attempts) {
                throw error
            }

            await new Promise((resolve) => setTimeout(resolve, 150 * attempt))
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Vault query retry failed")
}

// Singleton instance
declare global {
    var __mahitaVaultManager: VaultManager | undefined
}

export const vaultManager = globalThis.__mahitaVaultManager ?? new VaultManager()

if (process.env.NODE_ENV !== 'production') {
    globalThis.__mahitaVaultManager = vaultManager
}
