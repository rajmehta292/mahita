# Mahita Terminal - Quick Reference Guide

Status: Historical quick reference. For the current auth/origin/brokerage model, use [docs/guidebook/auth/README.md](guidebook/auth/README.md).

## 🚀 Quick Start

### First Time Setup
```bash
# Clone and install
git clone https://github.com/yourusername/mahita.git
cd mahita
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your credentials

# Initialize database
npx prisma generate
npx prisma db push

# Start development server
npm run dev
```

### Access URLs
- **Local**: http://localhost:6244
- **Production**: https://mahita.ai

## 📱 Pages Overview

| Page | Route | Purpose | Auth Required |
|------|-------|---------|---------------|
| Landing | `/` | Public homepage | No |
| Dashboard | `/dashboard` | Overview & stats | Yes |
| Chart | `/chart` | Professional charting | Yes |
| Backtest | `/backtest` | Strategy testing | Yes |
| Active Trader | `/active-trader` | Live trading | Yes |
| Screener | `/screener` | Stock screening | Yes |
| Orders | `/orders` | Order management | Yes |
| History | `/history` | Trade history | Yes |
| Watchlist | `/watchlist` | Symbol tracking | Yes |

## 🔑 Environment Variables

### Required
```env
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
NEXTAUTH_SECRET="your_nextauth_secret"
NEXTAUTH_URL="https://mahita.ai"
ALLOWED_EMAIL="your@email.com"
```

### Optional (Live Trading)
```env
SCHWAB_CLIENT_ID="your_schwab_client_id"
SCHWAB_CLIENT_SECRET="your_schwab_client_secret"
SCHWAB_CALLBACK_URL="https://mahita.ai/schwab/callback"
```

## 🎨 Key Features

### Charting
- Multiple timeframes (1m to 1M)
- 100+ technical indicators
- Drawing tools (trendlines, Fibonacci, etc.)
- Multiple chart types
- Symbol search

### Backtesting
- Pine Script editor with syntax highlighting
- Historical data testing
- Performance metrics (Sharpe, win rate, etc.)
- Trade visualization
- Strategy optimization

### Active Trading
- Schwab API integration
- Real-time positions
- Automated strategy execution
- Order management
- Risk controls

### Screening
- Technical filters
- Fundamental filters
- Real-time scanning
- Custom criteria
- Export results

## 🛠️ Common Commands

### Development
```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run linter
```

### Database
```bash
npx prisma generate  # Generate Prisma client
npx prisma db push   # Push schema to database
npx prisma studio    # Open database GUI
```

### Deployment
```bash
# Start Cloudflare tunnel
cloudflared tunnel --config cloudflared/config.yml run

# Check running processes
ps aux | grep -E "next|cloudflared"

# Kill processes
pkill -f "next dev"
pkill -f cloudflared
```

## 📊 API Routes

### Trading
- `GET /api/trading/market-data` - Get market data
- `POST /api/trading/backtest` - Run backtest
- `GET /api/trading/inventory` - Get positions
- `POST /api/trading/compile` - Compile Pine Script

### Schwab
- `GET /api/schwab/auth` - Get auth URL
- `POST /api/schwab/auth` - Exchange code
- `GET /api/schwab/accounts` - Get accounts
- `GET /api/schwab/positions` - Get positions
- `POST /api/schwab/orders` - Place order
- `DELETE /api/schwab/orders` - Cancel order

### Authentication
- `GET /api/auth/session` - Get session
- `POST /api/auth/signin` - Sign in
- `POST /api/auth/signout` - Sign out

## 🎯 Keyboard Shortcuts

### Chart
- `Space` - Toggle play/pause
- `+/-` - Zoom in/out
- `←/→` - Pan left/right
- `Esc` - Clear selection

### Editor
- `Ctrl+S` - Save
- `Ctrl+Enter` - Run backtest
- `Ctrl+/` - Toggle comment
- `Ctrl+F` - Find

## 🔧 Troubleshooting

### Can't Sign In
1. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
2. Verify ALLOWED_EMAIL matches your email
3. Check NEXTAUTH_URL is correct
4. Clear browser cookies

### Backtest Not Running
1. Check Pine Script syntax
2. Verify symbol exists
3. Check date range
4. Review browser console for errors

### Schwab Connection Failed
1. Verify SCHWAB_CLIENT_ID and SCHWAB_CLIENT_SECRET
2. Check callback URL matches exactly
3. Ensure application is approved
4. Try clearing browser cache

### Site Not Loading
1. Check if dev server is running
2. Verify port 3000 is not in use
3. Check for compilation errors
4. Try `rm -rf .next && npm run dev`

## 📚 Documentation

- [Platform Overview](PLATFORM_COMPLETE.md)
- [TradingView Integration](TRADINGVIEW_INTEGRATION.md)
- [Active Trader Guide](ACTIVE_TRADER.md)
- [Schwab Setup](SCHWAB_SETUP.md)
- [Deployment Status](DEPLOYMENT_STATUS.md)

## 🆘 Getting Help

### Resources
- **Email**: support@mahita.ai
- **Discord**: [Join community](https://discord.gg/mahita)
- **GitHub**: [Report issues](https://github.com/yourusername/mahita/issues)
- **Twitter**: [@mahita](https://twitter.com/mahita)

### Before Asking
1. Check this quick reference
2. Review relevant documentation
3. Search existing GitHub issues
4. Check browser console for errors

## 🔐 Security Best Practices

1. **Never commit** `.env.local` to Git
2. **Use strong passwords** for all accounts
3. **Enable 2FA** on Google and Schwab
4. **Rotate credentials** regularly
5. **Monitor API usage** for anomalies
6. **Start with paper trading** before live
7. **Set conservative limits** initially

## 📈 Performance Tips

1. **Use caching** for market data
2. **Limit API calls** to avoid rate limits
3. **Optimize re-renders** in React
4. **Use lazy loading** for heavy components
5. **Enable compression** in production
6. **Monitor bundle size** regularly

## 🎓 Learning Resources

### Pine Script
- [TradingView Pine Script Docs](https://www.tradingview.com/pine-script-docs/)
- [Pine Script Tutorial](https://www.tradingview.com/pine-script-docs/en/v5/Introduction.html)

### Trading
- [Investopedia](https://www.investopedia.com/)
- [Babypips](https://www.babypips.com/)

### Technical Analysis
- [StockCharts School](https://school.stockcharts.com/)
- [TradingView Ideas](https://www.tradingview.com/ideas/)

## 🗺️ Roadmap

### Q2 2026
- Real-time WebSocket data
- Advanced drawing tools
- Custom indicator library
- Mobile apps

### Q3 2026
- Broker integrations (IB, Alpaca)
- Live trading execution
- Social trading features
- Strategy marketplace

### Q4 2026
- AI strategy suggestions
- Automated trading bots
- Sentiment analysis
- News integration

---

**Last Updated**: 2026-03-06
**Version**: 1.0.0
