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

// Singleton instance
let schwabClient: SchwabClient | null = null

export function getSchwabClient(config?: SchwabConfig): SchwabClient {
  if (!schwabClient && config) {
    schwabClient = new SchwabClient(config)
  }
  
  if (!schwabClient) {
    throw new Error('Schwab client not initialized. Please provide config.')
  }
  
  return schwabClient
}

export function initializeSchwabClient(config: SchwabConfig): SchwabClient {
  schwabClient = new SchwabClient(config)
  return schwabClient
}
