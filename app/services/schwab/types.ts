export interface SchwabAccount {
  accountId: string
  accountNumber: string
  type: 'CASH' | 'MARGIN' | 'IRA'
  roundTrips: number
  isDayTrader: boolean
  isClosingOnlyRestricted: boolean
}

export interface SchwabPosition {
  symbol: string
  assetType: 'EQUITY' | 'OPTION' | 'MUTUAL_FUND' | 'FIXED_INCOME'
  quantity: number
  averagePrice: number
  currentPrice: number
  marketValue: number
  unrealizedPL: number
  unrealizedPLPercent: number
  dayPL: number
  dayPLPercent: number
}

export interface SchwabOrder {
  orderId: string
  accountId: string
  symbol: string
  instruction: 'BUY' | 'SELL' | 'BUY_TO_COVER' | 'SELL_SHORT'
  quantity: number
  filledQuantity: number
  remainingQuantity: number
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'
  price?: number
  stopPrice?: number
  status: 'AWAITING_PARENT_ORDER' | 'AWAITING_CONDITION' | 'AWAITING_MANUAL_REVIEW' | 
          'ACCEPTED' | 'AWAITING_UR_OUT' | 'PENDING_ACTIVATION' | 'QUEUED' | 
          'WORKING' | 'REJECTED' | 'PENDING_CANCEL' | 'CANCELED' | 'PENDING_REPLACE' | 
          'REPLACED' | 'FILLED' | 'EXPIRED'
  duration: 'DAY' | 'GTC' | 'FILL_OR_KILL'
  session: 'NORMAL' | 'AM' | 'PM' | 'SEAMLESS'
  enteredTime: string
  closeTime?: string
  tag?: string
}

export interface SchwabQuote {
  symbol: string
  description: string
  bidPrice: number
  askPrice: number
  lastPrice: number
  bidSize: number
  askSize: number
  lastSize: number
  highPrice: number
  lowPrice: number
  openPrice: number
  closePrice: number
  totalVolume: number
  quoteTime: number
  tradeTime: number
  mark: number
  exchange: string
  exchangeName: string
  marginable: boolean
  shortable: boolean
  volatility: number
  digits: number
  '52WkHigh': number
  '52WkLow': number
  nAV: number
  peRatio: number
  divAmount: number
  divYield: number
  divDate: string
  securityStatus: string
  regularMarketLastPrice: number
  regularMarketLastSize: number
  regularMarketNetChange: number
  regularMarketTradeTime: number
}

export interface SchwabCandle {
  open: number
  high: number
  low: number
  close: number
  volume: number
  datetime: number
}

export interface SchwabPriceHistory {
  symbol: string
  empty: boolean
  candles: SchwabCandle[]
}

export interface SchwabStrategy {
  id: string
  name: string
  description: string
  code: string
  symbol: string
  timeframe: string
  enabled: boolean
  accountId: string
  createdAt: string
  updatedAt: string
}

export interface SchwabStrategyExecution {
  id: string
  strategyId: string
  signal: 'BUY' | 'SELL' | 'HOLD'
  price: number
  quantity: number
  timestamp: string
  orderId?: string
  status: 'PENDING' | 'EXECUTED' | 'FAILED' | 'CANCELLED'
  error?: string
}

export interface LiveTradingConfig {
  enabled: boolean
  accountId: string
  maxPositionSize: number
  maxDailyLoss: number
  maxDailyTrades: number
  allowedSymbols: string[]
  riskPerTrade: number
  stopLossPercent: number
  takeProfitPercent: number
}

export interface TradingMetrics {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  winRate: number
  totalPL: number
  averageWin: number
  averageLoss: number
  profitFactor: number
  sharpeRatio: number
  maxDrawdown: number
  currentDrawdown: number
}
