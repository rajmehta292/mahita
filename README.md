# Mahita Terminal

Mahita is a trading-terminal senior project that combines:

- Mahita workspace identity and user profiles
- Schwab developer-key setup and brokerage OAuth connection
- portfolio, account, and control-plane surfaces
- a prototype backtesting/editor workflow
- a documentation/wiki system that now serves as the project’s presentation portal

The live docs entry point inside the app is `/docs`. For repo readers, this README is the fastest map to the rest of the project.

## ⚡ Quick Start (Dev & Tunnel)

```bash
# Start development server
npm run dev

# Start Cloudflare tunnel
cloudflared tunnel --config cloudflared/config.yml run
```

For the Windows operator machine, the stable public setup is production mode plus Startup launchers that start hidden supervisor processes:

```powershell
npm run build
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\windows\Install-MahitaOperatorTasks.ps1 -StartNow
```

Runbook: [docs/internal/runbooks/windows-operator-autostart.md](docs/internal/runbooks/windows-operator-autostart.md)

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
- **MahaCharts Workspace** - Single-chart-first shell with top bar, left rail, dominant chart stage, adjustable Pine editor overlay, bottom report dock, and a permanent right utility strip that launches contextual overlays
- **Built-In Indicators** - Volume, MACD, RSI, EMA, SMA, Bollinger Bands, VWAP, and ATR
- **Strategy Library** - Saved strategies, immutable versions, and autosave workspace sessions
- **Multiple Timeframes** - Current workspace flow from 1-minute through daily charts
- **Chart Types** - Candlestick and Heikin-Ashi in the current workspace

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
- **Trade Visualization** - Entry/exit markers directly on charts
- **Versioned Strategies** - Workspace autosave plus immutable strategy versions for deployment-safe history

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

## 🧭 Project Navigation

If you need to understand the project quickly, start here:

- Project current state: [docs/current_state_baseline.md](docs/current_state_baseline.md)
- MahaCharts AI start-here guide: [docs/internal/guidebook/mahacharts/README.md](docs/internal/guidebook/mahacharts/README.md)
- MahaCharts generated handoff: [docs/internal/generated/mahacharts-handoff.md](docs/internal/generated/mahacharts-handoff.md)
- Codex handoff folder: [docs/codex/README.md](docs/codex/README.md)
- Windows migration checklist: [docs/codex/windows-migration.md](docs/codex/windows-migration.md)
- Website-visible documentation portal: [docs/public/project-overview/how-to-use-this-documentation.md](docs/public/project-overview/how-to-use-this-documentation.md)
- Senior project report draft: [docs/public/senior-project/report-draft.md](docs/public/senior-project/report-draft.md)
- Presentation outline: [docs/public/senior-project/presentation-outline.md](docs/public/senior-project/presentation-outline.md)
- Fast reviewer guide: [docs/public/project-overview/presentation-for-reviewers.md](docs/public/project-overview/presentation-for-reviewers.md)
- Architecture/codebase map: [docs/internal/guidebook/architecture-map.md](docs/internal/guidebook/architecture-map.md)
- Auth guidebook: [docs/guidebook/auth/README.md](docs/guidebook/auth/README.md)
- Platform data summary: [docs/public/project-overview/platform-data-summary.md](docs/public/project-overview/platform-data-summary.md)
- Platform data audit: [docs/internal/guidebook/platform-data-architecture-audit.md](docs/internal/guidebook/platform-data-architecture-audit.md)
- Local/demo bootstrap: [docs/internal/runbooks/local-bootstrap.md](docs/internal/runbooks/local-bootstrap.md)
- Presentation-day recovery: [docs/internal/runbooks/presentation-day-recovery.md](docs/internal/runbooks/presentation-day-recovery.md)
- Post-presentation engineering roadmap: [docs/public/project-overview/post-presentation-recovery-roadmap.md](docs/public/project-overview/post-presentation-recovery-roadmap.md)

## 📁 Repository Layout

Use this map to find the important code and documentation quickly:

- `app/`
  - Next.js pages, API routes, and UI components
- `lib/`
  - shared domain logic for auth, brokerage connections, provider credentials, docs, runtime health, and preferences
- `docs/public/`
  - faculty-facing and presentation-facing docs
- `docs/internal/`
  - internal guidebooks, evidence, and runbooks
- `docs/codex/`
  - portable Codex handoffs, migration notes, and normalized session context snapshots
- `docs/internal/evidence/archive/`
  - historical notes and external reference captures that informed the project, but are not active runtime code
- `scripts/`
  - bootstrap, packaging, seeding, and utility scripts
- `scripts/diagnostics/`
  - one-off diagnostics moved out of the repo root so they are easier to find and easier to ignore during normal development
- `tests/` and `e2e/`
  - deterministic tests and browser/system tests
- `prisma/`
  - schema and local DB files
- `data/`
  - local data artifacts such as vault-backed SQLite stores

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
├── docs/                           # Documentation, report, wiki, guidebooks, evidence
├── prisma/                         # Database schema
└── public/                         # Static assets
```

## 🗂️ Repo Hygiene

To keep the project understandable and portable:

- local runtime artifacts are ignored
  - local SQLite databases
  - provider traffic logs
  - transient test output
  - local scratch files in `tmp/`
- historical notes and reference captures live under [docs/internal/evidence/archive](docs/internal/evidence/archive/README.md)
- ad hoc diagnostics scripts live under `scripts/diagnostics/`

If you add a new research note, one-off diagnostic, or external reference capture, put it in one of those folders instead of the repo root.

## 🔁 Clone, Rebuild, And `gitignore`

If someone clones this repo, the ignored files are exactly the things they should recreate locally rather than pull from git.

### What `gitignore` excludes

- `node_modules/`, `.next/`, `out/`, `build/`
  - generated dependencies and build output
- `.env*` except `.env.demo.example`
  - machine-specific secrets and local environment config
- `dev.db`, `demo.db`, `prisma/*.db`, `data/vaults/*.db`
  - local SQLite databases created during development, demo bootstrap, or data caching
- `logs/*.jsonl`, `test-results/`, `coverage/`, `tmp/`, `next_output.log`
  - local diagnostics, test artifacts, and scratch output
- `public/monaco/`
  - Monaco editor assets generated by the sync script
- `artifacts/senior-project/`
  - reproducible presentation outputs that can be rebuilt locally

The goal is simple: a clone should contain the source code, docs, scripts, and seeds needed to rebuild the app, but not stale machine state from someone else’s laptop.

### What works automatically from a fresh clone

For a presentation-safe local demo:

```bash
npm run bootstrap:demo
npm run dev
```

`bootstrap:demo` handles:

- installing dependencies
- copying `.env.demo.example` to `.env.local`
- generating Prisma client
- creating the local demo database
- seeding demo users, demo workspace data, and docs-ready content
- syncing Monaco assets needed by the editor

After that, open `http://localhost:6244/docs` or `http://localhost:6244/dashboard` and sign in with one of:

- `owner.demo@mahita.ai`
- `demo.user@mahita.ai`
- `reviewer@mahita.ai`

### What still requires manual setup

The demo bootstrap does **not** configure live credentials or public infrastructure.

You still need to set these up manually if you want a live-capable environment:

- Google OAuth credentials for `https://mahita.ai`
- Schwab Developer Portal Client ID and Client Secret
- a real public origin or tunnel for production-style auth/callback testing
- any live market-data/provider configuration

So the short answer is:

- **Demo/presentation mode:** the script handles nearly everything
- **Live/public mode:** the script gets you the codebase, but you still configure secrets and public auth infrastructure yourself

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

2. **Presentation-safe fast path**
```bash
npm run bootstrap:demo
npm run dev
```

This is the recommended path for reviewers, demos, and quick onboarding.

3. **Manual development setup**

If you need a custom local/dev setup instead of the presentation-safe bootstrap:

**Install dependencies**
```bash
npm install
```

**Set up environment variables**
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

**Initialize the database**
```bash
npx prisma generate
npx prisma db push
```

**Seed market data (optional)**
```bash
npx tsx scripts/seed-dow30.ts
```

**Run the development server**
```bash
npm run dev
```

**Open your browser**
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
