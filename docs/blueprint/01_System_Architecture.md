# 01 - System Architecture Blueprint

## Executive Summary
This document outlines the high-level system architecture for the new trading terminal to be hosted on `mahita.ai`. The system is designed to provide institutional-grade features (backtesting, live trading, multi-broker support) via a web browser while ensuring user data privacy and extremely low latency by executing logic and storing data on the local host machine.

## 1. High-Level Architecture Overview

The application follows a monolithic client-server architecture with several distinct layers:

```mermaid
graph TD
    Client[Browser Client - Any Device] --> CF[Cloudflare Tunnel mahita.ai]
    CF --> Auth[Next.js Auth Middleware]
    Auth --> Server[Next.js API Routes / Node Server]
    
    Server --> MDE[Market Data Engine]
    Server --> TE[Trading Engine Backtesting & Live]
    Server --> BE[Broker Emulator]
    Server --> DB[(Local PostgreSQL / SQLite DB)]
    
    MDE --> SchwabAPI[Schwab API Client]
    MDE --> AlpacaAPI[Alpaca API Client]
    
    TE --> Paper[Paper Trading Provider]
    TE --> Live[Live Trading Provider]
   
    DB -.-> MDE
    DB -.-> TE
```

## 2. Technology Stack
*   **Frontend**: Next.js (React), Tailwind CSS, Lightweight Charts (TradingView) for fast chart rendering.
*   **Backend**: Next.js API Routes, Prisma ORM, SQLite/PostgreSQL Database.
*   **Infrastructure**: Hosted locally, served publicly over Cloudflare Tunnel over `mahita.ai`.

## 3. Core System Components
*   **MarketDataStore**: Proxy caching service handling all external ticker HTTP REST requests and WebSockets.
*   **TradingEngine**: Evaluates JSON-structured logic ASTs to issue synchronous buy/sell events.
*   **BrokerageProvider**: Interface standard allowing the engine to seamlessly switch between Paper/Mock and Schwab/Live accounts.
