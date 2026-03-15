import fs from 'fs';
import path from 'path';

function loadLocalEnv() {
    const candidates = ['.env.local', '.env.demo.example', '.env'];

    for (const file of candidates) {
        const fullPath = path.join(process.cwd(), file);
        if (!fs.existsSync(fullPath)) continue;

        const content = fs.readFileSync(fullPath, 'utf8');
        for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const separator = trimmed.indexOf('=');
            if (separator === -1) continue;

            const key = trimmed.slice(0, separator).trim();
            const rawValue = trimmed.slice(separator + 1).trim();
            const value = rawValue.replace(/^['"]|['"]$/g, '');

            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }

        return;
    }
}

async function main() {
    loadLocalEnv();
    const { vaultManager } = await import('../app/services/market-data/vault-manager');
    const { default: prisma } = await import('../lib/prisma');
    console.log('Seeding vaults...');
    try {
        await vaultManager.seedVaults();
        console.log('Vaults seeded successfully.');

        const vaults = await prisma.vault.findMany();
        console.log('Registered Vaults:', vaults);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
