# Active Trader - Live Trading with Schwab API

## Overview

The Active Trader feature enables live trading through Charles Schwab's brokerage API. This allows you to:
- Execute real trades with your Schwab account
- Deploy backtested strategies for automated live trading
- Monitor positions and P&L in real-time
- Manage orders programmatically

## Features

### 1. Schwab Account Integration
- OAuth 2.0 authentication flow
- Secure token management
- Multiple account support
- Real-time account data synchronization

### 2. Live Position Monitoring
- Real-time position tracking
- P&L calculations (realized and unrealized)
- Account balance and buying power
- Position-level metrics

### 3. Automated Strategy Execution
- Deploy Pine Script strategies to live trading
- Risk management controls
- Position sizing automation
- Stop-loss and take-profit automation

### 4. Order Management
- Market, limit, stop, and stop-limit orders
- Order status tracking
- Order modification and cancellation
- Order history and analytics

## Setup Instructions

### Step 1: Create Schwab Developer Account

1. Go to [Schwab Developer Portal](https://developer.schwab.com/)
2. Sign up for a developer account
3. Complete the registration process

### Step 2: Create an Application

1. Log in to the Schwab Developer Portal
2. Navigate to "My Apps"
3. Click "Create App"
4. Fill in the application details:
   - **App Name**: Mahita Terminal
   - **API Products**: Select "Market Data Production" and "Accounts and Trading Production"
   - **Callback URL**: `https://mahita.ai/schwab/callback`
5. Submit the application

### Step 3: Get API Credentials

After your application is approved:
1. Go to "My Apps" in the developer portal
2. Click on your application
3. Copy the **Client ID** and **Client Secret**

### Step 4: Configure Environment Variables

Add the following to your `.env.local` file:

```env
SCHWAB_CLIENT_ID=your_client_id_here
SCHWAB_CLIENT_SECRET=your_client_secret_here
SCHWAB_CALLBACK_URL=https://mahita.ai/schwab/callback
```

### Step 5: Restart the Application

```bash
npm run dev
```

## Usage Guide

### Connecting Your Schwab Account

1. Navigate to **Active Trader** from the sidebar
2. Click **Connect Schwab Account**
3. A popup window will open with Schwab's authorization page
4. Log in to your Schwab account
5. Authorize the application
6. Mahita should return you to the connected Active Trader state on `https://mahita.ai`

Current known issue on the March 15, 2026 Windows/public baseline:
- account linking succeeds, but the popup can remain open on `?schwab=connected`
- if that happens, close the extra window manually; the brokerage connection itself is still valid

### Viewing Positions

Once connected, you'll see:
- **Account Value**: Total equity in your account
- **Buying Power**: Available funds for trading
- **Total P&L**: Unrealized profit/loss across all positions
- **Positions**: Number of open positions

The positions table shows:
- Symbol
- Quantity
- Average price
- Current price
- Unrealized P&L ($ and %)

### Deploying Live Strategies

1. Create and backtest a strategy in the **Backtest** page
2. Once satisfied with the results, go to **Active Trader**
3. Click **+ New Strategy**
4. Configure the strategy:
   - Select the strategy to deploy
   - Choose symbol and timeframe
   - Set position size and risk parameters
   - Configure stop-loss and take-profit
5. Click **Deploy**

The strategy will now execute trades automatically based on your Pine Script logic.

### Managing Live Strategies

For each live strategy, you can:
- **Pause**: Temporarily stop the strategy (keeps positions open)
- **Resume**: Restart a paused strategy
- **Stop**: Stop the strategy and close all positions
- **Edit**: Modify strategy parameters
- **View Logs**: See execution history and signals

## Risk Management

### Built-in Safety Features

1. **Position Size Limits**
   - Maximum position size per trade
   - Maximum total exposure
   - Account percentage limits

2. **Daily Loss Limits**
   - Maximum daily loss threshold
   - Automatic strategy shutdown on breach
   - Email/SMS notifications

3. **Trade Frequency Limits**
   - Maximum trades per day
   - Minimum time between trades
   - Pattern day trader protection

4. **Symbol Restrictions**
   - Whitelist of allowed symbols
   - Blacklist of restricted symbols
   - Market cap and liquidity filters

### Recommended Settings

For beginners:
```javascript
{
  maxPositionSize: 100,           // shares
  maxDailyLoss: 500,              // dollars
  maxDailyTrades: 5,              // trades
  riskPerTrade: 1,                // % of account
  stopLossPercent: 2,             // %
  takeProfitPercent: 4            // %
}
```

For experienced traders:
```javascript
{
  maxPositionSize: 1000,
  maxDailyLoss: 2000,
  maxDailyTrades: 20,
  riskPerTrade: 2,
  stopLossPercent: 1.5,
  takeProfitPercent: 3
}
```

## API Reference

### Authentication

#### Get Authorization URL
```typescript
GET /api/schwab/auth?action=authorize
```

Response:
```json
{
  "authUrl": "https://api.schwabapi.com/v1/oauth/authorize?..."
}
```

#### Exchange Authorization Code
```typescript
POST /api/schwab/auth
Body: { "code": "authorization_code" }
```

Response:
```json
{
  "success": true,
  "accessToken": "...",
  "refreshToken": "...",
  "expiresIn": 1800
}
```

### Accounts

#### Get Accounts
```typescript
GET /api/schwab/accounts?accessToken=...&refreshToken=...
```

Response:
```json
{
  "success": true,
  "accounts": [...]
}
```

### Positions

#### Get Positions
```typescript
GET /api/schwab/positions?accessToken=...&refreshToken=...&accountId=...
```

Response:
```json
{
  "success": true,
  "positions": [...],
  "balance": {...}
}
```

### Orders

#### Get Orders
```typescript
GET /api/schwab/orders?accessToken=...&refreshToken=...&accountId=...
```

#### Place Order
```typescript
POST /api/schwab/orders
Body: {
  "accessToken": "...",
  "refreshToken": "...",
  "accountId": "...",
  "order": {
    "symbol": "AAPL",
    "quantity": 10,
    "orderType": "MARKET",
    "instruction": "BUY",
    "duration": "DAY",
    "session": "NORMAL"
  }
}
```

#### Cancel Order
```typescript
DELETE /api/schwab/orders?accessToken=...&refreshToken=...&accountId=...&orderId=...
```

## Architecture

### Service Layer

```
app/services/schwab/
├── client.ts          # Schwab API client wrapper
└── types.ts           # TypeScript type definitions
```

### API Routes

```
app/api/schwab/
├── auth/route.ts      # OAuth authentication
├── accounts/route.ts  # Account information
├── positions/route.ts # Position data
└── orders/route.ts    # Order management
```

### Frontend

```
app/active-trader/
└── page.tsx           # Active Trader UI
```

## Security Considerations

### Token Storage

**Current Implementation** (Development):
- Tokens stored in component state
- Lost on page refresh
- Not suitable for production

**Recommended Implementation** (Production):
- Store tokens in encrypted database
- Associate with user session
- Implement token refresh logic
- Use secure HTTP-only cookies

### API Security

1. **Rate Limiting**: Implement rate limiting on API routes
2. **Input Validation**: Validate all user inputs
3. **Error Handling**: Don't expose sensitive error details
4. **Logging**: Log all trading activities for audit

### Best Practices

1. **Never commit credentials** to version control
2. **Use environment variables** for all secrets
3. **Implement proper error handling** for API failures
4. **Test thoroughly** with paper trading first
5. **Monitor actively** when strategies are live
6. **Set conservative limits** initially
7. **Have a kill switch** to stop all strategies

## Troubleshooting

### Connection Issues

**Problem**: Can't connect to Schwab
- Verify Client ID and Client Secret are correct
- Check callback URL matches exactly
- Ensure application is approved in developer portal
- Try clearing browser cache and cookies

**Problem**: Authorization window doesn't close
- Check browser popup blocker settings
- Verify callback page is accessible
- Check browser console for errors

### Trading Issues

**Problem**: Orders not executing
- Verify account has sufficient buying power
- Check market hours (orders may be queued)
- Ensure symbol is tradable
- Check order parameters are valid

**Problem**: Strategy not triggering
- Verify strategy is in "running" status
- Check strategy logic and conditions
- Review execution logs for errors
- Ensure market data is updating

### API Errors

**Error**: "Unauthorized"
- Access token may have expired
- Refresh the token or reconnect

**Error**: "Insufficient buying power"
- Reduce position size
- Check account balance
- Review margin requirements

**Error**: "Symbol not found"
- Verify symbol is correct
- Check if symbol is tradable
- Ensure market is open

## Compliance and Legal

### Important Disclaimers

1. **Trading Risk**: Trading involves substantial risk of loss
2. **No Guarantees**: Past performance doesn't guarantee future results
3. **Your Responsibility**: You are responsible for all trades
4. **Not Financial Advice**: This tool doesn't provide financial advice
5. **Regulatory Compliance**: Ensure compliance with all regulations

### Pattern Day Trader Rules

If you make 4+ day trades in 5 business days:
- Account must maintain $25,000 minimum
- Violations result in trading restrictions
- Monitor your day trade count carefully

### Tax Implications

- Keep records of all trades
- Report capital gains/losses
- Consult a tax professional
- Consider wash sale rules

## Support

For issues or questions:
- Check the [FAQ](FAQ.md)
- Review [API Documentation](https://developer.schwab.com/docs)
- Contact support@mahita.ai
- Join our [Discord](https://discord.gg/mahita)

## Roadmap

### Q2 2026
- [ ] Advanced order types (bracket, OCO)
- [ ] Multi-account support
- [ ] Strategy marketplace
- [ ] Mobile app integration

### Q3 2026
- [ ] Options trading support
- [ ] Portfolio optimization
- [ ] Risk analytics dashboard
- [ ] Backtesting with live data

### Q4 2026
- [ ] AI-powered strategy suggestions
- [ ] Social trading features
- [ ] Copy trading functionality
- [ ] Advanced charting integration

---

**Last Updated**: 2026-03-06
**Version**: 1.0.0
**Status**: Beta
