import prisma from "@/lib/prisma"
import { AppError } from "@/lib/app-errors"
import { allowInsecureUserBrokeragePlatformFallback } from "@/lib/security/platform-security"

const REQUIRED_RUNTIME_PRISMA_MODELS = [
  "brokerageConnection",
  "brokerageAccount",
  "providerCredential",
  "providerPoolMember",
  "adminSecretRevealGrant",
] as const

const REQUIRED_DI_UI_PRISMA_MODELS = [
  "ingestionProfile",
  "ingestionLane",
  "ingestionTarget",
  "ingestionTargetSymbol",
  "ingestionJob",
  "ingestionDispatchLog",
  "verificationPolicy",
  "verificationJob",
  "verificationObservation",
  "ingestionViewDemand",
] as const

export type RuntimePrismaModel = (typeof REQUIRED_RUNTIME_PRISMA_MODELS)[number]
export type DiUiRuntimePrismaModel = (typeof REQUIRED_DI_UI_PRISMA_MODELS)[number]

function hasPrismaModel(model: RuntimePrismaModel) {
  const client = prisma as unknown as Record<string, unknown>
  const value = client[model]
  return Boolean(value && typeof value === "object")
}

function hasAnyPrismaModel(model: string) {
  const client = prisma as unknown as Record<string, unknown>
  const value = client[model]
  return Boolean(value && typeof value === "object")
}

export function getPrismaModelReadiness() {
  const readiness = REQUIRED_RUNTIME_PRISMA_MODELS.reduce<Record<RuntimePrismaModel, boolean>>(
    (accumulator, model) => {
      accumulator[model] = hasPrismaModel(model)
      return accumulator
    },
    {} as Record<RuntimePrismaModel, boolean>
  )

  return {
    readiness,
    missingModels: REQUIRED_RUNTIME_PRISMA_MODELS.filter((model) => !readiness[model]),
  }
}

export function getDiUiPrismaModelReadiness() {
  const readiness = REQUIRED_DI_UI_PRISMA_MODELS.reduce<Record<DiUiRuntimePrismaModel, boolean>>(
    (accumulator, model) => {
      accumulator[model] = hasAnyPrismaModel(model)
      return accumulator
    },
    {} as Record<DiUiRuntimePrismaModel, boolean>
  )

  return {
    readiness,
    missingModels: REQUIRED_DI_UI_PRISMA_MODELS.filter((model) => !readiness[model]),
  }
}

export function assertRequiredRuntimeModels(models: RuntimePrismaModel[] = [...REQUIRED_RUNTIME_PRISMA_MODELS]) {
  const client = prisma as unknown as Record<string, unknown>
  const missingModels = models.filter((model) => !(model in client) || !client[model])

  if (missingModels.length === 0) {
    return
  }

  throw new AppError("Mahita detected a Prisma schema/client mismatch.", {
    code: "RUNTIME_SCHEMA_MISMATCH",
    status: 503,
    details: {
      missingModels,
    },
    hint:
      "Run `npx prisma generate` and restart the dev server so the generated Prisma client matches the current schema.",
    recoverable: true,
  })
}

export function assertRequiredDiUiModels(
  models: DiUiRuntimePrismaModel[] = [...REQUIRED_DI_UI_PRISMA_MODELS]
) {
  const client = prisma as unknown as Record<string, unknown>
  const missingModels = models.filter((model) => !(model in client) || !client[model])

  if (missingModels.length === 0) {
    return
  }

  throw new AppError("Mahita detected a Prisma schema/client mismatch in DI-UI.", {
    code: "RUNTIME_SCHEMA_MISMATCH",
    status: 503,
    details: {
      missingModels,
      scope: "di-ui",
    },
    hint:
      "Run `npx prisma generate` and restart the dev server so the generated Prisma client matches the current DI-UI scheduler and verification schema.",
    recoverable: true,
  })
}

export async function getRuntimeHealthSnapshot() {
  const modelReadiness = getPrismaModelReadiness()
  const diUiModelReadiness = getDiUiPrismaModelReadiness()
  const runtime = {
    prismaClientReady: modelReadiness.missingModels.length === 0,
    missingPrismaModels: modelReadiness.missingModels,
    diUiPrismaClientReady: diUiModelReadiness.missingModels.length === 0,
    missingDiUiPrismaModels: diUiModelReadiness.missingModels,
    insecureUserBrokeragePlatformFallbackEnabled: allowInsecureUserBrokeragePlatformFallback(),
    hasDedicatedAppSecretKey: Boolean(
      process.env.MAHITA_SECRET_KEY || process.env.ENCRYPTION_KEY
    ),
    platformData: {
      canonicalBarSource: "vault-sqlite",
      parquetRouteStatus: "experimental",
      inventoryAuthority: "main-prisma-db",
    },
  }

  if (!runtime.prismaClientReady) {
    return {
      ok: false,
      runtime,
      providerPool: {
        marketDataMemberCount: null,
        superuserBridgeCandidates: null,
      },
    }
  }

  const [marketDataMemberCount, superuserBridgeCandidates] = await Promise.all([
    prisma.providerPoolMember.count({
      where: { purpose: "MARKET_DATA" },
    }),
    prisma.brokerageConnection.count({
      where: {
        provider: "SCHWAB",
        user: {
          role: "SUPERUSER",
        },
      },
    }),
  ])

  return {
    ok: true,
    runtime,
    providerPool: {
      marketDataMemberCount,
      superuserBridgeCandidates,
    },
  }
}
