import { randomBytes } from 'crypto'
import type { OrderRequest } from '@/app/services/schwab/client'
import type { StrategyRunSettings } from '@/app/services/trading-engine/types'
import prisma from '@/lib/prisma'
import { ensureUserStrategyLibraryHydratedFromLegacyDrafts, getStrategyById } from '@/lib/strategy-library'
import { submitUserSchwabOrder } from '@/lib/trading/schwab-order-service'

type DeploymentTarget = 'paper' | 'schwab-live'
type DeploymentStatus = 'active' | 'paused' | 'error'
type MarketDataSourceMode = 'live-data-dependent' | 'exact-fixture-replay' | 'engine-compare' | 'schwab-snapshot'

interface StrategyDeploymentInput {
    linkedScriptDraftId?: string | null
    strategyId?: string | null
    strategyVersionId?: string | null
    name: string
    description?: string | null
    symbol: string
    timeframe: string
    target?: DeploymentTarget
    status?: DeploymentStatus
    linkedAccountId?: string | null
    marketDataSource?: MarketDataSourceMode
    runSettings?: StrategyRunSettings | null
    executionConfig?: {
        defaultQuantity?: number
        orderType?: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'
        session?: OrderRequest['session']
        duration?: OrderRequest['duration']
        autoSubmit?: boolean
    } | null
}

interface RawExecutionNodeConfigRecord extends Record<string, unknown> {
    nodeType: string
    configJson: string
}

interface RawStrategyRunRecord extends Record<string, unknown> {
    summaryJson?: string | null
    diagnosticsJson?: string | null
}

interface RawStrategySignalEventRecord extends Record<string, unknown> {
    payloadJson: string
    normalizedPayloadJson?: string | null
}

interface RawExecutionIntentRecord extends Record<string, unknown> {
    requestJson?: string | null
    responseJson?: string | null
}

interface RawDeploymentRecord extends Record<string, unknown> {
    webhookEndpoint?: { secret: string } | null
    webhookSecret?: string | null
    runSettingsJson?: string | null
    executionNodeConfigs?: RawExecutionNodeConfigRecord[]
    runs?: RawStrategyRunRecord[]
    signalEvents?: RawStrategySignalEventRecord[]
    executionIntents?: RawExecutionIntentRecord[]
}

interface DeploymentExecutionContext {
    id: string
    target: string
    linkedAccountId: string | null
    executionNodeConfigs?: RawExecutionNodeConfigRecord[]
}

function normalizeSymbol(symbol: string) {
    return symbol.trim().toUpperCase()
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

function createWebhookSecret() {
    return randomBytes(18).toString('hex')
}

function buildDefaultNodeConfigs(input?: StrategyDeploymentInput['executionConfig']) {
    return [
        {
            nodeType: 'trigger',
            label: 'TradingView Webhook',
            orderIndex: 0,
            configJson: JSON.stringify({ source: 'tradingview' }),
        },
        {
            nodeType: 'signal-parse',
            label: 'Signal Parse',
            orderIndex: 10,
            configJson: JSON.stringify({ acceptedActions: ['buy', 'sell', 'close'] }),
        },
        {
            nodeType: 'risk-gate',
            label: 'Risk Gate',
            orderIndex: 20,
            configJson: JSON.stringify({ enabled: true }),
        },
        {
            nodeType: 'position-gate',
            label: 'Position Gate',
            orderIndex: 30,
            configJson: JSON.stringify({ allowMultiple: false }),
        },
        {
            nodeType: 'execution',
            label: 'Execution',
            orderIndex: 40,
            configJson: JSON.stringify({
                defaultQuantity: input?.defaultQuantity ?? 1,
                orderType: input?.orderType ?? 'MARKET',
                session: input?.session ?? 'NORMAL',
                duration: input?.duration ?? 'DAY',
                autoSubmit: input?.autoSubmit ?? true,
            }),
        },
        {
            nodeType: 'notification-log',
            label: 'Notification Log',
            orderIndex: 50,
            configJson: JSON.stringify({ enabled: true }),
        },
    ]
}

async function resolveStrategyReferences(userId: string, input: StrategyDeploymentInput) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    if (input.strategyId) {
        const strategy = await getStrategyById(userId, input.strategyId)
        if (!strategy) {
            throw new Error('Linked strategy not found.')
        }

        const resolvedVersionId = input.strategyVersionId ?? strategy.latestVersionId ?? strategy.workspaceSession?.baseVersionId ?? null
        return {
            strategyId: strategy.id,
            strategyVersionId: resolvedVersionId,
        }
    }

    if (!input.linkedScriptDraftId) {
        return {
            strategyId: null,
            strategyVersionId: null,
        }
    }

    const strategy = await prisma.strategy.findFirst({
        where: {
            userId,
            legacyScriptDraftId: input.linkedScriptDraftId,
        },
        include: {
            latestVersion: true,
            workspaceSession: true,
        },
    })

    return {
        strategyId: strategy?.id ?? null,
        strategyVersionId: strategy?.latestVersionId ?? strategy?.workspaceSession?.baseVersionId ?? null,
    }
}

function normalizeDeploymentRecord(record: RawDeploymentRecord, origin?: string) {
    const secret = record.webhookEndpoint?.secret || record.webhookSecret
    const webhookPath = secret ? `/api/tradingview/webhook/${secret}` : null
    return {
        ...record,
        runSettings: parseJson<StrategyRunSettings | null>(record.runSettingsJson, null),
        nodeConfigs: Array.isArray(record.executionNodeConfigs)
            ? record.executionNodeConfigs.map((node) => ({
                ...node,
                config: parseJson<Record<string, unknown>>(node.configJson, {}),
            }))
            : [],
        runs: Array.isArray(record.runs)
            ? record.runs.map((run) => ({
                ...run,
                summary: parseJson<Record<string, unknown> | null>(run.summaryJson, null),
                diagnostics: parseJson<Record<string, unknown> | null>(run.diagnosticsJson, null),
            }))
            : [],
        signalEvents: Array.isArray(record.signalEvents)
            ? record.signalEvents.map((event) => ({
                ...event,
                payload: parseJson<Record<string, unknown> | null>(event.payloadJson, null),
                normalizedPayload: parseJson<Record<string, unknown> | null>(event.normalizedPayloadJson, null),
            }))
            : [],
        executionIntents: Array.isArray(record.executionIntents)
            ? record.executionIntents.map((intent) => ({
                ...intent,
                request: parseJson<Record<string, unknown> | null>(intent.requestJson, null),
                response: parseJson<Record<string, unknown> | null>(intent.responseJson, null),
            }))
            : [],
        webhookUrl: secret
            ? origin
                ? `${origin}${webhookPath}`
                : webhookPath
            : null,
    }
}

export async function listStrategyDeployments(userId: string, origin?: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const deployments = await prisma.strategyDeployment.findMany({
        where: { userId },
        include: {
            linkedScriptDraft: true,
            strategy: true,
            strategyVersion: true,
            webhookEndpoint: true,
            executionNodeConfigs: {
                orderBy: { orderIndex: 'asc' },
            },
            runs: {
                take: 10,
                orderBy: { createdAt: 'desc' },
            },
            signalEvents: {
                take: 10,
                orderBy: { receivedAt: 'desc' },
            },
            executionIntents: {
                take: 10,
                orderBy: { createdAt: 'desc' },
            },
        },
        orderBy: [{ updatedAt: 'desc' }],
    })

    return deployments.map((deployment) => normalizeDeploymentRecord(deployment, origin))
}

export async function getStrategyDeployment(userId: string, id: string, origin?: string) {
    await ensureUserStrategyLibraryHydratedFromLegacyDrafts(userId)

    const deployment = await prisma.strategyDeployment.findFirst({
        where: {
            id,
            userId,
        },
        include: {
            linkedScriptDraft: true,
            strategy: true,
            strategyVersion: true,
            webhookEndpoint: true,
            executionNodeConfigs: {
                orderBy: { orderIndex: 'asc' },
            },
            runs: {
                take: 25,
                orderBy: { createdAt: 'desc' },
            },
            signalEvents: {
                take: 25,
                orderBy: { receivedAt: 'desc' },
            },
            executionIntents: {
                take: 25,
                orderBy: { createdAt: 'desc' },
            },
        },
    })

    return deployment ? normalizeDeploymentRecord(deployment, origin) : null
}

export async function createStrategyDeployment(userId: string, input: StrategyDeploymentInput, origin?: string) {
    const name = input.name.trim()
    const symbol = normalizeSymbol(input.symbol)
    const timeframe = input.timeframe.trim() || '1d'

    if (!name) {
        throw new Error('Deployment name is required.')
    }

    if (!symbol) {
        throw new Error('Deployment symbol is required.')
    }

    const strategyReferences = await resolveStrategyReferences(userId, input)
    const webhookSecret = createWebhookSecret()
    const deployment = await prisma.strategyDeployment.create({
        data: {
            userId,
            linkedScriptDraftId: input.linkedScriptDraftId ?? null,
            strategyId: strategyReferences.strategyId,
            strategyVersionId: strategyReferences.strategyVersionId,
            name,
            description: input.description?.trim() || null,
            symbol,
            timeframe,
            target: input.target ?? 'paper',
            status: input.status ?? 'active',
            linkedAccountId: input.linkedAccountId ?? null,
            marketDataSource: input.marketDataSource ?? 'live-data-dependent',
            webhookSecret,
            runSettingsJson: input.runSettings ? JSON.stringify(input.runSettings) : null,
            webhookEndpoint: {
                create: {
                    secret: webhookSecret,
                    isEnabled: true,
                },
            },
            executionNodeConfigs: {
                create: buildDefaultNodeConfigs(input.executionConfig),
            },
        },
        include: {
            linkedScriptDraft: true,
            strategy: true,
            strategyVersion: true,
            webhookEndpoint: true,
            executionNodeConfigs: {
                orderBy: { orderIndex: 'asc' },
            },
            runs: true,
            signalEvents: true,
            executionIntents: true,
        },
    })

    return normalizeDeploymentRecord(deployment, origin)
}

export async function updateStrategyDeployment(
    userId: string,
    id: string,
    patch: Partial<StrategyDeploymentInput> & {
        nodeConfigs?: Array<{
            id?: string
            nodeType: string
            label: string
            isEnabled?: boolean
            orderIndex?: number
            config: Record<string, unknown>
        }>
    },
    origin?: string
) {
    const existing = await prisma.strategyDeployment.findFirst({
        where: { id, userId },
        include: { executionNodeConfigs: true },
    })

    if (!existing) {
        throw new Error('Strategy deployment not found.')
    }

    if (Array.isArray(patch.nodeConfigs)) {
        await prisma.executionNodeConfig.deleteMany({
            where: { deploymentId: existing.id },
        })

        if (patch.nodeConfigs.length > 0) {
            await prisma.executionNodeConfig.createMany({
                data: patch.nodeConfigs.map((node) => ({
                    deploymentId: existing.id,
                    nodeType: node.nodeType,
                    label: node.label,
                    isEnabled: node.isEnabled ?? true,
                    orderIndex: node.orderIndex ?? 0,
                    configJson: JSON.stringify(node.config ?? {}),
                })),
            })
        }
    }

    const deployment = await prisma.strategyDeployment.update({
        where: { id: existing.id },
        data: {
            linkedScriptDraftId: patch.linkedScriptDraftId ?? existing.linkedScriptDraftId,
            strategyId: patch.strategyId ?? existing.strategyId,
            strategyVersionId: patch.strategyVersionId ?? existing.strategyVersionId,
            name: patch.name?.trim() || existing.name,
            description: patch.description !== undefined ? patch.description?.trim() || null : existing.description,
            symbol: patch.symbol ? normalizeSymbol(patch.symbol) : existing.symbol,
            timeframe: patch.timeframe?.trim() || existing.timeframe,
            target: patch.target ?? existing.target,
            status: patch.status ?? existing.status,
            linkedAccountId: patch.linkedAccountId !== undefined ? patch.linkedAccountId : existing.linkedAccountId,
            marketDataSource: patch.marketDataSource ?? existing.marketDataSource,
            runSettingsJson: patch.runSettings !== undefined
                ? patch.runSettings
                    ? JSON.stringify(patch.runSettings)
                    : null
                : existing.runSettingsJson,
        },
        include: {
            linkedScriptDraft: true,
            strategy: true,
            strategyVersion: true,
            webhookEndpoint: true,
            executionNodeConfigs: {
                orderBy: { orderIndex: 'asc' },
            },
            runs: {
                take: 25,
                orderBy: { createdAt: 'desc' },
            },
            signalEvents: {
                take: 25,
                orderBy: { receivedAt: 'desc' },
            },
            executionIntents: {
                take: 25,
                orderBy: { createdAt: 'desc' },
            },
        },
    })

    return normalizeDeploymentRecord(deployment, origin)
}

export async function deleteStrategyDeployment(userId: string, id: string) {
    const existing = await prisma.strategyDeployment.findFirst({
        where: { id, userId },
    })

    if (!existing) {
        throw new Error('Strategy deployment not found.')
    }

    await prisma.strategyDeployment.delete({
        where: { id: existing.id },
    })
}

function normalizeAction(value: unknown) {
    const raw = String(value ?? '').trim().toLowerCase()
    if (!raw) {
        return null
    }
    if (raw.includes('buy') || raw.includes('long')) {
        return 'BUY'
    }
    if (raw.includes('sell') || raw.includes('short')) {
        return 'SELL'
    }
    if (raw.includes('close') || raw.includes('exit')) {
        return 'SELL'
    }
    return raw.toUpperCase()
}

function normalizeWebhookPayload(
    payload: Record<string, unknown>,
    deployment: {
        symbol: string
        timeframe: string
    }
) {
    const symbol = normalizeSymbol(String(payload.symbol || payload.ticker || deployment.symbol))
    const timeframe = String(payload.timeframe || payload.interval || deployment.timeframe || '1d')
    const action = normalizeAction(payload.action || payload.side || payload.signal || payload.order_action || payload.message)
    const quantity = Number(payload.quantity ?? payload.qty ?? 0)
    const price = Number(payload.price ?? payload.close ?? payload.last ?? 0)
    const orderTypeRaw = String(payload.orderType || payload.order_type || 'MARKET').toUpperCase()
    const orderType: OrderRequest['orderType'] = orderTypeRaw === 'LIMIT' || orderTypeRaw === 'STOP' || orderTypeRaw === 'STOP_LIMIT'
        ? orderTypeRaw
        : 'MARKET'

    return {
        eventType: String(payload.event || payload.type || 'alert'),
        symbol,
        timeframe,
        action,
        quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : null,
        price: Number.isFinite(price) && price > 0 ? price : null,
        orderType,
    }
}

async function executeIntentForDeployment(args: {
    userId: string
    deployment: DeploymentExecutionContext
    strategyRunId: string
    signalEventId: string
    symbol: string
    action: string
    quantity: number
    price: number | null
    orderType: OrderRequest['orderType']
}) {
    const executionNode = (args.deployment.executionNodeConfigs || []).find((node) => node.nodeType === 'execution')
    const executionConfig = parseJson<{
        defaultQuantity?: number
        orderType?: OrderRequest['orderType']
        session?: OrderRequest['session']
        duration?: OrderRequest['duration']
        autoSubmit?: boolean
    }>(executionNode?.configJson, {})

    const quantity = args.quantity || executionConfig.defaultQuantity || 1
    const orderType = args.orderType || executionConfig.orderType || 'MARKET'
    const orderRequest: OrderRequest = {
        symbol: args.symbol,
        quantity,
        instruction: args.action === 'BUY' ? 'BUY' : 'SELL',
        orderType,
        duration: executionConfig.duration || 'DAY',
        session: executionConfig.session || 'NORMAL',
        price: orderType === 'LIMIT' || orderType === 'STOP_LIMIT' ? args.price ?? undefined : undefined,
        stopPrice: orderType === 'STOP' || orderType === 'STOP_LIMIT' ? args.price ?? undefined : undefined,
    }

    const intent = await prisma.executionIntent.create({
        data: {
            deploymentId: args.deployment.id,
            strategyRunId: args.strategyRunId,
            signalEventId: args.signalEventId,
            status: 'pending',
            mode: args.deployment.target,
            broker: args.deployment.target === 'schwab-live' ? 'schwab' : 'paper',
            accountId: args.deployment.linkedAccountId,
            symbol: args.symbol,
            side: args.action,
            orderType,
            quantity,
            limitPrice: orderRequest.price ?? null,
            stopPrice: orderRequest.stopPrice ?? null,
            requestJson: JSON.stringify(orderRequest),
        },
    })

    if (args.deployment.target !== 'schwab-live') {
        return prisma.executionIntent.update({
            where: { id: intent.id },
            data: {
                status: 'recorded',
                responseJson: JSON.stringify({
                    mode: 'paper',
                    message: 'Paper execution intent recorded.',
                }),
            },
        })
    }

    const submission = await submitUserSchwabOrder(args.userId, args.deployment.linkedAccountId, orderRequest)
    return prisma.executionIntent.update({
        where: { id: intent.id },
        data: {
            status: 'submitted',
            accountId: submission.accountId,
            responseJson: JSON.stringify(submission.response),
        },
    })
}

export async function ingestTradingViewWebhook(secret: string, payload: Record<string, unknown>, rawBody: string) {
    const endpoint = await prisma.strategyWebhookEndpoint.findUnique({
        where: { secret },
        include: {
            deployment: {
                include: {
                    executionNodeConfigs: {
                        orderBy: { orderIndex: 'asc' },
                    },
                },
            },
        },
    })

    if (!endpoint || !endpoint.isEnabled) {
        throw new Error('Webhook endpoint not found.')
    }

    if (endpoint.deployment.status !== 'active') {
        throw new Error('Deployment is not active.')
    }

    const normalized = normalizeWebhookPayload(payload, endpoint.deployment)
    const signalEvent = await prisma.strategySignalEvent.create({
        data: {
            deploymentId: endpoint.deployment.id,
            source: 'tradingview',
            eventType: normalized.eventType,
            symbol: normalized.symbol,
            timeframe: normalized.timeframe,
            action: normalized.action,
            payloadJson: JSON.stringify(payload),
            normalizedPayloadJson: JSON.stringify({
                ...normalized,
                rawBody,
            }),
        },
    })

    const strategyRun = await prisma.strategyRun.create({
        data: {
            deploymentId: endpoint.deployment.id,
            status: normalized.action ? 'executing' : 'received',
            summaryJson: JSON.stringify({
                symbol: normalized.symbol,
                timeframe: normalized.timeframe,
                action: normalized.action,
            }),
            diagnosticsJson: JSON.stringify({
                executionNodes: endpoint.deployment.executionNodeConfigs.map((node) => ({
                    nodeType: node.nodeType,
                    isEnabled: node.isEnabled,
                })),
            }),
        },
    })

    await prisma.strategySignalEvent.update({
        where: { id: signalEvent.id },
        data: {
            strategyRunId: strategyRun.id,
            status: normalized.action ? 'processed' : 'logged',
        },
    })

    let executionIntent = null
    let runStatus = normalized.action ? 'executed' : 'logged'
    let lastError: string | null = null

    if (normalized.action) {
        try {
            executionIntent = await executeIntentForDeployment({
                userId: endpoint.deployment.userId,
                deployment: endpoint.deployment,
                strategyRunId: strategyRun.id,
                signalEventId: signalEvent.id,
                symbol: normalized.symbol,
                action: normalized.action,
                quantity: normalized.quantity ?? 0,
                price: normalized.price,
                orderType: normalized.orderType,
            })
        } catch (error) {
            runStatus = 'failed'
            lastError = error instanceof Error ? error.message : 'Execution failed.'
            executionIntent = await prisma.executionIntent.create({
                data: {
                    deploymentId: endpoint.deployment.id,
                    strategyRunId: strategyRun.id,
                    signalEventId: signalEvent.id,
                    status: 'failed',
                    mode: endpoint.deployment.target,
                    broker: endpoint.deployment.target === 'schwab-live' ? 'schwab' : 'paper',
                    accountId: endpoint.deployment.linkedAccountId,
                    symbol: normalized.symbol,
                    side: normalized.action,
                    orderType: normalized.orderType,
                    quantity: normalized.quantity ?? null,
                    requestJson: JSON.stringify(payload),
                    errorMessage: lastError,
                },
            })
        }
    }

    await prisma.strategyRun.update({
        where: { id: strategyRun.id },
        data: {
            status: runStatus,
            completedAt: new Date(),
        },
    })

    await prisma.strategyWebhookEndpoint.update({
        where: { id: endpoint.id },
        data: {
            lastTriggeredAt: new Date(),
        },
    })

    await prisma.strategyDeployment.update({
        where: { id: endpoint.deployment.id },
        data: {
            lastSignalAt: new Date(),
            lastRunAt: new Date(),
            lastError,
            status: lastError ? 'error' : endpoint.deployment.status,
        },
    })

    return {
        deploymentId: endpoint.deployment.id,
        signalEventId: signalEvent.id,
        strategyRunId: strategyRun.id,
        executionIntentId: executionIntent?.id ?? null,
        status: runStatus,
    }
}
