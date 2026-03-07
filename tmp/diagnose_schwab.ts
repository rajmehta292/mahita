import { getSchwabClient } from '../app/services/schwab/client';
import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.join(__dirname, '../.env') });

const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- Schwab API Diagnostics ---');
    console.log('USE_MOCK_DATA:', process.env.USE_MOCK_DATA);

    console.log('--- Finding users with Schwab configurations ---');
    const usersWithConfig = await prisma.user.findMany({
        where: { schwabConfig: { isNot: null } },
        include: { schwabConfig: true }
    });

    if (usersWithConfig.length === 0) {
        console.error('Error: No users found with a Schwab configuration.');
        return;
    }

    const user = usersWithConfig[0];
    console.log('Testing with user:', user.email);

    if (!user.schwabConfig) return;

    const config: any = user.schwabConfig;
    const clientId = config.clientId;
    const clientSecret = config.clientSecret;
    const accessToken = config.accessToken;
    const refreshToken = config.refreshToken;
    const callbackUrl = 'https://mahita.ai/schwab/callback';

    console.log('Config Found:');
    console.log('- Client ID:', clientId);
    console.log('- Access Token:', accessToken ? 'Present' : 'MISSING');

    if (!accessToken) {
        console.error('Error: Access token is missing.');
        return;
    }

    const client = getSchwabClient({
        clientId,
        clientSecret: clientSecret || undefined,
        callbackUrl
    });

    client.setAccessToken(accessToken, refreshToken || '');

    console.log('\n--- Testing Market Data Fetch (Quotes) ---');
    try {
        const responseQuote = await client.getQuote('AAPL');
        console.log('Success! AAPL Quote:', Object.keys(responseQuote.data || {}));
    } catch (err: any) {
        console.error('Quote Call Failed:', err.message);
        if (err.response) {
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        }
    }

    console.log('\n--- Testing User Preference Fetch ---');
    try {
        const clientAny = client as any;
        const responsePref = await clientAny.request(`${clientAny.traderUrl}/userPreference`);
        console.log('Success! User Preferences:', JSON.stringify(responsePref.data, null, 2));
    } catch (err: any) {
        console.error('User Preference Call Failed:', err.message);
        if (err.response) {
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        }
    }

    console.log('\n--- Testing Account Numbers Fetch ---');
    try {
        const clientAny = client as any;
        const responseNumbers = await clientAny.request(`${clientAny.traderUrl}/accounts/accountNumbers`);
        console.log('Success! Found account hashes:', JSON.stringify(responseNumbers.data, null, 2));
    } catch (err: any) {
        console.error('Account Numbers Call Failed:', err.message);
        if (err.response) {
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        }
    }

    console.log('\n--- Testing Account Fetch ---');
    try {
        const response = await client.getAccounts();
        console.log('Success! Found accounts:', response.data.length);
        if (response.data.length > 0) {
            const firstAcc = response.data[0].securitiesAccount;
            const targetId = firstAcc.hashValue || firstAcc.accountId;
            console.log('Using Target ID:', targetId);

            console.log(`\n--- Testing Positions Fetch for ${targetId} ---`);
            const positions = await client.getPositions(targetId);
            console.log('Success! Positions found:', positions.length);
        }
    } catch (err: any) {
        console.error('API Call Failed:', err.message);
        if (err.response) {
            console.error('Status:', err.response.status);
            console.error('Data:', JSON.stringify(err.response.data, null, 2));
        }
    }

    await prisma.$disconnect();
}

diagnose();
