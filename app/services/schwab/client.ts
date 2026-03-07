// @ts-ignore - The third party typings don't resolve properly with nextJS exports map
import { TDAmeritradeAPI } from '@allensarkisyan/schwab-td-ameritrade-api'

export interface SchwabConfig {
  clientId: string
  callbackUrl: string
  accessToken?: string
  refreshToken?: string
}

export interface SchwabAuthResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  refresh_token_expires_in: number
  token_type: string
}

export interface OrderRequest {
  symbol: string
  quantity: number
  orderType: 'MARKET' | 'LIMIT' | 'STOP' | 'STOP_LIMIT'
  instruction: 'BUY' | 'SELL' | 'BUY_TO_COVER' | 'SELL_SHORT'
  price?: number
  stopPrice?: number
  duration: 'DAY' | 'GTC' | 'FILL_OR_KILL'
  session: 'NORMAL' | 'AM' | 'PM' | 'SEAMLESS'
}

export interface Position {
  symbol: string
  quantity: number
  averagePrice: number
  currentPrice: number
  marketValue: number
  unrealizedPL: number
  unrealizedPLPercent: number
}

export interface AccountBalance {
  cashBalance: number
  equity: number
  buyingPower: number
  dayTradingBuyingPower: number
  maintenanceRequirement: number
}

export class SchwabClient {
  private client: TDAmeritradeAPI
  private config: SchwabConfig

  constructor(config: SchwabConfig) {
    this.config = config
    this.client = new TDAmeritradeAPI({
      clientId: config.clientId,
      callbackUrl: config.callbackUrl,
    })

    if (config.accessToken && config.refreshToken) {
      this.setAccessToken(config.accessToken, config.refreshToken)
    }
  }

  /**
   * Get the authorization URL for OAuth flow
   */
  getAuthorizationUrl(): string {
    return `https://api.schwabapi.com/v1/oauth/authorize?client_id=${this.config.clientId}&redirect_uri=${encodeURIComponent(this.config.callbackUrl)}`
  }

  /**
   * Authenticate with authorization code
   */
  async authenticate(authorizationCode: string): Promise<SchwabAuthResponse> {
    const response = await this.client.authenticate(authorizationCode)
    return response.data as SchwabAuthResponse
  }

  /**
   * Set access token manually
   */
  setAccessToken(accessToken: string, refreshToken: string, expiresIn?: number, refreshTokenExpiresIn?: number) {
    this.client.setUserAccessToken({
      userAccessToken: accessToken,
      accessTokenExpires: expiresIn,
      refreshToken: refreshToken,
      refreshTokenExpires: refreshTokenExpiresIn,
    })
  }

  /**
   * Get account information
   */
  async getAccount(accountId: string) {
    return await this.client.getAccount(accountId)
  }

  /**
   * Get all accounts
   */
  async getAccounts() {
    return await this.client.getAccounts()
  }

  /**
   * Get account positions
   */
  async getPositions(accountId: string): Promise<Position[]> {
    const response = await this.client.getAccount(accountId, {
      fields: 'positions'
    })

    const positions = response.data?.securitiesAccount?.positions || []

    return positions.map((pos: any) => ({
      symbol: pos.instrument?.symbol || '',
      quantity: pos.longQuantity || pos.shortQuantity || 0,
      averagePrice: pos.averagePrice || 0,
      currentPrice: pos.marketValue / (pos.longQuantity || pos.shortQuantity || 1),
      marketValue: pos.marketValue || 0,
      unrealizedPL: pos.currentDayProfitLoss || 0,
      unrealizedPLPercent: pos.currentDayProfitLossPercentage || 0,
    }))
  }

  /**
   * Get account balance
   */
  async getBalance(accountId: string): Promise<AccountBalance> {
    const response = await this.client.getAccount(accountId)
    const balances = response.data?.securitiesAccount?.currentBalances || {}

    return {
      cashBalance: balances.cashBalance || 0,
      equity: balances.equity || 0,
      buyingPower: balances.buyingPower || 0,
      dayTradingBuyingPower: balances.dayTradingBuyingPower || 0,
      maintenanceRequirement: balances.maintenanceRequirement || 0,
    }
  }

  /**
   * Place an order
   */
  async placeOrder(accountId: string, order: OrderRequest) {
    const orderPayload = this.buildOrderPayload(order)
    return await this.client.placeOrder(accountId, orderPayload)
  }

  /**
   * Cancel an order
   */
  async cancelOrder(accountId: string, orderId: string) {
    return await this.client.cancelOrder(accountId, orderId)
  }

  /**
   * Get orders for account
   */
  async getOrders(accountId: string, params?: {
    maxResults?: number
    fromEnteredTime?: string
    toEnteredTime?: string
    status?: string
  }) {
    return await this.client.getOrdersByAccount(accountId, params)
  }

  /**
   * Get quote for symbol
   */
  async getQuote(symbol: string) {
    return await this.client.getQuote(symbol)
  }

  /**
   * Get quotes for multiple symbols
   */
  async getQuotes(symbols: string[]) {
    return await this.client.getQuotes(symbols)
  }

  /**
   * Get price history
   */
  async getPriceHistory(symbol: string, params?: {
    periodType?: 'day' | 'month' | 'year' | 'ytd'
    period?: number
    frequencyType?: 'minute' | 'daily' | 'weekly' | 'monthly'
    frequency?: number
    startDate?: number
    endDate?: number
  }) {
    return await this.client.getPriceHistory(symbol, params)
  }

  /**
   * Get option chain
   */
  async getOptionChain(symbol: string, params?: any) {
    return await this.client.getOptionChain(symbol, params)
  }

  /**
   * Build order payload from OrderRequest
   */
  private buildOrderPayload(order: OrderRequest) {
    const orderLeg = {
      instruction: order.instruction,
      quantity: order.quantity,
      instrument: {
        symbol: order.symbol,
        assetType: 'EQUITY'
      }
    }

    const payload: any = {
      orderType: order.orderType,
      session: order.session,
      duration: order.duration,
      orderStrategyType: 'SINGLE',
      orderLegCollection: [orderLeg]
    }

    if (order.orderType === 'LIMIT' && order.price) {
      payload.price = order.price
    }

    if (order.orderType === 'STOP' && order.stopPrice) {
      payload.stopPrice = order.stopPrice
    }

    if (order.orderType === 'STOP_LIMIT' && order.price && order.stopPrice) {
      payload.price = order.price
      payload.stopPrice = order.stopPrice
    }

    return payload
  }
}

export class MockSchwabClient extends SchwabClient {
    constructor(config: SchwabConfig) {
        // We still call super to initialize the base class, but we will override the methods
        super(config)
    }

    getAuthorizationUrl(): string {
        return `${this['config'].callbackUrl}?code=mock_auth_code_12345`
    }

    async authenticate(authorizationCode: string): Promise<SchwabAuthResponse> {
        return {
            access_token: 'mock_access_token_' + Date.now(),
            refresh_token: 'mock_refresh_token_' + Date.now(),
            expires_in: 1800,
            refresh_token_expires_in: 604800,
            token_type: 'Bearer'
        }
    }

    async getAccount(accountId: string) {
        return {
            data: {
                securitiesAccount: {
                    accountId,
                    type: 'MARGIN',
                    currentBalances: {
                        cashBalance: 25000.00,
                        equity: 105000.00,
                        buyingPower: 210000.00,
                        dayTradingBuyingPower: 420000.00,
                        maintenanceRequirement: 15000.00
                    }
                }
            }
        }
    }

    async getAccounts() {
        return {
            data: [
                {
                    securitiesAccount: {
                        accountId: 'MOCK_ACCT_001',
                        type: 'MARGIN',
                        currentBalances: {
                            cashBalance: 25000.00,
                            equity: 105000.00,
                            buyingPower: 210000.00
                        }
                    }
                }
            ]
        }
    }

    async getPositions(accountId: string): Promise<Position[]> {
        return [
            {
                symbol: 'AAPL',
                quantity: 100,
                averagePrice: 150.00,
                currentPrice: 175.50,
                marketValue: 17550.00,
                unrealizedPL: 2550.00,
                unrealizedPLPercent: 17.00
            },
            {
                symbol: 'MSFT',
                quantity: 50,
                averagePrice: 380.00,
                currentPrice: 410.68,
                marketValue: 20534.00,
                unrealizedPL: 1534.00,
                unrealizedPLPercent: 8.07
            }
        ]
    }

    async getBalance(accountId: string): Promise<AccountBalance> {
        const res = await this.getAccount(accountId)
        const balances = res.data.securitiesAccount.currentBalances
        return {
            cashBalance: balances.cashBalance,
            equity: balances.equity,
            buyingPower: balances.buyingPower,
            dayTradingBuyingPower: balances.dayTradingBuyingPower,
            maintenanceRequirement: balances.maintenanceRequirement
        }
    }

    async placeOrder(accountId: string, order: OrderRequest) {
        console.log(`[MOCK] Order Placed: ${order.instruction} ${order.quantity} ${order.symbol}`)
        return {
            data: {
                orderId: 'MOCK_ORDER_' + Date.now()
            }
        }
    }

    async cancelOrder(accountId: string, orderId: string) {
        console.log(`[MOCK] Order Cancelled: ${orderId}`)
        return { data: { success: true } }
    }

    async getOrders(accountId: string, params?: any) {
        return {
            data: [
                {
                    orderId: 'MOCK_ORDER_1',
                    status: 'FILLED',
                    enteredTime: new Date(Date.now() - 86400000).toISOString(),
                    orderLegCollection: [
                        {
                            instruction: 'BUY',
                            quantity: 100,
                            instrument: { symbol: 'AAPL' },
                            price: 150.00
                        }
                    ]
                }
            ]
        }
    }

    async getQuote(symbol: string) {
        return {
            data: {
                [symbol]: {
                    symbol,
                    lastPrice: 100.00 + (Math.random() * 10),
                    netChange: Math.random() * 2 - 1,
                    totalVolume: 1000000
                }
            }
        }
    }

    async getQuotes(symbols: string[]) {
        const quotes: any = {}
        for (const sym of symbols) {
            quotes[sym] = {
                symbol: sym,
                lastPrice: 100.00 + (Math.random() * 10),
                netChange: Math.random() * 2 - 1,
                totalVolume: 1000000
            }
        }
        return { data: quotes }
    }

    async getPriceHistory(symbol: string, params?: any) {
        console.log(`[MOCK] Generating synthetic price history for ${symbol}`)
        const candles = []

        // Determine number of candles (e.g., mock 100 candles if dates not specified carefully)
        let numCandles = 100
        let intervalMs = 60000 // 1 minute default

        if (params?.frequencyType === 'daily') {
            intervalMs = 86400000
        }

        let startTime = params?.startDate || (Date.now() - (numCandles * intervalMs))
        let currentPrice = 150.0

        for (let i = 0; i < numCandles; i++) {
            const open = currentPrice + (Math.random() * 2 - 1)
            const high = open + Math.random() * 2
            const low = open - Math.random() * 2
            const close = low + Math.random() * (high - low)

            candles.push({
                datetime: startTime + (i * intervalMs),
                open,
                high,
                low,
                close,
                volume: Math.floor(Math.random() * 10000)
            })
            currentPrice = close
        }

        return {
            data: {
                candles,
                symbol,
                empty: false
            }
        }
    }

    async getOptionChain(symbol: string, params?: any) {
        return {
            data: {
                symbol,
                status: "SUCCESS",
                callExpDateMap: {},
                putExpDateMap: {}
            }
        }
    }
}

// Singleton instance
let schwabClient: SchwabClient | null = null

export function getSchwabClient(config?: SchwabConfig): SchwabClient {
  if (!schwabClient && config) {
    if (process.env.USE_MOCK_DATA === 'true') {
      console.log('⚠️ Using MOCK Schwab Client ⚠️')
      schwabClient = new MockSchwabClient(config)
    } else {
      schwabClient = new SchwabClient(config)
    }
  }

  if (!schwabClient) {
    throw new Error('Schwab client not initialized. Please provide config.')
  }

  return schwabClient
}

export function initializeSchwabClient(config: SchwabConfig): SchwabClient {
  if (process.env.USE_MOCK_DATA === 'true') {
    console.log('⚠️ Initializing MOCK Schwab Client ⚠️')
    schwabClient = new MockSchwabClient(config)
  } else {
    schwabClient = new SchwabClient(config)
  }
  return schwabClient
}
