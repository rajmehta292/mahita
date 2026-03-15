export type IndicatorKind = 'indicator' | 'strategy' | 'profile' | 'pattern'
export type IndicatorPane = 'overlay' | 'volume' | 'oscillator'

export interface IndicatorCatalogItem {
    id: string
    name: string
    shortLabel: string
    kind: IndicatorKind
    pane: IndicatorPane
    category: string
    description: string
    defaultParams?: Record<string, number | string | boolean>
}

export const BUILT_IN_INDICATORS: IndicatorCatalogItem[] = [
    {
        id: 'volume',
        name: 'Volume',
        shortLabel: 'VOL',
        kind: 'indicator',
        pane: 'volume',
        category: 'Technicals',
        description: 'Volume bars overlaid below price.',
    },
    {
        id: 'macd',
        name: 'Moving Average Convergence Divergence',
        shortLabel: 'MACD',
        kind: 'indicator',
        pane: 'oscillator',
        category: 'Technicals',
        description: 'Momentum oscillator with histogram, MACD line, and signal line.',
        defaultParams: { fast: 12, slow: 26, signal: 9 },
    },
    {
        id: 'rsi',
        name: 'Relative Strength Index',
        shortLabel: 'RSI',
        kind: 'indicator',
        pane: 'oscillator',
        category: 'Technicals',
        description: 'Momentum oscillator that measures recent price strength.',
        defaultParams: { length: 14 },
    },
    {
        id: 'ema',
        name: 'Exponential Moving Average',
        shortLabel: 'EMA',
        kind: 'indicator',
        pane: 'overlay',
        category: 'Technicals',
        description: 'Overlay moving average weighted toward recent prices.',
        defaultParams: { length: 21 },
    },
    {
        id: 'sma',
        name: 'Simple Moving Average',
        shortLabel: 'SMA',
        kind: 'indicator',
        pane: 'overlay',
        category: 'Technicals',
        description: 'Overlay simple moving average.',
        defaultParams: { length: 50 },
    },
    {
        id: 'bollinger',
        name: 'Bollinger Bands',
        shortLabel: 'BB',
        kind: 'indicator',
        pane: 'overlay',
        category: 'Technicals',
        description: 'Overlay volatility bands around a simple moving average.',
        defaultParams: { length: 20, stdDev: 2 },
    },
    {
        id: 'vwap',
        name: 'Volume Weighted Average Price',
        shortLabel: 'VWAP',
        kind: 'indicator',
        pane: 'overlay',
        category: 'Technicals',
        description: 'Overlay intraday volume-weighted average price.',
    },
    {
        id: 'atr',
        name: 'Average True Range',
        shortLabel: 'ATR',
        kind: 'indicator',
        pane: 'oscillator',
        category: 'Technicals',
        description: 'Volatility indicator measuring true range smoothing.',
        defaultParams: { length: 14 },
    },
]

export const PROFILE_ITEMS: IndicatorCatalogItem[] = [
    {
        id: 'price-volume-profile',
        name: 'Price / Volume Profile',
        shortLabel: 'Profile',
        kind: 'profile',
        pane: 'overlay',
        category: 'Profiles',
        description: 'Reserved slot for future profile-style overlays.',
    },
]

export const PATTERN_ITEMS: IndicatorCatalogItem[] = [
    {
        id: 'swing-structure',
        name: 'Swing Structure',
        shortLabel: 'Pattern',
        kind: 'pattern',
        pane: 'overlay',
        category: 'Patterns',
        description: 'Reserved slot for future pattern detection overlays.',
    },
]
