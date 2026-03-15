import { createHash } from 'crypto'
import prisma from '@/lib/prisma'
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'

export interface StrategyLibraryVersionDocument {
    id: string
    strategyId: string
    versionNumber: number
    label: string | null
    description: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettings: StrategyRunSettings | null
    diagnostics: Record<string, unknown> | null
    sourceHash: string
    createdAt: string
    updatedAt: string
}

export interface StrategyWorkspaceSessionDocument {
    id: string
    strategyId: string
    userId: string
    baseVersionId: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettings: StrategyRunSettings | null
    autosaveRevision: number
    lastOpenedAt: string | null
    createdAt: string
    updatedAt: string
}

export interface StrategyLibraryDocument {
    id: string
    userId: string
    legacyScriptDraftId: string | null
    name: string
    description: string | null
    symbol: string
    timeframe: string
    language: string
    engineMode: string
    favorite: boolean
    pinned: boolean
    tags: string[]
    latestVersionId: string | null
    lastOpenedAt: string | null
    createdAt: string
    updatedAt: string
    latestVersion: StrategyLibraryVersionDocument | null
    versions: StrategyLibraryVersionDocument[]
    workspaceSession: StrategyWorkspaceSessionDocument | null
}

export interface StrategyLibraryInput {
    strategyId?: string | null
    name: string
    description?: string | null
    symbol: string
    timeframe: string
    source: string
    language?: string
    engineMode?: string
    linkedFixtureId?: string | null
    runSettings?: StrategyRunSettings | null
    favorite?: boolean
    pinned?: boolean
    tags?: string[] | null
    createInitialVersion?: boolean
}

export interface StrategyVersionInput {
    strategyId: string
    label?: string | null
    description?: string | null
    source?: string
    symbol?: string
    timeframe?: string
    language?: string
    engineMode?: string
    linkedFixtureId?: string | null
    runSettings?: StrategyRunSettings | null
    diagnostics?: Record<string, unknown> | null
    updateWorkspace?: boolean
}

interface RawStrategyVersionRecord {
    id: string
    strategyId: string
    versionNumber: number
    label: string | null
    description: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettingsJson: string | null
    diagnosticsJson: string | null
    sourceHash: string
    createdAt: Date
    updatedAt: Date
}

interface RawStrategyWorkspaceSessionRecord {
    id: string
    strategyId: string
    userId: string
    baseVersionId: string | null
    symbol: string
    timeframe: string
    source: string
    language: string
    engineMode: string
    linkedFixtureId: string | null
    runSettingsJson: string | null
    autosaveRevision: number
    lastOpenedAt: Date | null
    createdAt: Date
    updatedAt: Date
}

interface RawStrategyRecord {
    id: string
    userId: string
    legacyScriptDraftId: string | null
    name: string
    description: string | null
    asset: string
    timeframe: string
    language: string
    engineMode: string
    favorite: boolean
    pinned: boolean
    tagsJson: string | null
    latestVersionId: string | null
    lastOpenedAt: Date | null
    createdAt: Date
    updatedAt: Date
    latestVersion?: RawStrategyVersionRecord | null
    versions?: RawStrategyVersionRecord[]
    workspaceSession?: RawStrategyWorkspaceSessionRecord | null
}

function normalizeSymbol(symbol: string) {
    return symbol.trim().toUpperCase() || 'AAPL'
}

function normalizeTimeframe(timeframe: string) {
    return timeframe.trim() || '1d'
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
    if (!value) {
        return fallback
    }

    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export function createStrategySourceHash(source: string) {
    return createHash('sha256').update(source).digest('hex')
}

function normalizeTags(tags?: string[] | null) {
    if (!tags?.length) {
        return null
    }

    const normalized = Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)))
    return normalized.length ? JSON.stringify(normalized) : null
}

function normalizeVersion(record: RawStrategyVersionRecord): StrategyLibraryVersionDocument {
    return {
        id: record.id,
        strategyId: record.strategyId,
        versionNumber: record.versionNumber,
        label: record.label ?? null,
        description: record.description ?? null,
        symbol: record.symbol,
        timeframe: record.timeframe,
        source: record.source,
        language: record.language,
        engineMode: record.engineMode,
        linkedFixtureId: record.linkedFixtureId ?? null,
        runSettings: parseJson<StrategyRunSettings | null>(record.runSettingsJson, null),
        diagnostics: parseJson<Record<string, unknown> | null>(record.diagnosticsJson, null),
        sourceHash: record.sourceHash,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    }
}

function normalizeWorkspaceSession(record: RawStrategyWorkspaceSessionRecord): StrategyWorkspaceSessionDocument {
    return {
        id: record.id,
        strategyId: record.strategyId,
        userId: record.userId,
        baseVersionId: record.baseVersionId ?? null,
        symbol: record.symbol,
        timeframe: record.timeframe,
        source: record.source,
        language: record.language,
        engineMode: record.engineMode,
        linkedFixtureId: record.linkedFixtureId ?? null,
        runSettings: parseJson<StrategyRunSettings | null>(record.runSettingsJson, null),
        autosaveRevision: record.autosaveRevision,
        lastOpenedAt: record.lastOpenedAt ? record.lastOpenedAt.toISOString() : null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
    }
}

function normalizeStrategy(record: RawStrategyRecord): StrategyLibraryDocument {
    return {
        id: record.id,
        userId: record.userId,
        legacyScriptDraftId: record.legacyScriptDraftId ?? null,
        name: record.name,
        description: record.description ?? null,
        symbol: record.asset,
        timeframe: record.timeframe,
        language: record.language,
        engineMode: record.engineMode,
        favorite: Boolean(record.favorite),
        pinned: Boolean(record.pinned),
        tags: parseJson<string[]>(record.tagsJson, []),
        latestVersionId: record.latestVersionId ?? null,
        lastOpenedAt: record.lastOpenedAt ? record.lastOpenedAt.toISOString() : null,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        latestVersion: record.latestVersion ? normalizeVersion(record.latestVersion) : null,
        versions: Array.isArray(record.versions) ? record.versions.map(normalizeVersion) : [],
        workspaceSession: record.workspaceSession ? normalizeWorkspaceSession(record.workspaceSession) : null,
    }
}

async function buildStrategyRecord(userId: string, strategyId: string) {
    const record = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId,
        },
        include: {
            latestVersion: true,
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
            },
            workspaceSession: true,
        },
    })

    return record ? normalizeStrategy(record) : null
}

async function createInitialVersionAndSession(userId: string, strategyId: string, input: StrategyLibraryInput) {
    const source = input.source.trim()
    const version = await prisma.strategyVersion.create({
        data: {
            strategyId,
            versionNumber: 1,
            label: 'Initial version',
            description: input.description?.trim() || null,
            symbol: normalizeSymbol(input.symbol),
            timeframe: normalizeTimeframe(input.timeframe),
            source,
            language: input.language ?? 'pine-v6',
            engineMode: input.engineMode ?? 'pinets',
            linkedFixtureId: input.linkedFixtureId ?? null,
            runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
            sourceHash: createStrategySourceHash(source),
        },
    })

    await prisma.strategy.update({
        where: { id: strategyId },
        data: {
            latestVersionId: version.id,
        },
    })

    await prisma.strategyWorkspaceSession.create({
        data: {
            strategyId,
            userId,
            baseVersionId: version.id,
            symbol: normalizeSymbol(input.symbol),
            timeframe: normalizeTimeframe(input.timeframe),
            source,
            language: input.language ?? 'pine-v6',
            engineMode: input.engineMode ?? 'pinets',
            linkedFixtureId: input.linkedFixtureId ?? null,
            runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
            autosaveRevision: 1,
            lastOpenedAt: new Date(),
        },
    })

    return version
}

export async function ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId: string) {
    const legacyDrafts = await prisma.scriptDraft.findMany({
        where: { userId },
        orderBy: [{ updatedAt: 'desc' }],
    })

    if (legacyDrafts.length === 0) {
        return
    }

    const existingStrategies = await prisma.strategy.findMany({
        where: {
            userId,
            legacyScriptDraftId: {
                in: legacyDrafts.map((draft) => draft.id),
            },
        },
        include: {
            workspaceSession: true,
            latestVersion: true,
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
            },
        },
    })

    const existingByLegacyId = new Map(
        existingStrategies
            .filter((strategy) => strategy.legacyScriptDraftId)
            .map((strategy) => [strategy.legacyScriptDraftId as string, strategy])
    )

    for (const draft of legacyDrafts) {
        const existing = existingByLegacyId.get(draft.id)

        if (!existing) {
            const strategy = await prisma.strategy.create({
                data: {
                    userId,
                    legacyScriptDraftId: draft.id,
                    name: draft.name,
                    description: draft.description,
                    asset: normalizeSymbol(draft.symbol),
                    timeframe: normalizeTimeframe(draft.timeframe),
                    language: draft.language,
                    engineMode: draft.engineMode,
                    lastOpenedAt: draft.lastOpenedAt ?? draft.updatedAt,
                },
            })

            const version = await prisma.strategyVersion.create({
                data: {
                    strategyId: strategy.id,
                    versionNumber: 1,
                    label: 'Migrated v1',
                    description: draft.description,
                    symbol: normalizeSymbol(draft.symbol),
                    timeframe: normalizeTimeframe(draft.timeframe),
                    source: draft.source,
                    language: draft.language,
                    engineMode: draft.engineMode,
                    linkedFixtureId: draft.linkedFixtureId,
                    runSettingsJson: draft.runSettingsJson,
                    sourceHash: createStrategySourceHash(draft.source),
                },
            })

            await prisma.strategy.update({
                where: { id: strategy.id },
                data: {
                    latestVersionId: version.id,
                },
            })

            await prisma.strategyWorkspaceSession.create({
                data: {
                    strategyId: strategy.id,
                    userId,
                    baseVersionId: version.id,
                    symbol: normalizeSymbol(draft.symbol),
                    timeframe: normalizeTimeframe(draft.timeframe),
                    source: draft.source,
                    language: draft.language,
                    engineMode: draft.engineMode,
                    linkedFixtureId: draft.linkedFixtureId,
                    runSettingsJson: draft.runSettingsJson,
                    autosaveRevision: 1,
                    lastOpenedAt: draft.lastOpenedAt ?? draft.updatedAt,
                    createdAt: draft.createdAt,
                    updatedAt: draft.updatedAt,
                },
            })

            await prisma.strategyDeployment.updateMany({
                where: {
                    userId,
                    linkedScriptDraftId: draft.id,
                    strategyId: null,
                },
                data: {
                    strategyId: strategy.id,
                    strategyVersionId: version.id,
                },
            })

            continue
        }

        let latestVersionId = existing.latestVersionId
        if (!existing.latestVersion && existing.versions.length === 0) {
            const version = await prisma.strategyVersion.create({
                data: {
                    strategyId: existing.id,
                    versionNumber: 1,
                    label: 'Migrated v1',
                    description: draft.description,
                    symbol: normalizeSymbol(draft.symbol),
                    timeframe: normalizeTimeframe(draft.timeframe),
                    source: draft.source,
                    language: draft.language,
                    engineMode: draft.engineMode,
                    linkedFixtureId: draft.linkedFixtureId,
                    runSettingsJson: draft.runSettingsJson,
                    sourceHash: createStrategySourceHash(draft.source),
                },
            })
            latestVersionId = version.id
            await prisma.strategy.update({
                where: { id: existing.id },
                data: {
                    latestVersionId: version.id,
                },
            })
        }

        if (!existing.workspaceSession) {
            await prisma.strategyWorkspaceSession.create({
                data: {
                    strategyId: existing.id,
                    userId,
                    baseVersionId: latestVersionId ?? null,
                    symbol: normalizeSymbol(draft.symbol),
                    timeframe: normalizeTimeframe(draft.timeframe),
                    source: draft.source,
                    language: draft.language,
                    engineMode: draft.engineMode,
                    linkedFixtureId: draft.linkedFixtureId,
                    runSettingsJson: draft.runSettingsJson,
                    autosaveRevision: 1,
                    lastOpenedAt: draft.lastOpenedAt ?? draft.updatedAt,
                    createdAt: draft.createdAt,
                    updatedAt: draft.updatedAt,
                },
            })
        }

        await prisma.strategyDeployment.updateMany({
            where: {
                userId,
                linkedScriptDraftId: draft.id,
                strategyId: null,
            },
            data: {
                strategyId: existing.id,
                strategyVersionId: latestVersionId ?? undefined,
            },
        })
    }
}

export async function listStrategies(userId: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const records = await prisma.strategy.findMany({
        where: { userId },
        include: {
            latestVersion: true,
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
            },
            workspaceSession: true,
        },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
    })

    return records.map(normalizeStrategy)
}

export async function getStrategyById(userId: string, id: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)
    return buildStrategyRecord(userId, id)
}

export async function saveStrategyWorkspaceSession(userId: string, input: StrategyLibraryInput) {
    const name = input.name.trim()
    const symbol = normalizeSymbol(input.symbol)
    const timeframe = normalizeTimeframe(input.timeframe)
    const source = input.source.trim()

    if (!name) {
        throw new Error('Strategy name is required.')
    }

    if (!source) {
        throw new Error('Strategy source is required.')
    }

    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    if (!input.strategyId) {
        const strategy = await prisma.strategy.create({
            data: {
                userId,
                name,
                description: input.description?.trim() || null,
                asset: symbol,
                timeframe,
                language: input.language ?? 'pine-v6',
                engineMode: input.engineMode ?? 'pinets',
                favorite: Boolean(input.favorite),
                pinned: Boolean(input.pinned),
                tagsJson: normalizeTags(input.tags),
                lastOpenedAt: new Date(),
            },
        })

        if (input.createInitialVersion !== false) {
            await createInitialVersionAndSession(userId, strategy.id, input)
        } else {
            await prisma.strategyWorkspaceSession.create({
                data: {
                    strategyId: strategy.id,
                    userId,
                    symbol,
                    timeframe,
                    source,
                    language: input.language ?? 'pine-v6',
                    engineMode: input.engineMode ?? 'pinets',
                    linkedFixtureId: input.linkedFixtureId ?? null,
                    runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
                    autosaveRevision: 1,
                    lastOpenedAt: new Date(),
                },
            })
        }

        return buildStrategyRecord(userId, strategy.id)
    }

    const existing = await prisma.strategy.findFirst({
        where: {
            id: input.strategyId,
            userId,
        },
        include: {
            workspaceSession: true,
            latestVersion: true,
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
            },
        },
    })

    if (!existing) {
        throw new Error('Strategy not found.')
    }

    await prisma.strategy.update({
        where: { id: existing.id },
        data: {
            name,
            description: input.description?.trim() || null,
            asset: symbol,
            timeframe,
            language: input.language ?? existing.language,
            engineMode: input.engineMode ?? existing.engineMode,
            favorite: input.favorite ?? existing.favorite,
            pinned: input.pinned ?? existing.pinned,
            tagsJson: input.tags !== undefined ? normalizeTags(input.tags) : existing.tagsJson,
            lastOpenedAt: new Date(),
        },
    })

    if (!existing.workspaceSession) {
        if (!existing.latestVersion && existing.versions.length === 0 && input.createInitialVersion !== false) {
            await createInitialVersionAndSession(userId, existing.id, input)
        } else {
            await prisma.strategyWorkspaceSession.create({
                data: {
                    strategyId: existing.id,
                    userId,
                    baseVersionId: existing.latestVersionId ?? null,
                    symbol,
                    timeframe,
                    source,
                    language: input.language ?? existing.language,
                    engineMode: input.engineMode ?? existing.engineMode,
                    linkedFixtureId: input.linkedFixtureId ?? null,
                    runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
                    autosaveRevision: 1,
                    lastOpenedAt: new Date(),
                },
            })
        }
    } else {
        await prisma.strategyWorkspaceSession.update({
            where: { strategyId: existing.id },
            data: {
                symbol,
                timeframe,
                source,
                language: input.language ?? existing.workspaceSession.language,
                engineMode: input.engineMode ?? existing.workspaceSession.engineMode,
                linkedFixtureId: input.linkedFixtureId ?? null,
                runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
                autosaveRevision: {
                    increment: 1,
                },
                lastOpenedAt: new Date(),
            },
        })
    }

    return buildStrategyRecord(userId, existing.id)
}

export async function createStrategyVersion(userId: string, input: StrategyVersionInput) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: input.strategyId,
            userId,
        },
        include: {
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
                take: 1,
            },
            workspaceSession: true,
        },
    })

    if (!strategy) {
        throw new Error('Strategy not found.')
    }

    const source = (input.source ?? strategy.workspaceSession?.source ?? '').trim()
    if (!source) {
        throw new Error('Strategy source is required to create a version.')
    }

    const versionNumber = (strategy.versions[0]?.versionNumber ?? 0) + 1
    const symbol = normalizeSymbol(input.symbol ?? strategy.workspaceSession?.symbol ?? strategy.asset)
    const timeframe = normalizeTimeframe(input.timeframe ?? strategy.workspaceSession?.timeframe ?? strategy.timeframe)
    const language = input.language ?? strategy.workspaceSession?.language ?? strategy.language
    const engineMode = input.engineMode ?? strategy.workspaceSession?.engineMode ?? strategy.engineMode
    const linkedFixtureId = input.linkedFixtureId ?? strategy.workspaceSession?.linkedFixtureId ?? null
    const runSettings = input.runSettings ?? parseJson<StrategyRunSettings | null>(strategy.workspaceSession?.runSettingsJson, null)

    const version = await prisma.strategyVersion.create({
        data: {
            strategyId: strategy.id,
            versionNumber,
            label: input.label?.trim() || `v${versionNumber}`,
            description: input.description?.trim() || strategy.description,
            symbol,
            timeframe,
            source,
            language,
            engineMode,
            linkedFixtureId,
            runSettingsJson: runSettings ? JSON.stringify(runSettings) : null,
            diagnosticsJson: input.diagnostics ? JSON.stringify(input.diagnostics) : null,
            sourceHash: createStrategySourceHash(source),
        },
    })

    await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
            asset: symbol,
            timeframe,
            latestVersionId: version.id,
            lastOpenedAt: new Date(),
        },
    })

    if (input.updateWorkspace !== false) {
        const workspacePayload = {
            symbol,
            timeframe,
            source,
            language,
            engineMode,
            linkedFixtureId,
            runSettingsJson: runSettings ? JSON.stringify(runSettings) : null,
            baseVersionId: version.id,
            lastOpenedAt: new Date(),
        }

        if (strategy.workspaceSession) {
            await prisma.strategyWorkspaceSession.update({
                where: { strategyId: strategy.id },
                data: {
                    ...workspacePayload,
                    autosaveRevision: {
                        increment: 1,
                    },
                },
            })
        } else {
            await prisma.strategyWorkspaceSession.create({
                data: {
                    strategyId: strategy.id,
                    userId,
                    ...workspacePayload,
                    autosaveRevision: 1,
                },
            })
        }
    }

    return buildStrategyRecord(userId, strategy.id)
}

export async function restoreStrategyVersionToWorkspace(userId: string, strategyId: string, versionId: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId,
        },
        include: {
            workspaceSession: true,
            versions: {
                where: { id: versionId },
                take: 1,
            },
        },
    })

    if (!strategy) {
        throw new Error('Strategy not found.')
    }

    const version = strategy.versions[0]
    if (!version) {
        throw new Error('Strategy version not found.')
    }

    const sessionData = {
        baseVersionId: version.id,
        symbol: version.symbol,
        timeframe: version.timeframe,
        source: version.source,
        language: version.language,
        engineMode: version.engineMode,
        linkedFixtureId: version.linkedFixtureId,
        runSettingsJson: version.runSettingsJson,
        lastOpenedAt: new Date(),
    }

    if (strategy.workspaceSession) {
        await prisma.strategyWorkspaceSession.update({
            where: { strategyId: strategy.id },
            data: {
                ...sessionData,
                autosaveRevision: {
                    increment: 1,
                },
            },
        })
    } else {
        await prisma.strategyWorkspaceSession.create({
            data: {
                strategyId: strategy.id,
                userId,
                ...sessionData,
                autosaveRevision: 1,
            },
        })
    }

    await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
            asset: version.symbol,
            timeframe: version.timeframe,
            lastOpenedAt: new Date(),
        },
    })

    return buildStrategyRecord(userId, strategy.id)
}

export async function touchStrategyWorkspaceSession(userId: string, strategyId: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId,
        },
        include: {
            workspaceSession: true,
        },
    })

    if (!strategy) {
        return null
    }

    await prisma.strategy.update({
        where: { id: strategy.id },
        data: {
            lastOpenedAt: new Date(),
        },
    })

    if (strategy.workspaceSession) {
        await prisma.strategyWorkspaceSession.update({
            where: { strategyId: strategy.id },
            data: {
                lastOpenedAt: new Date(),
            },
        })
    }

    return buildStrategyRecord(userId, strategy.id)
}

export async function deleteStrategyVersion(userId: string, strategyId: string, versionId: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId,
        },
        include: {
            versions: {
                orderBy: [{ versionNumber: 'desc' }],
            },
        },
    })

    if (!strategy) {
        throw new Error('Strategy not found.')
    }

    const version = strategy.versions.find((entry) => entry.id === versionId)
    if (!version) {
        throw new Error('Strategy version not found.')
    }

    const linkedDeploymentCount = await prisma.strategyDeployment.count({
        where: {
            strategyId,
            strategyVersionId: versionId,
        },
    })

    if (linkedDeploymentCount > 0) {
        throw new Error('Delete blocked because this version is already referenced by a deployment.')
    }

    if (strategy.versions.length === 1) {
        throw new Error('Delete blocked because at least one immutable version must remain.')
    }

    const nextLatest = strategy.versions.find((entry) => entry.id !== versionId) ?? null

    await prisma.$transaction([
        prisma.strategyWorkspaceSession.updateMany({
            where: {
                strategyId,
                baseVersionId: versionId,
            },
            data: {
                baseVersionId: nextLatest?.id ?? null,
            },
        }),
        prisma.strategyVersion.delete({
            where: { id: versionId },
        }),
        prisma.strategy.update({
            where: { id: strategyId },
            data: {
                latestVersionId: strategy.latestVersionId === versionId ? nextLatest?.id ?? null : strategy.latestVersionId,
            },
        }),
    ])

    return buildStrategyRecord(userId, strategyId)
}

export async function deleteStrategyLibraryEntry(userId: string, strategyId: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const strategy = await prisma.strategy.findFirst({
        where: {
            id: strategyId,
            userId,
        },
    })

    if (!strategy) {
        throw new Error('Strategy not found.')
    }

    await prisma.strategy.delete({
        where: { id: strategy.id },
    })
}
