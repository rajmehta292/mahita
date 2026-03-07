import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst({
    where: { schwabConfig: { isNot: null } },
    include: { schwabConfig: true }
  });

  if (user?.schwabConfig?.accessToken) {
    const token = user.schwabConfig.accessToken;
    console.log("Testing with ONLY Authorization header...");

    try {
      const response = await fetch("https://api.schwabapi.com/trader/v1/accounts", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        }
      });
      console.log(`Status: ${response.status}`);
      const text = await response.text();
      console.log(`Body: ${text}`);
    } catch (e) {
      console.error(e);
    }
  }
  await prisma.$disconnect();
}
run();
