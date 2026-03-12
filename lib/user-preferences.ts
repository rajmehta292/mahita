import prisma from "@/lib/prisma"

export interface UserPreferenceInput {
    selectedAccountId?: string | null
    portfolioColumns?: string | null
    portfolioSortKey?: string | null
    portfolioSortDirection?: string | null
    dashboardLayout?: string | null
    watchlistSymbols?: string | null
    trendingStrategyIds?: string | null
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
    return prisma.userPreference.upsert({
        where: { userId },
        update: input,
        create: {
            userId,
            ...input
        }
    })
}
