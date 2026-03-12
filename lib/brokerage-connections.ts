import type {
  BrokerageConnection,
  BrokerageConnectionStatus,
  Prisma,
  SchwabConfig,
} from "@prisma/client"
import { randomUUID } from "crypto"
import prisma from "@/lib/prisma"
import { AppError } from "@/lib/app-errors"
import { assertRequiredRuntimeModels } from "@/lib/runtime-health"
import { encryptSchwabSecrets, resolveSchwabConfig } from "@/lib/schwab-config"

const BROKERAGE_CONNECTION_INCLUDE = {
  linkedSchwabConfig: true,
  accounts: {
    where: { isActive: true },
    orderBy: [{ updatedAt: "desc" }],
  },
} satisfies Prisma.BrokerageConnectionInclude

const PENDING_AUTH_WINDOW_MS = 15 * 60 * 1000

export type BrokerageConnectionRecord = Prisma.BrokerageConnectionGetPayload<{
  include: typeof BROKERAGE_CONNECTION_INCLUDE
}>

interface SchwabAccountShape {
  securitiesAccount?: {
    accountId?: string
    accountNumber?: string
    hashValue?: string
    type?: string
  }
}

function deriveSchwabConnectionStatus(
  config: Pick<SchwabConfig, "clientId" | "clientSecret" | "accessToken" | "refreshToken">
): BrokerageConnectionStatus {
  if (config.accessToken && config.refreshToken) {
    return "AUTHORIZED"
  }

  if (config.clientId && config.clientSecret) {
    return "CONFIGURED"
  }

  return "DISCONNECTED"
}

function buildBrokerageDisplayName(account: SchwabAccountShape["securitiesAccount"]) {
  const accountId = account?.accountId || account?.accountNumber || "Unknown"
  const suffix = accountId.slice(-4)
  const type = account?.type || "Brokerage"
  return `...${suffix} (${type})`
}

export function buildBrokerageConnectionSyncUpdate(
  config: Pick<
    SchwabConfig,
    "id" | "clientId" | "clientSecret" | "accessToken" | "refreshToken"
  >
) {
  return {
    label: "Schwab",
    status: deriveSchwabConnectionStatus(config),
    linkedSchwabConfigId: config.id,
    isPrimary: true,
    // Preserve pending OAuth state until it is explicitly validated or completed.
    lastError: null,
  } satisfies Prisma.BrokerageConnectionUncheckedUpdateInput
}

export function resolveBrokerageAccountSelection(
  connection: BrokerageConnectionRecord,
  requestedAccountId?: string | null
) {
  if (requestedAccountId) {
    return requestedAccountId
  }

  const first = connection.accounts[0]
  if (!first) {
    return null
  }

  return first.accountHash || first.providerAccountId
}

export async function backfillSchwabBrokerageConnections() {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const configs = await prisma.schwabConfig.findMany({
    include: {
      brokerageConnection: true,
    },
  })

  if (configs.length === 0) {
    return []
  }

  await prisma.$transaction(
    configs.map((config) =>
      prisma.brokerageConnection.upsert({
        where: {
          userId_provider: {
            userId: config.userId,
            provider: "SCHWAB",
          },
        },
        create: {
          userId: config.userId,
          provider: "SCHWAB",
          label: "Schwab",
          status: deriveSchwabConnectionStatus(config),
          linkedSchwabConfigId: config.id,
          isPrimary: true,
        },
        update: {
          label: "Schwab",
          status: deriveSchwabConnectionStatus(config),
          linkedSchwabConfigId: config.id,
          isPrimary: true,
          lastError: null,
        },
      })
    )
  )

  return prisma.brokerageConnection.findMany({
    include: BROKERAGE_CONNECTION_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  })
}

export async function ensureUserSchwabBrokerageConnection(userId: string) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const config = await prisma.schwabConfig.findUnique({
    where: { userId },
  })

  if (!config) {
    const existing = await prisma.brokerageConnection.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: "SCHWAB",
        },
      },
      include: BROKERAGE_CONNECTION_INCLUDE,
    })

    if (!existing) {
      return null
    }

    return prisma.brokerageConnection.update({
      where: { id: existing.id },
      data: {
        status: "DISCONNECTED",
        linkedSchwabConfigId: null,
        lastError: "Schwab configuration removed.",
      },
      include: BROKERAGE_CONNECTION_INCLUDE,
    })
  }

  return prisma.brokerageConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider: "SCHWAB",
      },
    },
    create: {
      userId,
      provider: "SCHWAB",
      label: "Schwab",
      status: deriveSchwabConnectionStatus(config),
      linkedSchwabConfigId: config.id,
      isPrimary: true,
    },
    update: buildBrokerageConnectionSyncUpdate(config),
    include: BROKERAGE_CONNECTION_INCLUDE,
  })
}

export async function getUserPrimaryBrokerageConnection(userId: string) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  await ensureUserSchwabBrokerageConnection(userId)

  return prisma.brokerageConnection.findFirst({
    where: {
      userId,
      isPrimary: true,
    },
    include: BROKERAGE_CONNECTION_INCLUDE,
    orderBy: [{ updatedAt: "desc" }],
  })
}

export async function requireUserSchwabBrokerageConnection(userId: string) {
  const connection = await getUserPrimaryBrokerageConnection(userId)

  if (!connection || !connection.linkedSchwabConfig) {
    throw new Error("Schwab credentials not configured")
  }

  return {
    connection,
    config: resolveSchwabConfig(connection.linkedSchwabConfig),
  }
}

export async function persistBrokerageConnectionTokens(input: {
  brokerageConnectionId: string
  accessToken: string
  refreshToken?: string | null
  accessTokenExpiry: Date
  refreshTokenExpiry?: Date | null
}) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const connection = await prisma.brokerageConnection.findUnique({
    where: { id: input.brokerageConnectionId },
    include: { linkedSchwabConfig: true },
  })

  if (!connection?.linkedSchwabConfig) {
    throw new Error("Linked Schwab configuration is missing for this brokerage connection.")
  }

  const encrypted = encryptSchwabSecrets({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
  })

  await prisma.$transaction([
    prisma.schwabConfig.update({
      where: { id: connection.linkedSchwabConfig.id },
      data: {
        accessToken: encrypted.accessToken ?? null,
        refreshToken: encrypted.refreshToken ?? null,
        accessTokenExpiry: input.accessTokenExpiry,
        refreshTokenExpiry: input.refreshTokenExpiry ?? undefined,
      },
    }),
    prisma.brokerageConnection.update({
      where: { id: connection.id },
      data: {
        status: "AUTHORIZED",
        lastError: null,
        pendingAuthState: null,
        pendingAuthStartedAt: null,
      },
    }),
  ])
}

export async function issueBrokerageAuthorizationState(brokerageConnectionId: string) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const pendingAuthState = randomUUID()
  const pendingAuthStartedAt = new Date()

  await prisma.brokerageConnection.update({
    where: { id: brokerageConnectionId },
    data: {
      pendingAuthState,
      pendingAuthStartedAt,
      lastError: null,
    },
  })

  return pendingAuthState
}

export async function validateBrokerageAuthorizationState(input: {
  brokerageConnectionId: string
  state?: string | null
}) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const connection = await prisma.brokerageConnection.findUnique({
    where: { id: input.brokerageConnectionId },
    select: {
      id: true,
      pendingAuthState: true,
      pendingAuthStartedAt: true,
    },
  })

  if (!connection) {
    throw new AppError("Mahita could not find the pending Schwab connection.", {
      code: "NOT_FOUND",
      status: 404,
    })
  }

  if (!input.state || !connection.pendingAuthState) {
    throw new AppError("Schwab authorization state is missing. Start the connection flow again.", {
      code: "BAD_REQUEST",
      status: 400,
      hint: "Return to Mahita and click Connect Schwab Portal again.",
    })
  }

  if (connection.pendingAuthState !== input.state) {
    throw new AppError("Schwab authorization state does not match the active Mahita session.", {
      code: "FORBIDDEN",
      status: 403,
      hint: "Retry the connection from the same Mahita session that opened the Schwab window.",
    })
  }

  const startedAt = connection.pendingAuthStartedAt?.getTime() ?? 0
  if (!startedAt || Date.now() - startedAt > PENDING_AUTH_WINDOW_MS) {
    await prisma.brokerageConnection.update({
      where: { id: input.brokerageConnectionId },
      data: {
        pendingAuthState: null,
        pendingAuthStartedAt: null,
        lastError: "Pending Schwab authorization expired before completion.",
      },
    })

    throw new AppError("Schwab authorization expired before Mahita could complete it.", {
      code: "BAD_REQUEST",
      status: 400,
      hint: "Start the connection flow again from Active Trader or Settings.",
    })
  }
}

export async function syncBrokerageAccountsFromSchwab(
  brokerageConnectionId: string,
  accounts: SchwabAccountShape[]
) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const now = new Date()
  const activeIds = new Set<string>()

  await prisma.$transaction(async (tx) => {
    for (const accountRecord of accounts) {
      const account = accountRecord.securitiesAccount
      const providerAccountId =
        account?.accountId || account?.accountNumber || account?.hashValue

      if (!providerAccountId) {
        continue
      }

      activeIds.add(providerAccountId)

      await tx.brokerageAccount.upsert({
        where: {
          brokerageConnectionId_providerAccountId: {
            brokerageConnectionId,
            providerAccountId,
          },
        },
        create: {
          brokerageConnectionId,
          providerAccountId,
          accountHash: account?.hashValue || null,
          accountNumber: account?.accountNumber || account?.accountId || null,
          accountType: account?.type || null,
          displayName: buildBrokerageDisplayName(account),
          isActive: true,
          rawSnapshot: JSON.stringify(accountRecord),
          lastSyncedAt: now,
        },
        update: {
          accountHash: account?.hashValue || null,
          accountNumber: account?.accountNumber || account?.accountId || null,
          accountType: account?.type || null,
          displayName: buildBrokerageDisplayName(account),
          isActive: true,
          rawSnapshot: JSON.stringify(accountRecord),
          lastSyncedAt: now,
        },
      })
    }

    await tx.brokerageConnection.update({
      where: { id: brokerageConnectionId },
      data: {
        lastSyncedAt: now,
        lastError: null,
        status: "AUTHORIZED",
      },
    })

    const storedAccounts = await tx.brokerageAccount.findMany({
      where: { brokerageConnectionId },
      select: { id: true, providerAccountId: true },
    })

    const staleIds = storedAccounts
      .filter((account) => !activeIds.has(account.providerAccountId))
      .map((account) => account.id)

    if (staleIds.length > 0) {
      await tx.brokerageAccount.updateMany({
        where: {
          id: { in: staleIds },
        },
        data: {
          isActive: false,
          lastSyncedAt: now,
        },
      })
    }
  })

  return prisma.brokerageAccount.findMany({
    where: {
      brokerageConnectionId,
      isActive: true,
    },
    orderBy: [{ updatedAt: "desc" }],
  })
}

export async function updateBrokerageConnectionStatus(
  brokerageConnectionId: string,
  status: BrokerageConnectionStatus,
  lastError?: string | null
) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  return prisma.brokerageConnection.update({
    where: { id: brokerageConnectionId },
    data: {
      status,
      lastError: lastError ?? null,
    },
    include: BROKERAGE_CONNECTION_INCLUDE,
  })
}

export type BrokerageConnectionSummary = BrokerageConnection & {
  linkedSchwabConfig: SchwabConfig | null
}

export async function getSuperuserRuntimeBrokerageBridge() {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  return prisma.brokerageConnection.findFirst({
    where: {
      provider: "SCHWAB",
      isPrimary: true,
      status: {
        in: ["AUTHORIZED", "CONFIGURED"],
      },
      linkedSchwabConfig: {
        is: {
          clientId: { not: "" },
          accessToken: { not: null },
        },
      },
      user: {
        role: "SUPERUSER",
      },
    },
    include: {
      linkedSchwabConfig: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  })
}

export async function saveUserSchwabCredentials(input: {
  userId: string
  clientId: string
  clientSecret: string
}) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  const encryptedSecrets = encryptSchwabSecrets({
    clientSecret: input.clientSecret,
  })

  if (!encryptedSecrets.clientSecret) {
    throw new AppError("Mahita could not encrypt the Schwab client secret.", {
      hint: "Confirm the Mahita secret key is configured before saving credentials.",
    })
  }

  await prisma.schwabConfig.upsert({
    where: { userId: input.userId },
    create: {
      userId: input.userId,
      clientId: input.clientId,
      clientSecret: encryptedSecrets.clientSecret,
    },
    update: {
      clientId: input.clientId,
      clientSecret: encryptedSecrets.clientSecret,
      accessToken: null,
      refreshToken: null,
      accessTokenExpiry: null,
      refreshTokenExpiry: null,
      updatedAt: new Date(),
    },
  })

  return ensureUserSchwabBrokerageConnection(input.userId)
}

export async function deleteUserSchwabCredentials(userId: string) {
  assertRequiredRuntimeModels(["brokerageConnection", "brokerageAccount"])

  await prisma.schwabConfig.deleteMany({
    where: { userId },
  })

  return ensureUserSchwabBrokerageConnection(userId)
}
