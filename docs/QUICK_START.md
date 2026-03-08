# Quick Start Guide

Get up and running with Mahita Terminal in 5 minutes!

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Google account (for OAuth)

## Step 1: Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mahita.git
cd mahita

# Install dependencies
npm install
```

## Step 2: Environment Setup

Create a `.env.local` file in the root directory:

```env
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID="your_google_client_id_here"
GOOGLE_CLIENT_SECRET="your_google_client_secret_here"
NEXTAUTH_SECRET="generate_a_random_secret_here"
NEXTAUTH_URL="http://mahita.ai"
ALLOWED_EMAIL="your@email.com"
```

### Getting Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `http://mahita.ai/api/auth/callback/google`
6. Copy Client ID and Client Secret to `.env.local`

### Generating NextAuth Secret

```bash
openssl rand -base64 32
```

## Step 3: Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push
```

## Step 4: Seed Data (Optional)

```bash
# Seed with DOW 30 stocks
npx tsx scripts/seed-dow30.ts
```

## Step 5: Run the Application

```bash
npm run dev
```

Open [http://mahita.ai](http://mahita.ai) in your browser.

## First Steps

### 1. Sign In
- Click "Sign in with Google"
- Authorize the application
- You'll be redirected to the dashboard

### 2. Explore the Dashboard
- View portfolio overview
- Check quick stats
- Access recent activity

### 3. Open a Chart
- Click "Chart" in the sidebar
- Select a symbol (e.g., AAPL)
- Choose a timeframe
- Explore drawing tools and indicators

### 4. Run Your First Backtest
- Click "Backtest" in the sidebar
- Select symbol and timeframe
- Configure risk management
- Modify the Pine Script strategy
- Click "Run Backtest"
- Analyze the results

### 5. Use the Screener
- Click "Screener" in the sidebar
- Search for stocks
- Apply filters
- Sort by different criteria

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Database Connection Error
```bash
# Reset database
rm dev.db
npx prisma db push
```

### Authentication Error
- Verify Google OAuth credentials
- Check NEXTAUTH_SECRET is set
- Ensure ALLOWED_EMAIL matches your Google account

### No Market Data
```bash
# Run the seed script
npx tsx scripts/seed-dow30.ts
```

## Next Steps

1. **Customize Your Watchlist**
   - Add your favorite symbols
   - Set up price alerts

2. **Develop Strategies**
   - Learn Pine Script syntax
   - Create custom indicators
   - Backtest your ideas

3. **Analyze Performance**
   - Review trade history
   - Track P&L
   - Optimize strategies

4. **Explore Advanced Features**
   - Multi-timeframe analysis
   - Advanced drawing tools
   - Custom screeners

## Keyboard Shortcuts

- `Ctrl/Cmd + K` - Quick search
- `Ctrl/Cmd + B` - Toggle sidebar
- `Ctrl/Cmd + /` - Show shortcuts
- `Esc` - Close modals

## Getting Help

- **Documentation**: Check `/docs` folder
- **Issues**: Report on GitHub
- **Discord**: Join our community
- **Email**: support@mahita.com

## What's Next?

- Read the [Platform Overview](PLATFORM_COMPLETE.md)
- Learn about [TradingView Integration](TRADINGVIEW_INTEGRATION.md)
- Explore the [API Documentation](API.md)
- Join our [Discord Community](https://discord.gg/mahita)

Happy Trading! 🚀
