import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: true,
      accounts: {
        select: {
          id: true,
          provider: true,
        },
      },
      preferences: {
        select: {
          id: true,
        },
      },
      brokerageConnections: {
        select: {
          id: true,
          status: true,
        },
      },
    },
    orderBy: {
      email: "asc",
    },
  })

  const collisions = users.filter((user) => {
    const email = user.email?.trim().toLowerCase()
    if (!email) {
      return false
    }

    return user.accounts.length === 0
  })

  console.log(JSON.stringify({
    checkedAt: new Date().toISOString(),
    totalUsers: users.length,
    potentialAuthCollisions: collisions.map((user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      accountProviders: user.accounts.map((account) => account.provider),
      hasPreferences: Boolean(user.preferences),
      brokerageConnectionCount: user.brokerageConnections.length,
      brokerageStatuses: user.brokerageConnections.map((connection) => connection.status),
    })),
  }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
