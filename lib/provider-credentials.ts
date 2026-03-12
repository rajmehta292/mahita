import type {
  Prisma,
  ProviderCredential,
  ProviderPoolPurpose,
} from "@prisma/client"
import prisma from "@/lib/prisma"
import { decryptSecret, encryptSecret } from "@/lib/secrets"
import { assertRequiredRuntimeModels } from "@/lib/runtime-health"
import { resolveSchwabConfig } from "@/lib/schwab-config"

const MARKET_DATA_PROVIDER_INCLUDE = {
  providerCredential: {
    include: {
      createdByUser: {
        select: {
          id: true,
          email: true,
          name: true,
        },
      },
      linkedSchwabConfig: {
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.ProviderPoolMemberInclude

export type ProviderPoolMemberRecord = Prisma.ProviderPoolMemberGetPayload<{
  include: typeof MARKET_DATA_PROVIDER_INCLUDE
}>

export interface SerializedProviderPoolMember {
  id: string
  label: string | null
  purpose: string
  priority: number
  weight: number
  status: string
  isPrimary: boolean
  credential: {
    id: string
    provider: string
    label: string
    sourceType: string
    isEnabled: boolean
    linkedUser: { id: string; email: string | null; name: string | null } | null
  }
}

export interface ResolvedProviderCredential extends ProviderCredential {
  clientSecret: string | null
  accessToken: string | null
  refreshToken: string | null
}

export function resolveProviderCredentialSecrets(
  credential: ProviderCredential
): ResolvedProviderCredential {
  return {
    ...credential,
    clientSecret: decryptSecret(credential.clientSecret),
    accessToken: decryptSecret(credential.accessToken),
    refreshToken: decryptSecret(credential.refreshToken),
  }
}

export function encryptProviderCredentialSecrets(input: {
  clientSecret?: string | null
  accessToken?: string | null
  refreshToken?: string | null
}) {
  const encrypted: {
    clientSecret?: string | null
    accessToken?: string | null
    refreshToken?: string | null
  } = {}

  if (input.clientSecret !== undefined) {
    encrypted.clientSecret =
      input.clientSecret === null ? null : encryptSecret(input.clientSecret) ?? null
  }

  if (input.accessToken !== undefined) {
    encrypted.accessToken =
      input.accessToken === null ? null : encryptSecret(input.accessToken) ?? null
  }

  if (input.refreshToken !== undefined) {
    encrypted.refreshToken =
      input.refreshToken === null ? null : encryptSecret(input.refreshToken) ?? null
  }

  return encrypted
}

export async function listProviderPoolMembers(
  purpose: ProviderPoolPurpose = "MARKET_DATA"
) {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember"])

  return prisma.providerPoolMember.findMany({
    where: { purpose },
    include: MARKET_DATA_PROVIDER_INCLUDE,
    orderBy: [{ isPrimary: "desc" }, { priority: "asc" }, { createdAt: "asc" }],
  })
}

export function serializeProviderPoolMember(
  member: ProviderPoolMemberRecord
): SerializedProviderPoolMember {
  return {
    id: member.id,
    label: member.label,
    purpose: member.purpose,
    priority: member.priority,
    weight: member.weight,
    status: member.status,
    isPrimary: member.isPrimary,
    credential: {
      id: member.providerCredential.id,
      provider: member.providerCredential.provider,
      label:
        member.providerCredential.label ||
        member.label ||
        `${member.providerCredential.provider} credential`,
      sourceType: member.providerCredential.sourceType,
      isEnabled: member.providerCredential.isEnabled,
      linkedUser: member.providerCredential.linkedSchwabConfig?.user ?? null,
    },
  }
}

export async function upsertUserSchwabProviderPoolMember(input: {
  actorUserId: string
  targetUserId: string
  label?: string
  priority?: number
  isPrimary?: boolean
}) {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember"])

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    include: {
      schwabConfig: true,
    },
  })

  if (!targetUser?.schwabConfig) {
    throw new Error("Target user does not have a Schwab configuration.")
  }

  const linkedSchwabConfig = targetUser.schwabConfig

  return prisma.$transaction(async (tx) => {
    if (input.isPrimary ?? true) {
      await tx.providerPoolMember.updateMany({
        where: { purpose: "MARKET_DATA" },
        data: { isPrimary: false },
      })
    }

    const providerCredential = await tx.providerCredential.upsert({
      where: {
        linkedSchwabConfigId: linkedSchwabConfig.id,
      },
      create: {
        provider: "schwab",
        label:
          input.label ||
          `${targetUser.email || targetUser.name || "User"} Schwab fallback`,
        sourceType: "USER_SCHWAB_CONFIG",
        createdByUserId: input.actorUserId,
        linkedSchwabConfigId: linkedSchwabConfig.id,
        isEnabled: true,
        notes:
          "Temporary market-data provider entry backed by a user Schwab configuration.",
      },
      update: {
        label:
          input.label ||
          `${targetUser.email || targetUser.name || "User"} Schwab fallback`,
        createdByUserId: input.actorUserId,
        isEnabled: true,
      },
    })

    const member = await tx.providerPoolMember.upsert({
      where: {
        providerCredentialId_purpose: {
          providerCredentialId: providerCredential.id,
          purpose: "MARKET_DATA",
        },
      },
      create: {
        providerCredentialId: providerCredential.id,
        purpose: "MARKET_DATA",
        label: input.label || "Primary Schwab fallback",
        priority: input.priority ?? 10,
        weight: 1,
        status: "ACTIVE",
        isPrimary: input.isPrimary ?? true,
      },
      update: {
        label: input.label || "Primary Schwab fallback",
        priority: input.priority ?? 10,
        status: "ACTIVE",
        isPrimary: input.isPrimary ?? true,
      },
    })

    return tx.providerPoolMember.findUniqueOrThrow({
      where: { id: member.id },
      include: MARKET_DATA_PROVIDER_INCLUDE,
    })
  })
}

export async function setProviderPoolMemberState(input: {
  providerPoolMemberId: string
  status?: "ACTIVE" | "DISABLED" | "DEGRADED"
  isPrimary?: boolean
  priority?: number
}) {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember"])

  return prisma.$transaction(async (tx) => {
    const member = await tx.providerPoolMember.findUnique({
      where: { id: input.providerPoolMemberId },
    })

    if (!member) {
      throw new Error("Provider pool member not found.")
    }

    if (input.isPrimary) {
      await tx.providerPoolMember.updateMany({
        where: {
          purpose: member.purpose,
          id: { not: member.id },
        },
        data: { isPrimary: false },
      })
    }

    return tx.providerPoolMember.update({
      where: { id: member.id },
      data: {
        status: input.status ?? undefined,
        isPrimary: input.isPrimary ?? undefined,
        priority: input.priority ?? undefined,
      },
      include: MARKET_DATA_PROVIDER_INCLUDE,
    })
  })
}

export async function getRuntimeSchwabProviderMembers() {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember"])

  const pool = await listProviderPoolMembers("MARKET_DATA")

  return pool.filter(
    (member) =>
      member.status === "ACTIVE" &&
      member.providerCredential.isEnabled &&
      member.providerCredential.provider === "schwab"
  )
}

export function resolveRuntimeSchwabCredential(member: ProviderPoolMemberRecord) {
  if (member.providerCredential.sourceType === "USER_SCHWAB_CONFIG") {
    if (!member.providerCredential.linkedSchwabConfig) {
      throw new Error("Linked Schwab config is missing for user-backed provider credential.")
    }

    return {
      sourceType: member.providerCredential.sourceType,
      providerCredentialId: member.providerCredential.id,
      linkedSchwabConfigId: member.providerCredential.linkedSchwabConfig.id,
      config: resolveSchwabConfig(member.providerCredential.linkedSchwabConfig),
    }
  }

  return {
    sourceType: member.providerCredential.sourceType,
    providerCredentialId: member.providerCredential.id,
    linkedSchwabConfigId: null,
    config: resolveProviderCredentialSecrets(member.providerCredential),
  }
}

export async function persistRuntimeSchwabTokens(input: {
  member: ProviderPoolMemberRecord
  accessToken: string
  refreshToken?: string | null
  accessTokenExpiry: Date
  refreshTokenExpiry?: Date | null
}) {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember"])

  const encrypted = encryptProviderCredentialSecrets({
    accessToken: input.accessToken,
    refreshToken: input.refreshToken ?? null,
  })

  if (input.member.providerCredential.sourceType === "USER_SCHWAB_CONFIG") {
    const linkedSchwabConfigId = input.member.providerCredential.linkedSchwabConfigId

    if (!linkedSchwabConfigId) {
      throw new Error("Linked Schwab config missing for user-backed provider credential.")
    }

    await prisma.schwabConfig.update({
      where: { id: linkedSchwabConfigId },
      data: {
        accessToken: encrypted.accessToken ?? null,
        refreshToken: encrypted.refreshToken ?? null,
        accessTokenExpiry: input.accessTokenExpiry,
        refreshTokenExpiry: input.refreshTokenExpiry ?? undefined,
      },
    })

    return
  }

  await prisma.providerCredential.update({
    where: { id: input.member.providerCredential.id },
    data: {
      accessToken: encrypted.accessToken ?? null,
      refreshToken: encrypted.refreshToken ?? null,
      accessTokenExpiry: input.accessTokenExpiry,
      refreshTokenExpiry: input.refreshTokenExpiry ?? undefined,
      lastValidatedAt: new Date(),
      lastValidationError: null,
    },
  })
}

export async function getProviderCredentialReveal(id: string) {
  assertRequiredRuntimeModels(["providerCredential", "providerPoolMember", "adminSecretRevealGrant"])

  const credential = await prisma.providerCredential.findUnique({
    where: { id },
    include: {
      createdByUser: {
        select: { id: true, email: true, name: true },
      },
      linkedSchwabConfig: {
        include: {
          user: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      poolMembers: true,
    },
  })

  if (!credential) {
    return null
  }

  if (credential.sourceType === "USER_SCHWAB_CONFIG" && credential.linkedSchwabConfig) {
    const resolved = resolveSchwabConfig(credential.linkedSchwabConfig)
    return {
      id: credential.id,
      provider: credential.provider,
      label: credential.label,
      sourceType: credential.sourceType,
      clientId: resolved.clientId,
      clientSecret: resolved.clientSecret,
      accessToken: resolved.accessToken,
      refreshToken: resolved.refreshToken,
      accessTokenExpiry: resolved.accessTokenExpiry,
      refreshTokenExpiry: resolved.refreshTokenExpiry,
      linkedUser: credential.linkedSchwabConfig.user,
      poolMembers: credential.poolMembers,
    }
  }

  const resolved = resolveProviderCredentialSecrets(credential)
  return {
    id: credential.id,
    provider: credential.provider,
    label: credential.label,
    sourceType: credential.sourceType,
    clientId: resolved.clientId,
    clientSecret: resolved.clientSecret,
    accessToken: resolved.accessToken,
    refreshToken: resolved.refreshToken,
    accessTokenExpiry: resolved.accessTokenExpiry,
    refreshTokenExpiry: resolved.refreshTokenExpiry,
    linkedUser: null,
    poolMembers: credential.poolMembers,
  }
}
