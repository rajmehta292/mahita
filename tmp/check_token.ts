import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkToken() {
    const users = await prisma.user.findMany({
        where: { schwabConfig: { isNot: null } },
        include: { schwabConfig: true }
    });

    if (users.length === 0) {
        console.log('No users with config found.');
        return;
    }

    const user = users[0];
    const token = user.schwabConfig?.accessToken;

    if (!token) {
        console.log('No access token found for user.');
        return;
    }

    console.log('Token starts with:', token.substring(0, 20) + '...');

    try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
            const payloadString = Buffer.from(payloadBase64, 'base64').toString('ascii');
            const payload = JSON.parse(payloadString);
            console.log('\n--- Decoded Token Payload ---');
            console.log(JSON.stringify(payload, null, 2));
            console.log('\nScopes present:', payload.scp || payload.scope || 'None');
        } else {
            console.log('Token is not a standard JWT.');
        }
    } catch (e: any) {
        console.log('Failed to decode token:', e.message);
    }

    await prisma.$disconnect();
}

checkToken();
