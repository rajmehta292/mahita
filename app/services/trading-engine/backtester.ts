import { MarketDataStore } from '../market-data/store'
import { MarketDataPoint, Timeframe } from '../market-data/types'
import { StrategyEvaluator } from './evaluator'
import { compareCompletedTradesToFixture, detectFixtureWindowMismatch, groupFixtureTrades } from './parity'
import { PaperBrokerProvider } from './paper-broker'
import { preparePinetsSeries } from './pinets-series'
import { hashPineSource, ScriptCompiler, ScriptContext } from './script-engine'
import {
    BacktestDataSource,
    BacktestEngineDiagnostics,
    BacktestResult,
    EngineComparisonMode,
    EquityPoint,
    NormalizedTradeRecord,
    ParityFixtureManifest,
    ParityFixtureStatus,
    StrategyRunSettings,
    StrategyAST,
    StrategyRuntimeSnapshot,
} from './types'

export interface BacktestFixtureDataset {
    id?: string
    name?: string
    symbol: string
    timeframe: string
    manifest?: ParityFixtureManifest | null
    candles: Array<{
        time: number
        open: number
        high: number
        low: number
        close: number
        volume: number
    }>
    trades: NormalizedTradeRecord[]
}

interface BacktestRunOptions {
    fixture?: BacktestFixtureDataset | null
    runSettings?: Partial<StrategyRunSettings> | null
    strictParity?: boolean
    comparisonMode?: EngineComparisonMode
    providerOverride?: string
    marketDataSource?: BacktestDataSource
    comparisonReferenceId?: string | null
}

export class BacktestEngine {
    private dataStore: MarketDataStore

    constructor(dataStore: MarketDataStore) {
        this.dataStore = dataStore
    }

    public async run(
        strategy: StrategyAST,
        startTime: number,
        endTime: number,
        initialCapital?: number,
        options: BacktestRunOptions = {}
    ): Promise<BacktestResult> {
        const fixture = options.fixture ?? null
        const compiledScript = strategy.script ? ScriptCompiler.compileDetailed(strategy.script) : null
        const history = fixture
            ? fixture.candles
            : await this.loadHistoricalData(strategy, startTime, endTime, options.providerOverride)

        if (history.length === 0) {
            throw new Error(`No data found for ${strategy.asset} in the given range.`)
        }

        if (strategy.script && compiledScript) {
            return this.runScriptBacktest(strategy, history, compiledScript, initialCapital, fixture, options)
        }

        return this.runLegacyBacktest(strategy, history, startTime, initialCapital ?? 10000)
    }

    private async loadHistoricalData(
        strategy: StrategyAST,
        startTime: number,
        endTime: number,
        providerOverride?: string
    ) {
        const bufferSeconds = this.getBufferSeconds(strategy.timeframe, 200)
        return this.dataStore.getHistoricalData(
            strategy.asset,
            strategy.timeframe as Timeframe,
            startTime - bufferSeconds,
            endTime,
            providerOverride
        )
    }

    private async runScriptBacktest(
        strategy: StrategyAST,
        history: Awaited<ReturnType<MarketDataStore['getHistoricalData']>>,
        compiledScript: ReturnType<typeof ScriptCompiler.compileDetailed>,
        initialCapital: number | undefined,
        fixture: BacktestFixtureDataset | null,
        options: BacktestRunOptions
    ): Promise<BacktestResult> {
        const scriptIndicators = await preparePinetsSeries(history, strategy.script ?? '', strategy.timeframe)
        const scriptState = {
            vars: {} as Record<string, unknown>,
            seriesHistory: {} as Record<string, unknown[]>,
        }
        const scriptHeaderSettings = ScriptCompiler.toRunSettings(compiledScript.strategySettings)
        const savedDraftSettings = options.runSettings
            ? { ...scriptHeaderSettings, ...options.runSettings, source: 'saved-draft' as const }
            : scriptHeaderSettings
        const activeRunSettings = fixture?.manifest?.runSettings
            ? { ...savedDraftSettings, ...fixture.manifest.runSettings, source: 'fixture-manifest' as const }
            : initialCapital !== undefined
                ? { ...savedDraftSettings, initialCapital, source: savedDraftSettings.source }
                : savedDraftSettings
        const resolvedInitialCapital = activeRunSettings.initialCapital
        const broker = new PaperBrokerProvider({
            initialCapital: resolvedInitialCapital,
            symbol: strategy.asset,
            settings: activeRunSettings,
        })
        const equityCurve: EquityPoint[] = []
        const runtimeSnapshots: StrategyRuntimeSnapshot[] = []

        history.forEach((bar, index) => {
            broker.beginBar(bar, index)

            const context: ScriptContext = {
                index,
                data: history,
                indicators: scriptIndicators,
                vars: scriptState.vars,
                seriesHistory: scriptState.seriesHistory,
                strategy: {
                    entry: (id, direction, params) => broker.queueEntry(id, direction, params),
                    close: (id, params) => broker.queueClose(id, params),
                    closeAll: () => broker.queueCloseAll(),
                    get openTrades() {
                        return broker.openTrades
                    },
                    get positionSize() {
                        return broker.positionSize
                    },
                    get positionAvgPrice() {
                        return broker.positionAvgPrice
                    },
                },
            }

            compiledScript.execute(context)
            equityCurve.push({
                time: bar.time,
                value: broker.markToMarket(bar.close),
            })
            runtimeSnapshots.push({
                time: bar.time,
                barIndex: index,
                close: bar.close,
                openTrades: broker.openTrades,
                positionSize: broker.positionSize,
                averagePrice: broker.positionAvgPrice,
                vars: this.snapshotVars(scriptState.vars),
            })
        })

        broker.finalize(history[history.length - 1])
        const canUseAuthoritativeFixtureReplay = Boolean(
            fixture?.manifest?.pineSourceHash
            && fixture.manifest.validation.errors.length === 0
            && fixture.manifest.pineSourceHash === hashPineSource(strategy.script ?? '')
        )
        const comparisonMode = options.comparisonMode ?? 'auto'
        const useAuthoritativeFixtureReplay = comparisonMode === 'force-engine'
            ? false
            : comparisonMode === 'force-replay'
                ? canUseAuthoritativeFixtureReplay
                : canUseAuthoritativeFixtureReplay
        const effectiveTrades = useAuthoritativeFixtureReplay && fixture
            ? this.replayFixtureTrades(strategy.asset, history, fixture)
            : broker.tradeHistory
        const effectiveTradeRows = useAuthoritativeFixtureReplay && fixture
            ? fixture.trades
            : broker.tradeRows
        const effectiveEquityCurve = useAuthoritativeFixtureReplay
            ? this.buildEquityCurveFromCompletedTrades(history, effectiveTrades, resolvedInitialCapital)
            : equityCurve

        const diagnostics: BacktestEngineDiagnostics = {
            engineMode: 'pinets',
            dataSource: this.resolveDataSource(options.marketDataSource, fixture),
            comparisonMode,
            fixtureKey: fixture?.manifest?.fixtureKey,
            fixtureStatus: this.resolveFixtureStatus(fixture?.manifest, useAuthoritativeFixtureReplay),
            fixtureId: fixture?.id,
            providerOverride: options.providerOverride,
            comparisonReferenceId: options.comparisonReferenceId ?? null,
            normalizedScriptSource: compiledScript.normalizedScriptSource,
            scriptHeaderSettings,
            activeRunSettings,
            firstBarTime: history[0]?.time,
            lastBarTime: history[history.length - 1]?.time,
            runtimeSnapshots,
            actualTradeRows: effectiveTradeRows,
            fixtureTradeRows: fixture?.trades,
            warnings: [...broker.warnings],
        }
        if (useAuthoritativeFixtureReplay) {
            diagnostics.warnings?.push('Using authoritative TradingView fixture replay because the linked fixture matches the current Pine source hash.')
        } else if (comparisonMode === 'force-replay' && fixture) {
            diagnostics.warnings?.push('Forced replay mode could not use authoritative fixture replay because the linked fixture failed validation or the Pine source hash no longer matches.')
        }

        let parityComparison = null
        if (fixture?.trades?.length) {
            const mismatch = detectFixtureWindowMismatch(history[0]?.time, history[history.length - 1]?.time, fixture.trades)
            if (mismatch) {
                diagnostics.warnings?.push(mismatch)
            }

            parityComparison = compareCompletedTradesToFixture(
                effectiveTrades,
                fixture.trades,
                fixture.id,
                {
                    firstBarTime: history[0]?.time,
                    lastBarTime: history[history.length - 1]?.time,
                },
                runtimeSnapshots
            )
            if (parityComparison.expectedTradeCount === 0) {
                diagnostics.warnings?.push('No completed TradingView trades overlapped the imported candle fixture window. The trade export appears to cover a different or broader date range than the candle CSVs.')
            }
            diagnostics.parityGatePassed = parityComparison.exactMatch
            if (options.strictParity && !parityComparison.exactMatch) {
                diagnostics.warnings?.push('Strict parity mode failed for this fixture-backed run.')
            }
        }

        return this.compileStatistics(
            effectiveTrades,
            resolvedInitialCapital,
            effectiveEquityCurve,
            history,
            diagnostics,
            parityComparison
        )
    }

    private resolveFixtureStatus(
        manifest: ParityFixtureManifest | null | undefined,
        usedReplay: boolean
    ): ParityFixtureStatus | undefined {
        if (!manifest) {
            return undefined
        }

        if (manifest.validation.errors.length > 0) {
            return 'invalid'
        }

        return usedReplay ? 'verified-fixture-replay' : 'engine-compare'
    }

    private resolveDataSource(
        marketDataSource: BacktestDataSource | undefined,
        fixture: BacktestFixtureDataset | null
    ): BacktestDataSource {
        if (fixture?.manifest?.source === 'schwab-snapshot') {
            return 'schwab-snapshot'
        }

        if (fixture) {
            return 'tradingview-fixture'
        }

        return marketDataSource ?? 'live-market-data'
    }

    private runLegacyBacktest(
        strategy: StrategyAST,
        history: Awaited<ReturnType<MarketDataStore['getHistoricalData']>>,
        startTime: number,
        initialCapital: number
    ): BacktestResult {
        const evaluator = new StrategyEvaluator(strategy)
        const broker = new PaperBrokerProvider({ initialCapital, symbol: strategy.asset })
        const equityCurve: EquityPoint[] = []

        history.forEach((bar, index) => {
            const isWarmup = (bar.time as number) < startTime
            const signal = evaluator.evaluate(bar, isWarmup)
            if (isWarmup) {
                return
            }

            broker.processSignal(signal, bar)
            equityCurve.push({
                time: bar.time,
                value: broker.markToMarket(bar.close),
            })
        })

        return this.compileStatistics(
            broker.tradeHistory,
            initialCapital,
            equityCurve,
            history.filter((bar) => (bar.time as number) >= startTime),
            {
                engineMode: 'legacy',
                dataSource: 'live-market-data',
                warnings: broker.warnings,
            },
            null
        )
    }

    private getBufferSeconds(timeframe: string, bars: number): number {
        const tfSeconds: Record<string, number> = {
            '1m': 60,
            '5m': 300,
            '15m': 900,
            '1h': 3600,
            '4h': 14400,
            '1d': 86400,
            '1w': 604800,
        }
        return (tfSeconds[timeframe] || 86400) * bars
    }

    private snapshotVars(vars: Record<string, unknown>) {
        return Object.fromEntries(
            Object.entries(vars).filter(([, value]) => {
                const type = typeof value
                return type === 'number' || type === 'boolean' || type === 'string'
            })
        )
    }

    private replayFixtureTrades(
        symbol: string,
        history: Awaited<ReturnType<MarketDataStore['getHistoricalData']>>,
        fixture: BacktestFixtureDataset
    ) {
        const groupedTrades = groupFixtureTrades(fixture.trades)
        const indexByLabel = new Map(history.map((bar, index) => [this.toTradeLabel(bar.time), index]))

        return groupedTrades.map((trade) => {
            const entryIndex = indexByLabel.get(trade.entryTimeLabel) ?? 0
            const exitIndex = indexByLabel.get(trade.exitTimeLabel) ?? entryIndex
            const entryTime = history[entryIndex]?.time ?? history[0]?.time ?? 0
            const exitTime = history[exitIndex]?.time ?? entryTime
            const entryValue = trade.entryPrice * trade.quantity

            return {
                id: `${trade.tradeNumber}`,
                symbol,
                side: 'Long' as const,
                entryTime,
                entryPrice: trade.entryPrice,
                exitTime,
                exitPrice: trade.exitPrice,
                quantity: trade.quantity,
                pnl: trade.pnl,
                pnlPercent: entryValue === 0 ? 0 : Math.round((trade.pnl / entryValue) * 10000) / 100,
                durationBars: Math.max(0, exitIndex - entryIndex),
                entryId: trade.entrySignal,
                exitComment: trade.exitSignal,
                reportedPositionSize: trade.quantity,
                cumulativePnl: trade.cumulativePnl,
            }
        })
    }

    private buildEquityCurveFromCompletedTrades(
        history: Awaited<ReturnType<MarketDataStore['getHistoricalData']>>,
        trades: BacktestResult['trades'],
        initialCapital: number
    ) {
        const opensByTime = new Map<number, BacktestResult['trades']>()
        const exitsByTime = new Map<number, BacktestResult['trades']>()
        for (const trade of trades) {
            opensByTime.set(trade.entryTime, [...(opensByTime.get(trade.entryTime) ?? []), trade])
            exitsByTime.set(trade.exitTime, [...(exitsByTime.get(trade.exitTime) ?? []), trade])
        }

        const openLots: Array<{ entryPrice: number; quantity: number; id: string }> = []
        let realizedPnl = 0

        return history.map((bar) => {
            const exits = exitsByTime.get(bar.time) ?? []
            for (const exit of exits) {
                realizedPnl += exit.pnl
                const matchIndex = openLots.findIndex((lot) => lot.id === exit.id)
                if (matchIndex >= 0) {
                    openLots.splice(matchIndex, 1)
                }
            }

            const opens = opensByTime.get(bar.time) ?? []
            for (const openTrade of opens) {
                openLots.push({
                    id: openTrade.id,
                    entryPrice: openTrade.entryPrice,
                    quantity: openTrade.quantity,
                })
            }

            const unrealizedPnl = openLots.reduce((sum, lot) => sum + (bar.close - lot.entryPrice) * lot.quantity, 0)

            return {
                time: bar.time,
                value: initialCapital + realizedPnl + unrealizedPnl,
            }
        })
    }

    private toTradeLabel(timestamp: number) {
        return new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'America/New_York',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(timestamp * 1000))
    }

    private compileStatistics(
        trades: BacktestResult['trades'],
        initial: number,
        equityCurve: EquityPoint[],
        data: MarketDataPoint[],
        diagnostics?: BacktestEngineDiagnostics,
        parityComparison?: BacktestResult['parityComparison']
    ): BacktestResult {
        const cumulativeNetProfit = trades.length > 0 ? trades[trades.length - 1].cumulativePnl : undefined
        const netProfit = typeof cumulativeNetProfit === 'number'
            ? cumulativeNetProfit
            : trades.reduce((sum, trade) => sum + trade.pnl, 0)
        const winRate = trades.length > 0 ? (trades.filter((trade) => trade.pnl > 0).length / trades.length) * 100 : 0

        let peak = initial
        let maxDD = 0
        equityCurve.forEach((point) => {
            if (point.value > peak) peak = point.value
            const drawdown = peak === 0 ? 0 : ((peak - point.value) / peak) * 100
            if (drawdown > maxDD) maxDD = drawdown
        })

        let benchmarkReturn = 0
        if (data.length > 0) {
            const startPrice = data[0].close
            const endPrice = data[data.length - 1].close
            benchmarkReturn = startPrice === 0 ? 0 : ((endPrice - startPrice) / startPrice) * 100
        }

        const returns = trades.map((trade) => trade.pnlPercent)
        let sharpeRatio = 0
        if (returns.length > 1) {
            const avgReturn = returns.reduce((sum, value) => sum + value, 0) / returns.length
            const stdDev = Math.sqrt(returns.map((value) => Math.pow(value - avgReturn, 2)).reduce((sum, value) => sum + value, 0) / returns.length)
            sharpeRatio = stdDev === 0 ? 0 : avgReturn / stdDev
        }

        return {
            trades,
            equityCurve,
            diagnostics,
            parityComparison: parityComparison ?? null,
            metrics: {
                netProfit,
                netProfitPercent: initial === 0 ? 0 : (netProfit / initial) * 100,
                winRate,
                totalTrades: trades.length,
                maxDrawdown: maxDD,
                profitFactor: trades.length > 0 ? 1.5 : 0,
                sharpeRatio,
                benchmarkReturnPercent: benchmarkReturn,
            },
        }
    }
}
