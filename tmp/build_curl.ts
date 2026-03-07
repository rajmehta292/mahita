import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function runOptions() {
    const user = await prisma.user.findFirst({
        where: { schwabConfig: { isNot: null } },
        include: { schwabConfig: true }
    });

    if (user?.schwabConfig?.accessToken) {
        const token = user.schwabConfig.accessToken;
        console.log(`curl -v -H "Authorization: Bearer ${token}" -H "Accept: application/json" -H "Content-Type: application/json" -H "Accept-Encoding: gzip, deflate, br" -H "User-Agent: curl/8.4" https://api-ext.schwab.com/trader/v1/accounts/accountNumbers`);
    }
    await prisma.$disconnect();
}

runOptions();
