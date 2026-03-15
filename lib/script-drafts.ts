import type { StrategyRunSettings } from '@/app/services/trading-engine/types'
import {
    createStrategyVersion,
    deleteStrategyLibraryEntry,
    getStrategyById,
    listStrategies,
    saveStrategyWorkspaceSession,
    touchStrategyWorkspaceSession,
    type StrategyLibraryDocument,
} from '@/lib/strategy-library'

export interface ScriptDraftInput {
    id?: string
    name: string
    description?: string | null
    symbol: string
    timeframe: string
    source: string
    engineMode?: 'pinets' | 'legacy'
    lastParityStatus?: string | null
    linkedFixtureId?: string | null
    runSettings?: StrategyRunSettings | null
}

function parseStrategyDraft(strategy: StrategyLibraryDocument) {
    const workspace = strategy.workspaceSession
    const latestVersion = strategy.latestVersion

    return {
        id: strategy.id,
        name: strategy.name,
        description: strategy.description,
        symbol: workspace?.symbol ?? latestVersion?.symbol ?? strategy.symbol,
        timeframe: workspace?.timeframe ?? latestVersion?.timeframe ?? strategy.timeframe,
        source: workspace?.source ?? latestVersion?.source ?? getDefaultPineTemplate(),
        language: workspace?.language ?? latestVersion?.language ?? strategy.language,
        engineMode: workspace?.engineMode ?? latestVersion?.engineMode ?? strategy.engineMode,
        lastParityStatus: null,
        linkedFixtureId: workspace?.linkedFixtureId ?? latestVersion?.linkedFixtureId ?? null,
        runSettings: workspace?.runSettings ?? latestVersion?.runSettings ?? null,
        createdAt: strategy.createdAt,
        updatedAt: workspace?.updatedAt ?? latestVersion?.updatedAt ?? strategy.updatedAt,
        lastOpenedAt: workspace?.lastOpenedAt ?? strategy.lastOpenedAt,
    }
}

export function getDefaultPineTemplate() {
    return `//@version=6
strategy("Mahita Strategy", overlay=true)

fastEma = ta.ema(close, 9)
slowEma = ta.ema(close, 21)
rsiValue = ta.rsi(close, 14)

longEntry = ta.crossover(fastEma, slowEma) and rsiValue < 70
longExit = ta.crossunder(fastEma, slowEma) or rsiValue > 70

if longEntry
    strategy.entry("Long", strategy.long)

if longExit
    strategy.close("Long")

plot(fastEma, "Fast EMA", color=color.green)
plot(slowEma, "Slow EMA", color=color.red)
`
}

export async function listScriptDrafts(userId: string) {
    const strategies = await listStrategies(userId)
    return strategies.map(parseStrategyDraft)
}

export async function getScriptDraftById(userId: string, id: string) {
    const strategy = await getStrategyById(userId, id)
    return strategy ? parseStrategyDraft(strategy) : null
}

export async function saveScriptDraft(userId: string, input: ScriptDraftInput) {
    const strategy = await saveStrategyWorkspaceSession(userId, {
        strategyId: input.id ?? null,
        name: input.name,
        description: input.description ?? null,
        symbol: input.symbol,
        timeframe: input.timeframe,
        source: input.source,
        engineMode: input.engineMode ?? 'pinets',
        linkedFixtureId: input.linkedFixtureId ?? null,
        runSettings: input.runSettings ?? null,
        createInitialVersion: true,
    })

    if (!strategy) {
        throw new Error('Failed to save strategy workspace.')
    }

    return parseStrategyDraft(strategy)
}

export async function deleteScriptDraft(userId: string, id: string) {
    await deleteStrategyLibraryEntry(userId, id)
}

export async function touchScriptDraft(userId: string, id: string) {
    const strategy = await touchStrategyWorkspaceSession(userId, id)
    return strategy ? parseStrategyDraft(strategy) : null
}

export async function saveImmutableScriptVersion(
    userId: string,
    strategyId: string,
    input?: {
        label?: string | null
        description?: string | null
        source?: string
        linkedFixtureId?: string | null
        runSettings?: StrategyRunSettings | null
        diagnostics?: Record<string, unknown> | null
    }
) {
    const strategy = await createStrategyVersion(userId, {
        strategyId,
        label: input?.label ?? null,
        description: input?.description ?? null,
        source: input?.source,
        linkedFixtureId: input?.linkedFixtureId ?? null,
        runSettings: input?.runSettings ?? null,
        diagnostics: input?.diagnostics ?? null,
        updateWorkspace: true,
    })

    return strategy
}
