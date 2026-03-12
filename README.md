# Mahita Terminal 🚀

The canonical project story, senior-project docs, and live wiki now live in the site-visible Documentation section at `/docs`. For repo readers, the main current-state sources are [docs/current_state_baseline.md](/Users/rmehta01/Sites/mahita/docs/current_state_baseline.md) and [docs/guidebook/auth/README.md](/Users/rmehta01/Sites/mahita/docs/guidebook/auth/README.md).

A professional-grade algorithmic trading platform inspired by TradingView, built with Next.js, React, and TypeScript.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

## 🌟 Features

### Professional Trading Interface
- **TradingView-Inspired UI** - Dark theme, professional layout, smooth animations
- **Multi-Page Architecture** - Dedicated pages for different trading activities
- **Responsive Design** - Works on desktop, tablet, and mobile devices

### Advanced Charting
- **Professional Charts** - Powered by Lightweight Charts library
- **Drawing Tools** - Trendlines, Fibonacci, shapes, and text annotations
- **Technical Indicators** - Volume, MACD, RSI, and more
- **Multiple Timeframes** - From 1-minute to monthly charts
- **Chart Types** - Candlestick, Heikin-Ashi, and more

### Live Trading (Active Trader)
- **Schwab API Integration** - Connect your Charles Schwab brokerage account
- **Real-Time Positions** - Monitor live positions and P&L
- **Automated Strategy Execution** - Deploy backtested strategies to live trading
- **Order Management** - Place, modify, and cancel orders programmatically
- **Risk Controls** - Position limits, daily loss limits, and safety features

### Strategy Development & Backtesting
- **Pine Script Editor** - Monaco-powered code editor with syntax highlighting
- **Real-Time Compilation** - Instant feedback on strategy code
- **Comprehensive Backtesting** - Test strategies against historical data
- **Performance Metrics** - Win rate, Sharpe ratio, max drawdown, profit factor
- **Trade Visualization** - See entry/exit points directly on charts

### Market Intelligence
- **Data Command Center (Data Doctor)** - Visual global heatmap mapping all internal system knowledge and API health.
- **Stock Screener** - Filter stocks by technical and fundamental criteria
- **Live News Feed & AI Insights** - Real-time market context via Yahoo Finance and dynamic AI summary generations.
- **Watchlist Management** - Track your favorite symbols
- **Multi-Vault Data Caching** - Localized storage orchestrator saving data natively to SQLite files (`schwab.db`, `yahoo.db`, `master.db`).
- **Standardized Timeframes** - Data stored strictly in `1s, 1m, 1h, 1d, 1w, 1M` arrays, aggregating derived timeframes (`15m`, `4h`) on-the-fly in memory.

### Portfolio & Risk Management
- **Trade History** - Complete log of all trades
- **P&L Tracking** - Real-time profit and loss calculations
- **Order Management** - Create, modify, and cancel orders
- **Risk Controls** - Stop-loss, take-profit, position sizing

## 📁 Project Structure

```
mahita/
├── app/
│   ├── components/
│   │   ├── Layout/
│   │   │   ├── MainLayout.tsx      # Root layout
│   │   │   ├── TopBar.tsx          # Navigation bar
│   │   │   ├── Sidebar.tsx         # Side menu
│   │   │   └── BottomPanel.tsx     # Activity panel
│   │   ├── Chart/
│   │   │   ├── Chart.tsx           # Main chart
│   │   │   ├── SymbolHeader.tsx    # Price display
│   │   │   ├── ChartToolbar.tsx    # Drawing tools
│   │   │   └── RightPanel.tsx      # Watchlist panel
│   │   ├── StrategyTester.tsx      # Backtest results
│   │   └── AuthProvider.tsx        # Auth wrapper
│   ├── services/
│   │   ├── market-data/            # Market data services
│   │   └── trading-engine/         # Backtesting engine
│   ├── api/
│   │   ├── auth/                   # Authentication
│   │   └── trading/                # Trading APIs
│   ├── dashboard/                  # Realistic Live Performance Dashboard
│   ├── chart/                      # Chart page
│   ├── backtest/                   # Backtest page
│   ├── active-trader/              # Live trading page
│   ├── data-doctor/                # Data Command Center (Vault Management)
│   ├── screener/                   # Screener page
│   ├── orders/                     # Orders page
│   ├── history/                    # History page
│   └── watchlist/                  # Watchlist page
├── data/                           
│   └── vaults/                     # Sandbox area for isolated SQLite db files
├── docs/                           # Documentation
├── prisma/                         # Database schema
└── public/                         # Static assets
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Google OAuth credentials (for authentication)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/mahita.git
cd mahita
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials:
```env
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your_nextauth_secret"
MAHITA_PUBLIC_APP_ORIGIN="https://mahita.ai"
ENABLE_DEV_AUTH_BYPASS="true"

# Production Google auth on mahita.ai only
GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
NEXTAUTH_URL="https://mahita.ai"

# Optional: For live trading with Schwab
SCHWAB_CLIENT_ID="your_schwab_client_id"
SCHWAB_CLIENT_SECRET="your_schwab_client_secret"
SCHWAB_CALLBACK_URL="https://mahita.ai/schwab/callback"
```

4. **Initialize the database**
```bash
npx prisma generate
npx prisma db push
```

5. **Seed market data (optional)**
```bash
npx tsx scripts/seed-dow30.ts
```

6. **Run the development server**
```bash
npm run dev
```

7. **Open your browser**
Navigate to [http://localhost:6244](http://localhost:6244) for local development. Real user sign-in runs on [https://mahita.ai](https://mahita.ai).

Local development uses the dev-bypass flow by default. Do not add `localhost` to your production Google OAuth client unless you are intentionally maintaining a separate local-only OAuth setup.

## 📖 Usage

### Authentication
1. Use Google sign-in on `https://mahita.ai` to access your Mahita workspace
2. Local development uses the dev-bypass flow by default
3. After signing into Mahita, save your Schwab developer app keys in Settings
4. Use the Schwab OAuth connect flow later to authorize your real brokerage account

### Charting
1. Navigate to **Chart** from the sidebar
2. Select a symbol and timeframe
3. Use drawing tools to annotate
4. Add technical indicators
5. Analyze price action

### Backtesting
1. Navigate to **Backtest** from the sidebar
2. Select symbol, timeframe, and capital
3. Configure risk management (stop-loss, take-profit)
4. Write or modify Pine Script strategy
5. Click "Run Backtest"
6. Analyze results and performance metrics

### Screening
1. Navigate to **Screener** from the sidebar
2. Use search to find symbols
3. Apply filters for technical/fundamental criteria
4. Sort by any column
5. Click on a symbol to view its chart

### Portfolio Management
1. View **Dashboard** for overview
2. Check **History** for past trades
3. Manage **Orders** for active positions
4. Track favorites in **Watchlist**

### Live Trading (Active Trader)
1. Navigate to **Active Trader** from the sidebar
2. Click **Connect Schwab Account**
3. Authorize the application with your Schwab credentials
4. View real-time positions and account balance
5. Deploy backtested strategies for automated trading
6. Monitor live P&L and trading activity

**Note**: Live trading requires a Charles Schwab brokerage account and API credentials. See [Active Trader Documentation](docs/ACTIVE_TRADER.md) for setup instructions.

## 🛠️ Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **Lightweight Charts** - Professional charting
- **Monaco Editor** - Code editing
- **Lucide React** - Icons

### Backend
- **Next.js API Routes** - Serverless functions
- **NextAuth** - Authentication
- **Prisma** - ORM
- **SQLite** - Database (dev)
- **Technical Indicators** - TA library

## 🎨 Design System

### Colors
```css
/* Dark Theme */
Background Primary:   #131722
Background Secondary: #1E222D
Background Tertiary:  #2A2E39

Text Primary:   #FFFFFF
Text Secondary: #B2B5BE
Text Tertiary:  #787B86

Blue (Primary):  #2962FF
Green (Long):    #26a69a
Red (Short):     #ef5350
Yellow (Warning): #FFA726
Purple (Special): #9C27B0
```

### Typography
- **Font Family**: System fonts (San Francisco, Segoe UI, Roboto)
- **Font Sizes**: 12px - 32px
- **Font Weights**: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold)

## 📊 Architecture

### Data Flow
```
User Input → API Route → Service Layer → Database → Response → UI Update
```

### Backtesting Pipeline
```
Strategy Config → Pine Script Compiler → Historical Data → 
Backtest Engine → Paper Broker → Results → Visualization
```

### Authentication Flow
```
Google OAuth → Email Validation → JWT Session → Protected Routes
```

## 🔒 Security

- **Authentication**: Google OAuth with email whitelist
- **Session Management**: JWT-based sessions
- **Route Protection**: Middleware guards
- **API Security**: Server-side validation
- **Data Privacy**: User data isolation

## 📈 Performance

- **Code Splitting**: Dynamic imports for heavy components
- **Caching**: Market data caching in database
- **Optimization**: Canvas-based chart rendering
- **Lazy Loading**: Components load on demand
- **SSR**: Server-side rendering for initial load

## 🧪 Testing

```bash
# Run tests
npm test

# Run linter
npm run lint

# Type check
npm run type-check
```

## 📝 Documentation

- [Platform Overview](docs/PLATFORM_COMPLETE.md)
- [TradingView Integration](docs/TRADINGVIEW_INTEGRATION.md)
- [Active Trader Guide](docs/ACTIVE_TRADER.md)
- [Bug Fixes](docs/FIXES.md)

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **TradingView** - Inspiration for UI/UX design
- **Lightweight Charts** - Professional charting library
- **Next.js Team** - Amazing React framework
- **Vercel** - Hosting and deployment platform

## 📞 Support

For support, email support@mahita.com or join our Discord server.

## 🗺️ Roadmap

### Q2 2026
- [ ] Real-time WebSocket data feeds
- [ ] Advanced drawing tools
- [ ] Custom indicator library
- [ ] Mobile apps (iOS/Android)

### Q3 2026
- [ ] Broker integrations (Interactive Brokers, Alpaca)
- [ ] Live trading execution
- [ ] Social trading features
- [ ] Strategy marketplace

### Q4 2026
- [ ] AI-powered strategy suggestions
- [ ] Automated trading bots
- [x] Sentiment analysis & AI Market Insights
- [x] News integration

---

**Built with ❤️ by the Mahita Team**

[Website](https://mahita.com) • [Documentation](https://docs.mahita.com) • [Discord](https://discord.gg/mahita) • [Twitter](https://twitter.com/mahita)
