import { checkSchwabTokenHealth, getRuntimeSchwabClientWithOptions } from "@/app/services/schwab/runtime"

export const STAGE2_RUNTIME_PROVIDERS = ["schwab", "yahoo"] as const
export const STAGE2_EXPERIMENTAL_PROVIDERS = ["google", "alphavantage"] as const
export const STAGE2_CANONICAL_STORAGE_INTERVALS = ["1m", "1h", "1w"] as const
export const STAGE2_DERIVED_INTERVALS = ["30s", "3m", "5m", "10m", "15m", "30m", "2h", "3h", "4h"] as const
const PROVIDER_READINESS_TIMEOUT_MS = 5_000

export type Stage2RuntimeProvider = (typeof STAGE2_RUNTIME_PROVIDERS)[number]
export type Stage2ExperimentalProvider = (typeof STAGE2_EXPERIMENTAL_PROVIDERS)[number]
export type Stage2Provider = Stage2RuntimeProvider | Stage2ExperimentalProvider | "mock"

export interface ProviderAvailabilitySnapshot {
  schwab: boolean
  yahoo: boolean
}

export interface ProviderReadinessSnapshot {
  allowedRuntimeProviders: Stage2RuntimeProvider[]
  experimentalProviders: Stage2ExperimentalProvider[]
  availability: ProviderAvailabilitySnapshot
  tokenHealth: { isValid: boolean; error?: string }
}

export interface ProviderDecisionInput {
  preferredProvider?: string | null
  providerAvailability: ProviderAvailabilitySnapshot
}

export interface ProviderDecision {
  preferredProvider: Stage2RuntimeProvider
  chosenProvider: Stage2RuntimeProvider | null
  fallbackReason: string | null
  blockedReason: string | null
}

export function normalizeStage2Provider(provider?: string | null): Stage2Provider | null {
  if (!provider) return null
  const normalized = provider.trim().toLowerCase()
  if (
    normalized === "schwab" ||
    normalized === "yahoo" ||
    normalized === "google" ||
    normalized === "alphavantage" ||
    normalized === "mock"
  ) {
    return normalized
  }
  return null
}

export function isRuntimeProvider(provider?: string | null): provider is Stage2RuntimeProvider {
  return provider === "schwab" || provider === "yahoo"
}

export function getRuntimeProviderOrder(preferredProvider?: string | null): Stage2RuntimeProvider[] {
  if (preferredProvider === "yahoo") {
    return ["yahoo", "schwab"]
  }
  return ["schwab", "yahoo"]
}

export function decideRuntimeProvider(input: ProviderDecisionInput): ProviderDecision {
  const preferredProvider = input.preferredProvider === "yahoo" ? "yahoo" : "schwab"
  const runtimeOrder = getRuntimeProviderOrder(preferredProvider)

  for (const provider of runtimeOrder) {
    if (input.providerAvailability[provider]) {
      return {
        preferredProvider,
        chosenProvider: provider,
        fallbackReason:
          provider === preferredProvider
            ? null
            : `${preferredProvider} unavailable; falling back to ${provider}.`,
        blockedReason: null,
      }
    }
  }

  return {
    preferredProvider,
    chosenProvider: null,
    fallbackReason: null,
    blockedReason: "No Stage 2 runtime provider is currently available.",
  }
}

export function resolveVerificationProviders(input: {
  preferredProvider?: string | null
  availability: ProviderAvailabilitySnapshot
}) {
  const primaryDecision = decideRuntimeProvider({
    preferredProvider: input.preferredProvider,
    providerAvailability: input.availability,
  })

  const comparisonProvider =
    primaryDecision.chosenProvider === "schwab"
      ? input.availability.yahoo
        ? "yahoo"
        : null
      : primaryDecision.chosenProvider === "yahoo"
        ? input.availability.schwab
          ? "schwab"
          : null
        : null

  return {
    sourceProvider: primaryDecision.chosenProvider,
    comparisonProvider,
    primaryDecision,
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs)
      }),
    ])
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  }
}

export async function getProviderAvailabilitySnapshot(): Promise<ProviderAvailabilitySnapshot> {
  const schwabClient = await withTimeout(
    getRuntimeSchwabClientWithOptions({ silent: true }),
    PROVIDER_READINESS_TIMEOUT_MS,
    null
  )
  return {
    schwab: !!schwabClient,
    yahoo: true,
  }
}

export async function getProviderReadinessSnapshot(): Promise<ProviderReadinessSnapshot> {
  const [availability, tokenHealth] = await Promise.all([
    getProviderAvailabilitySnapshot(),
    withTimeout(
      checkSchwabTokenHealth(),
      PROVIDER_READINESS_TIMEOUT_MS,
      { isValid: false, error: "Timed out while checking Schwab runtime token health." }
    ),
  ])

  return {
    allowedRuntimeProviders: [...STAGE2_RUNTIME_PROVIDERS],
    experimentalProviders: [...STAGE2_EXPERIMENTAL_PROVIDERS],
    availability,
    tokenHealth,
  }
}
