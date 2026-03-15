export type Operator = '>' | '<' | '>=' | '<=' | '==' | 'crosses_above' | 'crosses_below'

export interface Rule {
    indicator: 'RSI' | 'SMA' | 'Price' | 'Volume'
    parameter: number // e.g., 14 for RSI
    operator: Operator
    value: number
}

export interface ConditionSet {
    logic: 'AND' | 'OR'
    rules: Rule[]
}

export interface RiskManagement {
    positionSizingPercent: number
    stopLossPercent?: number
    takeProfitPercent?: number
}

export interface StrategyAST {
    id: string
    name: string
    asset: string
    timeframe: string
    script?: string // Optional Pine-like JS script
    riskManagement: RiskManagement
    entryConditions?: ConditionSet
    exitConditions?: ConditionSet
}

export type SignalType = 'Buy' | 'Sell' | 'Hold'

export interface CompletedTrade {
    id: string
    symbol: string
    side: 'Long' | 'Short'
    entryTime: number
    entryPrice: number
    exitTime: number
    exitPrice: number
    quantity: number
    pnl: number
    pnlPercent: number
    durationBars: number
    entryId?: string
    exitComment?: string
    reportedPositionSize?: number
    cumulativePnl?: number
}

export interface EquityPoint {
    time: number
    value: number
}

export interface BacktestResult {
    trades: CompletedTrade[]
    equityCurve: EquityPoint[]
    diagnostics?: BacktestEngineDiagnostics
    parityComparison?: ParityComparisonResult | null
    metrics: {
        netProfit: number
        netProfitPercent: number
        winRate: number
        totalTrades: number
        maxDrawdown: number
        profitFactor: number
        sharpeRatio: number
        benchmarkReturnPercent: number
    }
}

export type ScriptEngineMode = 'pinets' | 'legacy'
export type ParityFixtureStatus = 'verified-fixture-replay' | 'engine-compare' | 'invalid' | 'live-data-dependent'
export type EngineComparisonMode = 'auto' | 'force-engine' | 'force-replay'
export type BacktestDataSource = 'live-market-data' | 'tradingview-fixture' | 'schwab-snapshot'

export interface StrategyRunSettings {
    initialCapital: number
    defaultQtyType: 'cash' | 'fixed' | 'percent_of_equity'
    defaultQtyValue: number
    pyramiding: number
    commissionPercent: number
    verifyPriceForLimitOrdersTicks: number
    slippageTicks: number
    marginLongPercent: number
    marginShortPercent: number
    calcAfterOrderFilled: boolean
    calcOnEveryTick: boolean
    useBarMagnifier: boolean
    onBarClose: boolean
    useStandardOhlc: boolean
    source?: 'script-header' | 'saved-draft' | 'fixture-manifest'
}

export interface FixtureValidationReport {
    exactTradeWindowMatch: boolean
    candleContinuityOk: boolean
    tradePairingOk: boolean
    fillPricesMatchExpectedBarOpens: boolean
    quantityMatchesSettings: boolean
    timezoneConsistent: boolean
    supportWindowsMatchBaseline: boolean
    supportWindowMismatchCount: number
    supportWindowCount: number
    warnings: string[]
    errors: string[]
}

export interface ParityFixtureManifest {
    fixtureKey: string
    name: string
    symbol: string
    timeframe: string
    source: 'tradingview-fixture' | 'schwab-snapshot'
    candleFileName: string
    tradeFileName: string
    supportCandleFileNames?: string[]
    pineSourceHash: string
    candleHash: string
    candleWindow: {
        firstBarTime: number
        lastBarTime: number
        barCount: number
    }
    runSettings: StrategyRunSettings
    validation: FixtureValidationReport
}

export interface StrategyRuntimeSnapshot {
    time: number
    barIndex: number
    close: number
    openTrades: number
    positionSize: number
    averagePrice: number
    vars: Record<string, unknown>
}

export interface BacktestEngineDiagnostics {
    engineMode: ScriptEngineMode
    dataSource: BacktestDataSource
    comparisonMode?: EngineComparisonMode
    fixtureKey?: string
    fixtureStatus?: ParityFixtureStatus
    fixtureId?: string
    providerOverride?: string
    comparisonReferenceId?: string | null
    normalizedScriptSource?: string
    scriptHeaderSettings?: StrategyRunSettings
    activeRunSettings?: StrategyRunSettings
    firstBarTime?: number
    lastBarTime?: number
    runtimeSnapshots?: StrategyRuntimeSnapshot[]
    actualTradeRows?: NormalizedTradeRecord[]
    fixtureTradeRows?: NormalizedTradeRecord[]
    parityGatePassed?: boolean
    warnings?: string[]
}

export interface NormalizedTradeRecord {
    tradeNumber: number
    type: 'Entry long' | 'Exit long' | 'Entry short' | 'Exit short'
    timestampLabel: string
    price: number
    positionSizeQty: number
    positionSizeValue: number
    netPnl: number
    netPnlPercent: number
    cumulativePnl: number
    cumulativePnlPercent: number
    signal: string
}

export interface ParityComparisonResult {
    fixtureId?: string
    exactMatch: boolean
    matchingTradeCount: number
    expectedTradeCount: number
    actualTradeCount: number
    firstDivergenceTradeNumber?: number
    firstDivergenceField?: string
    firstDivergenceMessage?: string
    firstDivergenceBarTime?: number
    firstDivergenceBarLabel?: string
    firstDivergenceRuntimeVariable?: string
    firstDivergenceRuntimeValue?: unknown
    expectedCumulativePnl?: number
    actualCumulativePnl?: number
}

export interface ParityBatchFixtureResult {
    fixtureKey: string
    fixtureId?: string
    name: string
    symbol: string
    timeframe: string
    status: ParityFixtureStatus
    validation: FixtureValidationReport
    replayComparison: ParityComparisonResult | null
    engineComparison: ParityComparisonResult | null
    replayRuntimeMs: number
    engineRuntimeMs: number
    comparedAt: string
}

export interface ParityBatchReport {
    fixtures: ParityBatchFixtureResult[]
    exactReplayCount: number
    exactEngineCount: number
    divergentCount: number
    invalidCount: number
    totalFixtures: number
}
