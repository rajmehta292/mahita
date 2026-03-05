# 04 - Backtesting and Execution Engine Blueprint

## Executive Summary
This document outlines the core strategy evaluation matrix and timeline simulation process that drives algorithmic testing.

## 1. Strategy JSON Syntax (AST)
Instead of raw arbitrary script files, the frontend exports robust explicit objects referencing risk sizes and entry parameter condition arrays:
```json
{
  "asset": "AAPL",
  "timeframe": "1d",
  "riskManagement": { "positionSizingPercent": 10 },
  "entryConditions": {
    "logic": "AND",
    "rules": [ { "indicator": "RSI", "parameter": 14, "operator": "<", "value": 30 } ]
  }
}
```

## 2. The Engine Loop (Bar-By-Bar)
Modeled loosely on Pine Script V5 execution timeline processing:
1.  **Ingest Bar**: Step the chronological loop forward by one discrete time entry.
2.  **Calculate Local Features**: Update running averages of SMA, EMA, or RSI buffers for state comparisons using packages like `technicalindicators`.
3.  **Evaluate Tree**: Determine if `AST Rules (Indicators) (Operators) -> True/False`.
4.  **Route Signal**: If the gate is true, emit `'Buy'` or `'Sell'` to the injected `IBrokerageProvider`.

## 3. Paper Simulation Mechanics
*   **The Ledger**: Internally track the initial cash buffer, minus real-world variables like slippage thresholds (`~0.05%`) and standard exchange commissions (`~0.1%`) per leg processed.
*   **The Compiler**: Process the closed loop PnL array into normalized outputs for the frontend (Metrics: Drawdown %, Win Rate %, Total Net Profit).
