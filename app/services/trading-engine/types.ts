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
}

export interface EquityPoint {
    time: number
    value: number
}

export interface BacktestResult {
    trades: CompletedTrade[]
    equityCurve: EquityPoint[]
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
