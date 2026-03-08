
import { vaultManager } from '../app/services/market-data/vault-manager';
import prisma from '../lib/prisma';

async function main() {
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
