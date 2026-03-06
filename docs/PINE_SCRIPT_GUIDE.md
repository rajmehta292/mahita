# Pine Script Guide for Mahita Terminal

## Overview

Mahita Terminal uses a simplified Pine Script engine designed for backtesting trading strategies. This guide explains how to write effective strategies and understand the risk management approach.

## Philosophy: Separation of Concerns

### Strategy Logic vs Risk Management

We separate **strategy logic** from **risk management** for several important reasons:

1. **Reusability**: Test the same strategy with different risk parameters
2. **Clarity**: Keep your strategy code focused on entry/exit signals
3. **Flexibility**: Easily optimize risk parameters without changing strategy logic
4. **Comparison**: Compare strategies fairly with consistent risk management

### What Goes in Your Script

Your Pine Script should focus on:
- Entry conditions (when to open a position)
- Exit conditions (when to close a position)
- Technical indicator calculations
- Signal generation logic

### What Goes in Backtest Config

Risk management parameters are configured separately:
- Initial capital
- Position sizing
- Stop-loss percentage (optional)
- Take-profit percentage (optional)
- Date range for testing

## Pine Script Syntax

### Basic Structure

```javascript
// Pine Script Strategy
// @version=1

// Calculate indicators
const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)

// Entry logic
if (ema_fast > ema_slow) {
    strategy.entry("Long", "long")
}

// Exit logic
if (ema_fast < ema_slow) {
    strategy.close("Long")
}
```

### Available Functions

#### Technical Analysis (`ta.*`)

**Moving Averages:**
- `ta.sma(period)` - Simple Moving Average
- `ta.ema(period)` - Exponential Moving Average
- `ta.wma(period)` - Weighted Moving Average

**Momentum Indicators:**
- `ta.rsi(period)` - Relative Strength Index
- `ta.macd(fast, slow, signal)` - MACD
- `ta.stoch(k, d, smooth)` - Stochastic Oscillator
- `ta.cci(period)` - Commodity Channel Index

**Volatility Indicators:**
- `ta.bb(period, stddev)` - Bollinger Bands (returns object with .upper, .middle, .lower)
- `ta.atr(period)` - Average True Range
- `ta.stdev(period)` - Standard Deviation

**Volume Indicators:**
- `ta.obv()` - On-Balance Volume
- `ta.vwap()` - Volume Weighted Average Price
- `ta.mfi(period)` - Money Flow Index

#### Strategy Functions (`strategy.*`)

**Entry:**
- `strategy.entry(id, direction)` - Open a position
  - `id`: String identifier for the position
  - `direction`: "long" or "short"

**Exit:**
- `strategy.close(id)` - Close a specific position
- `strategy.close_all()` - Close all positions

### Price Data

Access OHLCV data directly:
- `open` - Opening price
- `high` - High price
- `low` - Low price
- `close` - Closing price
- `volume` - Trading volume

### Variables

Declare variables with `const`:

```javascript
const price = close
const vol = volume
const my_sma = ta.sma(20)
```

### Conditional Logic

Use standard JavaScript conditionals:

```javascript
if (condition) {
    // Do something
}

if (condition1 && condition2) {
    // Both must be true
}

if (condition1 || condition2) {
    // Either can be true
}
```

### Operators

- Comparison: `>`, `<`, `>=`, `<=`, `===`, `!==`
- Logical: `&&` (AND), `||` (OR), `!` (NOT)
- Arithmetic: `+`, `-`, `*`, `/`, `%`

## Risk Management Configuration

### How It Works

When you run a backtest, you configure risk parameters separately from your strategy:

```
Backtest Configuration:
├── Initial Capital: $100,000
├── Symbol: AAPL
├── Timeframe: 1d
├── Date Range: 2024-01-01 to 2024-12-31
└── Risk Management:
    ├── Stop Loss: 2% (optional)
    └── Take Profit: 5% (optional)
```

### Stop-Loss and Take-Profit

These are **optional** parameters:

**Without Stop-Loss/Take-Profit:**
- Positions close only when your strategy signals an exit
- Pure strategy logic determines all exits
- Good for strategies with clear exit rules

**With Stop-Loss/Take-Profit:**
- Positions close automatically if price hits these levels
- Provides downside protection
- Good for strategies that might hold too long

### Example: Same Strategy, Different Risk

**Conservative (2% stop, 4% target):**
```
Win Rate: 65%
Profit Factor: 1.8
Max Drawdown: 8%
```

**Aggressive (5% stop, 10% target):**
```
Win Rate: 45%
Profit Factor: 2.2
Max Drawdown: 15%
```

Same strategy logic, different risk profiles!

## Complete Strategy Examples

### 1. EMA Crossover (Trend Following)

```javascript
// EMA Crossover Strategy
// @version=1

const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)
const rsi = ta.rsi(14)

// Entry: Fast EMA crosses above slow EMA, RSI not overbought
if (ema_fast > ema_slow && rsi < 70) {
    strategy.entry("Long", "long")
}

// Exit: Fast EMA crosses below slow EMA
if (ema_fast < ema_slow) {
    strategy.close("Long")
}
```

**Best Risk Config:**
- Stop Loss: 2-3%
- Take Profit: 5-8%
- Works well on: Daily timeframe

### 2. RSI Mean Reversion

```javascript
// RSI Mean Reversion
// @version=1

const rsi = ta.rsi(14)
const sma = ta.sma(50)

// Entry: RSI oversold and price above long-term SMA
if (rsi < 30 && close > sma) {
    strategy.entry("Long", "long")
}

// Exit: RSI returns to neutral
if (rsi > 50) {
    strategy.close("Long")
}
```

**Best Risk Config:**
- Stop Loss: 3-4%
- Take Profit: 6-10%
- Works well on: 1-hour to daily timeframe

### 3. Bollinger Band Breakout

```javascript
// Bollinger Band Breakout
// @version=1

const bb = ta.bb(20, 2)
const volume_sma = ta.sma(20) // volume SMA

// Entry: Price breaks above upper band with volume
if (close > bb.upper && volume > volume_sma * 1.5) {
    strategy.entry("Long", "long")
}

// Exit: Price crosses back below middle band
if (close < bb.middle) {
    strategy.close("Long")
}
```

**Best Risk Config:**
- Stop Loss: 2-3%
- Take Profit: 5-7%
- Works well on: 15-minute to 1-hour timeframe

### 4. Multi-Indicator Confirmation

```javascript
// Multi-Indicator Strategy
// @version=1

const ema_fast = ta.ema(12)
const ema_slow = ta.ema(26)
const rsi = ta.rsi(14)
const macd = ta.macd(12, 26, 9)
const atr = ta.atr(14)

// Entry: Multiple confirmations
if (ema_fast > ema_slow && 
    rsi > 40 && rsi < 70 && 
    macd > 0 && 
    atr > ta.sma(14)) { // Volatility filter
    strategy.entry("Long", "long")
}

// Exit: Any indicator turns bearish
if (ema_fast < ema_slow || rsi > 75 || macd < 0) {
    strategy.close("Long")
}
```

**Best Risk Config:**
- Stop Loss: 1.5-2.5%
- Take Profit: 4-6%
- Works well on: 1-hour to 4-hour timeframe

## Best Practices

### 1. Keep It Simple

Start with simple strategies:
```javascript
// ✅ Good: Clear and simple
if (rsi < 30) {
    strategy.entry("Long", "long")
}

// ❌ Avoid: Overly complex
if (rsi < 30 && macd > 0 && ema_9 > ema_21 && 
    volume > volume_sma && close > open && 
    stoch < 20 && cci < -100) {
    strategy.entry("Long", "long")
}
```

### 2. Use Clear Variable Names

```javascript
// ✅ Good
const fast_ema = ta.ema(9)
const slow_ema = ta.ema(21)

// ❌ Avoid
const e1 = ta.ema(9)
const e2 = ta.ema(21)
```

### 3. Comment Your Logic

```javascript
// Entry: Buy when price is oversold and trending up
if (rsi < 30 && ema_fast > ema_slow) {
    strategy.entry("Long", "long")
}
```

### 4. Test Multiple Timeframes

The same strategy can perform differently on different timeframes:
- **1-minute**: High frequency, many trades
- **5-minute**: Scalping strategies
- **1-hour**: Intraday trading
- **1-day**: Swing trading
- **1-week**: Position trading

### 5. Optimize Risk Parameters

Test your strategy with different risk settings:
- Conservative: 1-2% stop, 3-5% target
- Moderate: 2-3% stop, 5-8% target
- Aggressive: 3-5% stop, 8-12% target

## Common Mistakes

### 1. Mixing Strategy and Risk Logic

```javascript
// ❌ Don't do this
if (close > entry_price * 1.05) {
    strategy.close("Long") // Take profit in script
}

// ✅ Do this instead
// Set take profit in backtest config
// Keep script focused on strategy logic
```

### 2. Over-Optimization

```javascript
// ❌ Too specific
if (rsi === 29.5 && macd === 0.0023) {
    strategy.entry("Long", "long")
}

// ✅ More robust
if (rsi < 30 && macd > 0) {
    strategy.entry("Long", "long")
}
```

### 3. Look-Ahead Bias

```javascript
// ❌ Using future data
const tomorrow_high = high[1] // Can't know this yet!

// ✅ Using past data
const yesterday_high = high[-1] // Historical data
```

### 4. Ignoring Market Conditions

```javascript
// ❌ Always trading
if (rsi < 30) {
    strategy.entry("Long", "long")
}

// ✅ Adding filters
const trend = ta.ema(50)
if (rsi < 30 && close > trend) { // Only in uptrend
    strategy.entry("Long", "long")
}
```

## Workflow

### 1. Develop Strategy

1. Write your strategy in the Pine Script editor
2. Focus on entry/exit logic only
3. Test compilation with "Verify" button

### 2. Configure Backtest

1. Select symbol and timeframe
2. Set date range
3. Configure initial capital
4. Set risk parameters (optional)

### 3. Run and Analyze

1. Click "Run Backtest"
2. Review performance metrics
3. Analyze equity curve
4. Check trade distribution

### 4. Optimize

1. Adjust indicator parameters
2. Try different risk settings
3. Test on different symbols
4. Test on different timeframes

### 5. Save and Deploy

1. Save successful strategies
2. Document your findings
3. Deploy to live trading (Active Trader)

## Performance Metrics

### Key Metrics to Watch

**Profitability:**
- Total Return: Overall profit/loss
- Win Rate: Percentage of winning trades
- Profit Factor: Gross profit / Gross loss
- Average Win/Loss: Size of typical trades

**Risk:**
- Max Drawdown: Largest peak-to-trough decline
- Sharpe Ratio: Risk-adjusted returns
- Recovery Factor: Net profit / Max drawdown

**Activity:**
- Total Trades: Number of trades executed
- Average Trade Duration: How long positions are held
- Trades Per Day/Week: Trading frequency

### What Makes a Good Strategy?

**Minimum Requirements:**
- Win Rate: > 50% (or high profit factor if lower)
- Profit Factor: > 1.5
- Max Drawdown: < 20%
- Sharpe Ratio: > 1.0
- Total Trades: > 30 (for statistical significance)

**Excellent Strategy:**
- Win Rate: > 60%
- Profit Factor: > 2.0
- Max Drawdown: < 15%
- Sharpe Ratio: > 2.0
- Consistent across timeframes

## Getting Help

### Resources

1. **Learn Page**: `/learn` - Interactive tutorials
2. **Examples**: Pre-built strategy templates
3. **Documentation**: This guide
4. **Community**: Share strategies with other users

### Troubleshooting

**Script won't compile:**
- Check syntax (missing brackets, semicolons)
- Verify function names (ta.ema, not ta.EMA)
- Ensure variables are declared with `const`

**No trades generated:**
- Check if conditions are too strict
- Verify data is available for symbol/timeframe
- Add console logging to debug

**Poor performance:**
- Try different risk parameters
- Test on different timeframes
- Simplify strategy logic
- Add filters to reduce false signals

---

**Version**: 1.0.0
**Last Updated**: 2026-03-06
**Engine**: Mahita Pine Script v1
