import { PrismaClient, UserRole } from "@prisma/client"

const prisma = new PrismaClient()

const demoUsers = [
  {
    email: "owner.demo@mahita.ai",
    name: "Mahita Demo Owner",
    role: UserRole.SUPERUSER,
    lastVisitedPath: "/dashboard",
    selectedAccountId: "demo-ira-251",
  },
  {
    email: "demo.user@mahita.ai",
    name: "Demo User",
    role: UserRole.USER,
    lastVisitedPath: "/portfolio",
    selectedAccountId: "demo-brokerage-998",
  },
  {
    email: "reviewer@mahita.ai",
    name: "Project Reviewer",
    role: UserRole.USER,
    lastVisitedPath: "/docs",
    selectedAccountId: "demo-brokerage-998",
  },
]

const demoAccounts = [
  {
    providerAccountId: "demo-ira-251",
    accountHash: "demo-hash-251",
    accountNumber: "251251251",
    accountType: "IRA",
    displayName: "Roth Contributory IRA",
  },
  {
    providerAccountId: "demo-brokerage-998",
    accountHash: "demo-hash-998",
    accountNumber: "998998998",
    accountType: "Brokerage",
    displayName: "Individual Brokerage",
  },
]

const demoStrategies = [
  {
    name: "Prototype EMA Crossover",
    description: "Presentation-safe strategy example reflecting the prototype backtesting engine.",
    asset: "AAPL",
    timeframe: "1d",
    astJson: JSON.stringify({ type: "demo", strategy: "ema-crossover" }),
    riskManagement: JSON.stringify({ stopLossPct: 4, takeProfitPct: 8 }),
  },
  {
    name: "Trending Indicator Watch",
    description: "Internal watch strategy used to demonstrate the monitoring workflow.",
    asset: "NVDA",
    timeframe: "1h",
    astJson: JSON.stringify({ type: "demo", strategy: "trend-watch" }),
    riskManagement: JSON.stringify({ stopLossPct: 3, takeProfitPct: 6 }),
  },
]

async function upsertUser(userConfig) {
  const user = await prisma.user.upsert({
    where: { email: userConfig.email },
    update: {
      name: userConfig.name,
      role: userConfig.role,
    },
    create: {
      email: userConfig.email,
      name: userConfig.name,
      role: userConfig.role,
    },
  })

  await prisma.userPreference.upsert({
    where: { userId: user.id },
    update: {
      selectedAccountId: userConfig.selectedAccountId,
      lastVisitedPath: userConfig.lastVisitedPath,
      lastVisitedAt: new Date(),
      lastSignInAt: new Date(),
      previousSignInAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      trendingStrategyIds: JSON.stringify(["prototype-ema", "trend-watch"]),
      watchlistSymbols: JSON.stringify(["AAPL", "NVDA", "MSFT", "ISRG", "MTN"]),
    },
    create: {
      userId: user.id,
      selectedAccountId: userConfig.selectedAccountId,
      lastVisitedPath: userConfig.lastVisitedPath,
      lastVisitedAt: new Date(),
      lastSignInAt: new Date(),
      previousSignInAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
      trendingStrategyIds: JSON.stringify(["prototype-ema", "trend-watch"]),
      watchlistSymbols: JSON.stringify(["AAPL", "NVDA", "MSFT", "ISRG", "MTN"]),
    },
  })

  await prisma.investorProfile.upsert({
    where: { userId: user.id },
    update: {
      lifeStage: "Early career investor",
      timeHorizon: "Long term",
      riskTolerance: "Moderate",
      objective: "Demonstrate account-aware research and live-testing flows",
      alphaPromptsEnabled: true,
    },
    create: {
      userId: user.id,
      lifeStage: "Early career investor",
      timeHorizon: "Long term",
      riskTolerance: "Moderate",
      objective: "Demonstrate account-aware research and live-testing flows",
      alphaPromptsEnabled: true,
    },
  })

  const schwabConfig = await prisma.schwabConfig.upsert({
    where: { userId: user.id },
    update: {
      clientId: `demo-client-${user.id}`,
      clientSecret: `demo-secret-${user.id}`,
      accessToken: `demo-access-${user.id}`,
      refreshToken: `demo-refresh-${user.id}`,
      accessTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 8),
      refreshTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
    create: {
      userId: user.id,
      clientId: `demo-client-${user.id}`,
      clientSecret: `demo-secret-${user.id}`,
      accessToken: `demo-access-${user.id}`,
      refreshToken: `demo-refresh-${user.id}`,
      accessTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 8),
      refreshTokenExpiry: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  })

  const connection = await prisma.brokerageConnection.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "SCHWAB",
      },
    },
    update: {
      label: "Demo Schwab",
      status: "AUTHORIZED",
      linkedSchwabConfigId: schwabConfig.id,
      isPrimary: true,
      lastError: null,
    },
    create: {
      userId: user.id,
      provider: "SCHWAB",
      label: "Demo Schwab",
      status: "AUTHORIZED",
      linkedSchwabConfigId: schwabConfig.id,
      isPrimary: true,
    },
  })

  for (const account of demoAccounts) {
    await prisma.brokerageAccount.upsert({
      where: {
        brokerageConnectionId_providerAccountId: {
          brokerageConnectionId: connection.id,
          providerAccountId: account.providerAccountId,
        },
      },
      update: {
        accountHash: account.accountHash,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        displayName: account.displayName,
        isActive: true,
        rawSnapshot: JSON.stringify({
          displayName: account.displayName,
          type: account.accountType,
          seededBy: "bootstrap-demo",
        }),
        lastSyncedAt: new Date(),
      },
      create: {
        brokerageConnectionId: connection.id,
        providerAccountId: account.providerAccountId,
        accountHash: account.accountHash,
        accountNumber: account.accountNumber,
        accountType: account.accountType,
        displayName: account.displayName,
        isActive: true,
        rawSnapshot: JSON.stringify({
          displayName: account.displayName,
          type: account.accountType,
          seededBy: "bootstrap-demo",
        }),
        lastSyncedAt: new Date(),
      },
    })
  }

  for (const strategy of demoStrategies) {
    await prisma.strategy.upsert({
      where: {
        id: `${user.id}-${strategy.name.toLowerCase().replace(/\s+/g, "-")}`,
      },
      update: {
        name: strategy.name,
        description: strategy.description,
        asset: strategy.asset,
        timeframe: strategy.timeframe,
        astJson: strategy.astJson,
        riskManagement: strategy.riskManagement,
      },
      create: {
        id: `${user.id}-${strategy.name.toLowerCase().replace(/\s+/g, "-")}`,
        userId: user.id,
        name: strategy.name,
        description: strategy.description,
        asset: strategy.asset,
        timeframe: strategy.timeframe,
        astJson: strategy.astJson,
        riskManagement: strategy.riskManagement,
      },
    })
  }

  return { user, connection, schwabConfig }
}

async function main() {
  for (const userConfig of demoUsers) {
    await upsertUser(userConfig)
  }

  const superuser = await prisma.user.findUnique({
    where: { email: "owner.demo@mahita.ai" },
    include: {
      schwabConfig: true,
    },
  })

  if (superuser?.schwabConfig) {
    const credential = await prisma.providerCredential.upsert({
      where: { linkedSchwabConfigId: superuser.schwabConfig.id },
      update: {
        provider: "schwab",
        label: "Raj Schwab market-data bridge",
        sourceType: "USER_SCHWAB_CONFIG",
        createdByUserId: superuser.id,
        clientId: superuser.schwabConfig.clientId,
        clientSecret: superuser.schwabConfig.clientSecret,
        accessToken: superuser.schwabConfig.accessToken,
        refreshToken: superuser.schwabConfig.refreshToken,
        accessTokenExpiry: superuser.schwabConfig.accessTokenExpiry,
        refreshTokenExpiry: superuser.schwabConfig.refreshTokenExpiry,
        isEnabled: true,
        notes: "Presentation-safe demo bridge for market data.",
      },
      create: {
        provider: "schwab",
        label: "Raj Schwab market-data bridge",
        sourceType: "USER_SCHWAB_CONFIG",
        createdByUserId: superuser.id,
        linkedSchwabConfigId: superuser.schwabConfig.id,
        clientId: superuser.schwabConfig.clientId,
        clientSecret: superuser.schwabConfig.clientSecret,
        accessToken: superuser.schwabConfig.accessToken,
        refreshToken: superuser.schwabConfig.refreshToken,
        accessTokenExpiry: superuser.schwabConfig.accessTokenExpiry,
        refreshTokenExpiry: superuser.schwabConfig.refreshTokenExpiry,
        isEnabled: true,
        notes: "Presentation-safe demo bridge for market data.",
      },
    })

    await prisma.providerPoolMember.upsert({
      where: {
        providerCredentialId_purpose: {
          providerCredentialId: credential.id,
          purpose: "MARKET_DATA",
        },
      },
      update: {
        label: "Demo primary market-data pool member",
        status: "ACTIVE",
        isPrimary: true,
        priority: 1,
        weight: 1,
      },
      create: {
        providerCredentialId: credential.id,
        purpose: "MARKET_DATA",
        label: "Demo primary market-data pool member",
        status: "ACTIVE",
        isPrimary: true,
        priority: 1,
        weight: 1,
      },
    })
  }

  await prisma.adminAuditEvent.create({
    data: {
      actorUserId: superuser?.id ?? (await prisma.user.findFirst()).id,
      action: "demo_seed_completed",
      reason: "Presentation-safe bootstrap dataset created.",
      metadata: JSON.stringify({
        seededUsers: demoUsers.map((user) => user.email),
      }),
    },
  })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
