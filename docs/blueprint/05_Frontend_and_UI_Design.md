# 05 - Frontend and UI Design Blueprint

## Executive Summary
This document acts as the visual spec sheet mapping the Next.js React hierarchy and strict CSS styling bounds.

## 1. UI Aesthetic Design
*   **Glassmorphism**: Visual structures rely on `backdrop-blur()`, low opacity gray/black hex variations, and high-contrast red/gold accent color definitions to evoke strong institutional authority.
*   **Responsiveness**: Main trading views require minimum viewport constraints (unsuited for heavy mobile usage) to accommodate full dashboard real-estate requirements.

## 2. TradingView Charts WebGL Integration
*   The primary component relies explicitly on `@lightweight-charts` from TradingView.
*   Standard HTML or SVG engines (Recharts/Chart.js) are explicitly banned for the primary pricing chart due to rendering latency exceeding 1000 candles.
*   **Integration Method**: Construct a strict functional wrapper with hooks (`useRef`, `createChart()`, `candlestickSeries.setData()`) and map execution result markers across the series interface natively utilizing their optimized canvas plotting.

## 3. Sub-Component Matrix
*   **Sidebar Configuration**: Dynamic input grids handling Strategy JSON construction.
*   **Execution Logs**: Scroll-normalized tables reflecting `BrokerProvider` post-compilation PnL returns on the client side.
