import prisma from "@/lib/prisma"

export interface UserPreferenceInput {
    selectedAccountId?: string | null
    portfolioColumns?: string | null
    portfolioSortKey?: string | null
    portfolioSortDirection?: string | null
    dashboardLayout?: string | null
    watchlistSymbols?: string | null
    indicatorFavorites?: string | null
    trendingStrategyIds?: string | null
    viewRefreshIntervalSeconds?: number | null
    lastVisitedPath?: string | null
    lastVisitedAt?: Date | null
    lastSignInAt?: Date | null
    previousSignInAt?: Date | null
}

export async function getUserPreferences(userId: string) {
    return prisma.userPreference.findUnique({
        where: { userId }
    })
}

export async function upsertUserPreferences(userId: string, input: UserPreferenceInput) {
    const normalizedInput = {
        ...input,
        viewRefreshIntervalSeconds: typeof input.viewRefreshIntervalSeconds === 'number'
            ? input.viewRefreshIntervalSeconds
            : undefined,
    }

    return prisma.userPreference.upsert({
        where: { userId },
        update: normalizedInput,
        create: {
            userId,
            ...normalizedInput
        }
    })
}
