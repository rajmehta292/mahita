import {
  ScreenerFieldDefinition,
  ScreenerFieldOption,
  ScreenerPresetDocument,
  ScreenerResultTabDefinition,
} from "@/lib/screener/types"

const ANY_OPTION: ScreenerFieldOption = { value: "any", label: "Any" }

function withAny(options: ScreenerFieldOption[]): ScreenerFieldOption[] {
  return [ANY_OPTION, ...options]
}

const RANGE_OPTIONS = {
  marketCap: withAny([
    { value: "mega_cap", label: "Mega cap (>$200B)" },
    { value: "large_cap", label: "Large cap (>$10B)" },
    { value: "mid_cap", label: "Mid cap ($2B-$10B)" },
    { value: "small_cap", label: "Small cap (<$2B)" },
  ]),
  price: withAny([
    { value: "under_10", label: "Under $10" },
    { value: "under_50", label: "Under $50" },
    { value: "between_10_50", label: "$10-$50" },
    { value: "between_50_200", label: "$50-$200" },
    { value: "over_200", label: "Over $200" },
  ]),
  volume: withAny([
    { value: "over_100k", label: "Over 100K" },
    { value: "over_500k", label: "Over 500K" },
    { value: "over_1m", label: "Over 1M" },
    { value: "over_5m", label: "Over 5M" },
  ]),
  percent: withAny([
    { value: "negative", label: "Negative" },
    { value: "positive", label: "Positive" },
    { value: "over_5", label: "Over 5%" },
    { value: "over_10", label: "Over 10%" },
    { value: "under_5", label: "Under 5%" },
  ]),
  analyst: withAny([
    { value: "strong_buy", label: "Strong buy (<=1.5)" },
    { value: "buy", label: "Buy (<=2.5)" },
    { value: "hold_or_better", label: "Hold or better (<=3.0)" },
  ]),
  recommendation: withAny([
    { value: "positive", label: "Positive" },
    { value: "negative", label: "Negative" },
  ]),
  boolean: withAny([
    { value: "yes", label: "Yes" },
    { value: "no", label: "No" },
  ]),
}

const DESCRIPTIVE_FIELDS: ScreenerFieldDefinition[] = [
  {
    key: "exchange",
    label: "Exchange",
    group: "descriptive",
    valueType: "enum",
    assetScope: "all",
    options: withAny([
      { value: "NASDAQ", label: "NASDAQ" },
      { value: "NYSE", label: "NYSE" },
      { value: "AMEX", label: "AMEX" },
      { value: "OTC", label: "OTC" },
    ]),
  },
  {
    key: "country",
    label: "Country",
    group: "descriptive",
    valueType: "enum",
    assetScope: "all",
    options: withAny([
      { value: "USA", label: "USA" },
      { value: "Canada", label: "Canada" },
      { value: "China", label: "China" },
      { value: "UK", label: "UK" },
      { value: "Japan", label: "Japan" },
    ]),
  },
  {
    key: "sector",
    label: "Sector",
    group: "descriptive",
    valueType: "enum",
    assetScope: "equity",
    options: withAny([
      { value: "Technology", label: "Technology" },
      { value: "Healthcare", label: "Healthcare" },
      { value: "Financial", label: "Financial" },
      { value: "Consumer Cyclical", label: "Consumer Cyclical" },
      { value: "Industrials", label: "Industrials" },
      { value: "Energy", label: "Energy" },
      { value: "Basic Materials", label: "Basic Materials" },
      { value: "Communication Services", label: "Communication Services" },
      { value: "Consumer Defensive", label: "Consumer Defensive" },
      { value: "Utilities", label: "Utilities" },
      { value: "Real Estate", label: "Real Estate" },
    ]),
  },
  {
    key: "industry",
    label: "Industry",
    group: "descriptive",
    valueType: "string",
    assetScope: "equity",
    options: [ANY_OPTION],
  },
  {
    key: "marketCap",
    label: "Market Cap.",
    group: "descriptive",
    valueType: "number",
    assetScope: "all",
    options: RANGE_OPTIONS.marketCap,
  },
  {
    key: "dividendYield",
    label: "Dividend Yield",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: RANGE_OPTIONS.percent,
  },
  {
    key: "averageVolume",
    label: "Average Volume",
    group: "descriptive",
    valueType: "number",
    assetScope: "all",
    options: RANGE_OPTIONS.volume,
  },
  {
    key: "relativeVolume",
    label: "Relative Volume",
    group: "descriptive",
    valueType: "number",
    assetScope: "all",
    options: withAny([
      { value: "over_1", label: "Over 1x" },
      { value: "over_1_5", label: "Over 1.5x" },
      { value: "over_2", label: "Over 2x" },
      { value: "over_3", label: "Over 3x" },
    ]),
  },
  {
    key: "currentVolume",
    label: "Current Volume",
    group: "descriptive",
    valueType: "number",
    assetScope: "all",
    options: RANGE_OPTIONS.volume,
  },
  {
    key: "price",
    label: "Price $",
    group: "descriptive",
    valueType: "number",
    assetScope: "all",
    options: RANGE_OPTIONS.price,
  },
  {
    key: "targetPrice",
    label: "Target Price",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: RANGE_OPTIONS.price,
  },
  {
    key: "analystRecom",
    label: "Analyst Recom.",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: RANGE_OPTIONS.analyst,
  },
  {
    key: "shortFloat",
    label: "Short Float",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: RANGE_OPTIONS.percent,
  },
  {
    key: "sharesOutstanding",
    label: "Shares Outstanding",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: withAny([
      { value: "under_100m", label: "Under 100M" },
      { value: "over_100m", label: "Over 100M" },
      { value: "over_1b", label: "Over 1B" },
      { value: "over_10b", label: "Over 10B" },
    ]),
  },
  {
    key: "floatShares",
    label: "Float",
    group: "descriptive",
    valueType: "number",
    assetScope: "equity",
    options: withAny([
      { value: "under_50m", label: "Under 50M" },
      { value: "over_50m", label: "Over 50M" },
      { value: "over_500m", label: "Over 500M" },
    ]),
  },
]

const FUNDAMENTAL_FIELDS: ScreenerFieldDefinition[] = [
  { key: "pe", label: "P/E", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_15", label: "Under 15" }, { value: "under_25", label: "Under 25" }, { value: "over_25", label: "Over 25" }]) },
  { key: "forwardPe", label: "Forward P/E", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_15", label: "Under 15" }, { value: "under_25", label: "Under 25" }, { value: "over_25", label: "Over 25" }]) },
  { key: "peg", label: "PEG", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_1", label: "Under 1" }, { value: "under_2", label: "Under 2" }, { value: "over_2", label: "Over 2" }]) },
  { key: "ps", label: "P/S", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_2", label: "Under 2" }, { value: "under_5", label: "Under 5" }, { value: "over_5", label: "Over 5" }]) },
  { key: "pb", label: "P/B", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_3", label: "Under 3" }, { value: "under_8", label: "Under 8" }, { value: "over_8", label: "Over 8" }]) },
  { key: "epsGrowthThisYear", label: "EPS Growth This Year", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "epsGrowthNextYear", label: "EPS Growth Next Year", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "epsGrowthQoq", label: "EPS Growth Qtr/Qtr", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "salesGrowthQoq", label: "Sales Growth Qtr/Qtr", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "returnOnAssets", label: "Return on Assets", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "returnOnEquity", label: "Return on Equity", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "returnOnInvestedCapital", label: "Return on Invested Capital", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "currentRatio", label: "Current Ratio", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_1", label: "Under 1" }, { value: "over_1", label: "Over 1" }, { value: "over_2", label: "Over 2" }]) },
  { key: "debtToEquity", label: "Debt/Equity", group: "fundamental", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_0_5", label: "Under 0.5" }, { value: "under_1", label: "Under 1" }, { value: "over_1", label: "Over 1" }]) },
  { key: "grossMargin", label: "Gross Margin", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "operatingMargin", label: "Operating Margin", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "netProfitMargin", label: "Net Profit Margin", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
  { key: "institutionalOwnership", label: "Institutional Ownership", group: "fundamental", valueType: "number", assetScope: "equity", options: RANGE_OPTIONS.percent },
]

const TECHNICAL_FIELDS: ScreenerFieldDefinition[] = [
  { key: "performance1d", label: "Performance", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "performance1m", label: "Performance 2", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "volatility30d", label: "Volatility", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "rsi14", label: "RSI (14)", group: "technical", valueType: "number", assetScope: "all", options: withAny([{ value: "under_30", label: "Under 30" }, { value: "under_50", label: "Under 50" }, { value: "over_50", label: "Over 50" }, { value: "over_70", label: "Over 70" }]) },
  { key: "gapPercent", label: "Gap", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "priceVsSma20", label: "20-Day SMA", group: "technical", valueType: "enum", assetScope: "all", options: withAny([{ value: "above", label: "Above 20D SMA" }, { value: "below", label: "Below 20D SMA" }]) },
  { key: "priceVsSma50", label: "50-Day SMA", group: "technical", valueType: "enum", assetScope: "all", options: withAny([{ value: "above", label: "Above 50D SMA" }, { value: "below", label: "Below 50D SMA" }]) },
  { key: "priceVsSma200", label: "200-Day SMA", group: "technical", valueType: "enum", assetScope: "all", options: withAny([{ value: "above", label: "Above 200D SMA" }, { value: "below", label: "Below 200D SMA" }]) },
  { key: "highLow20d", label: "20-Day High/Low", group: "technical", valueType: "enum", assetScope: "all", options: withAny([{ value: "near_high", label: "Near 20D High" }, { value: "near_low", label: "Near 20D Low" }]) },
  { key: "highLow52w", label: "52-Week High/Low", group: "technical", valueType: "enum", assetScope: "all", options: withAny([{ value: "breakout", label: "52W Breakout" }, { value: "near_high", label: "Near 52W High" }, { value: "near_low", label: "Near 52W Low" }]) },
  { key: "changePercent", label: "Change", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "changeFromOpen", label: "Change from Open", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.percent },
  { key: "beta", label: "Beta", group: "technical", valueType: "number", assetScope: "equity", options: withAny([{ value: "under_1", label: "Under 1" }, { value: "over_1", label: "Over 1" }, { value: "over_1_5", label: "Over 1.5" }]) },
  { key: "atr14", label: "Average True Range", group: "technical", valueType: "number", assetScope: "all", options: RANGE_OPTIONS.price },
  { key: "latestAfterHours", label: "After-Hours Close", group: "technical", valueType: "boolean", assetScope: "equity", options: RANGE_OPTIONS.boolean },
]

const NEWS_FIELDS: ScreenerFieldDefinition[] = [
  { key: "latestNews", label: "Latest News", group: "news", valueType: "boolean", assetScope: "all", options: RANGE_OPTIONS.boolean },
  { key: "newsKeywords", label: "News Keywords", group: "news", valueType: "string", assetScope: "all", options: [ANY_OPTION] },
]

const ETF_FIELDS: ScreenerFieldDefinition[] = [
  { key: "assetType", label: "Asset Type", group: "etf", valueType: "enum", assetScope: "all", options: withAny([{ value: "equity", label: "Equity" }, { value: "etf", label: "ETF" }, { value: "crypto", label: "Crypto" }, { value: "forex", label: "Forex" }]) },
  { key: "sponsor", label: "Sponsor", group: "etf", valueType: "string", assetScope: "etf", options: [ANY_OPTION] },
  { key: "netExpenseRatio", label: "Net Expense Ratio", group: "etf", valueType: "number", assetScope: "etf", options: withAny([{ value: "under_0_25", label: "Under 0.25%" }, { value: "under_0_75", label: "Under 0.75%" }, { value: "over_0_75", label: "Over 0.75%" }]) },
  { key: "annualizedReturn", label: "Annualized Return", group: "etf", valueType: "number", assetScope: "etf", options: RANGE_OPTIONS.percent },
  { key: "netFundFlows", label: "Net Fund Flows", group: "etf", valueType: "number", assetScope: "etf", options: withAny([{ value: "positive", label: "Positive" }, { value: "negative", label: "Negative" }]) },
  { key: "sectorTheme", label: "Sector/Theme", group: "etf", valueType: "string", assetScope: "etf", options: [ANY_OPTION] },
  { key: "region", label: "Region", group: "etf", valueType: "string", assetScope: "etf", options: [ANY_OPTION] },
]

export const SCREENER_FIELDS: ScreenerFieldDefinition[] = [
  ...DESCRIPTIVE_FIELDS,
  ...FUNDAMENTAL_FIELDS,
  ...TECHNICAL_FIELDS,
  ...NEWS_FIELDS,
  ...ETF_FIELDS,
]

export const SCREENER_SIGNALS = [
  { value: "none", label: "None (all stocks)" },
  { value: "oversold_rsi", label: "Oversold RSI" },
  { value: "above_20d_sma", label: "Above 20D SMA" },
  { value: "above_50d_sma", label: "Above 50D SMA" },
  { value: "breakout_52w", label: "52-week breakout" },
  { value: "high_relative_volume", label: "High relative volume" },
]

export const SCREENER_GROUP_TABS = [
  { key: "descriptive", label: "Descriptive" },
  { key: "fundamental", label: "Fundamental" },
  { key: "technical", label: "Technical" },
  { key: "news", label: "News" },
  { key: "etf", label: "ETF" },
  { key: "all", label: "All" },
] as const

export const SCREENER_RESULT_TABS: ScreenerResultTabDefinition[] = [
  { key: "overview", label: "Overview", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "sector", label: "Sector" }, { key: "industry", label: "Industry" }, { key: "country", label: "Country" }, { key: "marketCap", label: "Market Cap", align: "right", format: "marketCap" }, { key: "fundamental.pe", label: "P/E", align: "right", format: "number" }, { key: "price", label: "Price", align: "right", format: "price" }, { key: "changePercent", label: "Change", align: "right", format: "percent" }, { key: "volume", label: "Volume", align: "right", format: "volume" }] },
  { key: "valuation", label: "Valuation", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "fundamental.pe", label: "P/E", align: "right", format: "number" }, { key: "fundamental.forwardPe", label: "Forward P/E", align: "right", format: "number" }, { key: "fundamental.peg", label: "PEG", align: "right", format: "number" }, { key: "fundamental.pb", label: "P/B", align: "right", format: "number" }, { key: "fundamental.ps", label: "P/S", align: "right", format: "number" }, { key: "marketCap", label: "Market Cap", align: "right", format: "marketCap" }] },
  { key: "financial", label: "Financial", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "fundamental.epsGrowthThisYear", label: "EPS Growth TY", align: "right", format: "percent" }, { key: "fundamental.epsGrowthNextYear", label: "EPS Growth NY", align: "right", format: "percent" }, { key: "fundamental.salesGrowthQoq", label: "Sales Growth QoQ", align: "right", format: "percent" }, { key: "fundamental.currentRatio", label: "Current Ratio", align: "right", format: "number" }, { key: "fundamental.debtToEquity", label: "Debt/Equity", align: "right", format: "number" }] },
  { key: "ownership", label: "Ownership", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "fundamental.institutionalOwnership", label: "Institutional Ownership", align: "right", format: "percent" }, { key: "descriptive.sharesOutstanding", label: "Shares Outstanding", align: "right", format: "number" }, { key: "descriptive.floatShares", label: "Float", align: "right", format: "number" }, { key: "descriptive.shortFloat", label: "Short Float", align: "right", format: "percent" }] },
  { key: "performance", label: "Performance", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "technical.performance1d", label: "1D", align: "right", format: "percent" }, { key: "technical.performance1m", label: "1M", align: "right", format: "percent" }, { key: "technical.volatility30d", label: "Volatility", align: "right", format: "percent" }, { key: "volume", label: "Volume", align: "right", format: "volume" }] },
  { key: "technical", label: "Technical", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "technical.rsi14", label: "RSI(14)", align: "right", format: "number" }, { key: "technical.priceVsSma20", label: "20D SMA", align: "right", format: "text" }, { key: "technical.priceVsSma50", label: "50D SMA", align: "right", format: "text" }, { key: "technical.highLow52w", label: "52W Range", align: "right", format: "text" }, { key: "technical.atr14", label: "ATR", align: "right", format: "number" }] },
  { key: "etf", label: "ETF", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Name" }, { key: "assetType", label: "Asset Type" }, { key: "etf.sponsor", label: "Sponsor" }, { key: "etf.netExpenseRatio", label: "Expense Ratio", align: "right", format: "percent" }, { key: "etf.netFundFlows", label: "Net Flows", align: "right", format: "number" }] },
  { key: "etf_perf", label: "ETF Perf", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Name" }, { key: "etf.annualizedReturn", label: "Annualized Return", align: "right", format: "percent" }, { key: "changePercent", label: "Change", align: "right", format: "percent" }, { key: "volume", label: "Volume", align: "right", format: "volume" }] },
  { key: "custom", label: "Custom", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "exchange", label: "Exchange" }, { key: "sector", label: "Sector" }, { key: "price", label: "Price", align: "right", format: "price" }] },
  { key: "charts", label: "Charts", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "price", label: "Price", align: "right", format: "price" }, { key: "changePercent", label: "Change", align: "right", format: "percent" }] },
  { key: "tickers", label: "Tickers", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "assetType", label: "Type" }, { key: "exchange", label: "Exchange" }, { key: "country", label: "Country" }] },
  { key: "basic", label: "Basic", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "marketCap", label: "Market Cap", align: "right", format: "marketCap" }, { key: "price", label: "Price", align: "right", format: "price" }, { key: "volume", label: "Volume", align: "right", format: "volume" }] },
  { key: "ta", label: "TA", columns: [{ key: "symbol", label: "Ticker" }, { key: "technical.rsi14", label: "RSI", align: "right", format: "number" }, { key: "technical.relativeVolume", label: "Rel Volume", align: "right", format: "number" }, { key: "technical.priceVsSma20", label: "20D SMA" }, { key: "technical.priceVsSma50", label: "50D SMA" }, { key: "technical.highLow52w", label: "52W Range" }] },
  { key: "news", label: "News", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "news.latestNews", label: "Latest News" }, { key: "news.newsKeywords", label: "Keywords" }, { key: "updatedAt", label: "Updated" }] },
  { key: "snapshot", label: "Snapshot", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "sector", label: "Sector" }, { key: "fundamental.pe", label: "P/E", align: "right", format: "number" }, { key: "technical.rsi14", label: "RSI", align: "right", format: "number" }, { key: "changePercent", label: "Change", align: "right", format: "percent" }] },
  { key: "maps", label: "Maps", columns: [{ key: "symbol", label: "Ticker" }, { key: "sector", label: "Sector" }, { key: "industry", label: "Industry" }, { key: "marketCap", label: "Market Cap", align: "right", format: "marketCap" }, { key: "changePercent", label: "Change", align: "right", format: "percent" }] },
  { key: "stats", label: "Stats", columns: [{ key: "symbol", label: "Ticker" }, { key: "name", label: "Company" }, { key: "descriptive.averageVolume", label: "Avg Volume", align: "right", format: "volume" }, { key: "descriptive.currentVolume", label: "Current Volume", align: "right", format: "volume" }, { key: "technical.volatility30d", label: "Volatility", align: "right", format: "percent" }, { key: "technical.beta", label: "Beta", align: "right", format: "number" }] },
]

export const BUILT_IN_SCREENER_PRESETS: ScreenerPresetDocument[] = [
  { name: "All stocks", groupTab: "descriptive", resultTab: "overview", orderKey: "symbol", orderDirection: "asc", signal: "none", filters: [], builtIn: true },
  { name: "Dow 30", groupTab: "descriptive", resultTab: "overview", orderKey: "symbol", orderDirection: "asc", signal: "none", filters: [{ field: "tickerCollection", value: "dow30" }], builtIn: true },
  { name: "S&P 500", groupTab: "descriptive", resultTab: "overview", orderKey: "symbol", orderDirection: "asc", signal: "none", filters: [{ field: "tickerCollection", value: "sp500" }], builtIn: true },
  { name: "ETFs", groupTab: "etf", resultTab: "etf", orderKey: "symbol", orderDirection: "asc", signal: "none", filters: [{ field: "assetType", value: "etf" }], builtIn: true },
  { name: "Large-cap value", groupTab: "fundamental", resultTab: "valuation", orderKey: "marketCap", orderDirection: "desc", signal: "none", filters: [{ field: "marketCap", value: "large_cap" }, { field: "pe", value: "under_25" }] },
  { name: "High relative volume", groupTab: "technical", resultTab: "technical", orderKey: "technical.relativeVolume", orderDirection: "desc", signal: "high_relative_volume", filters: [{ field: "relativeVolume", value: "over_2" }] },
  { name: "Oversold", groupTab: "technical", resultTab: "technical", orderKey: "technical.rsi14", orderDirection: "asc", signal: "oversold_rsi", filters: [{ field: "rsi14", value: "under_30" }] },
  { name: "Momentum breakout", groupTab: "technical", resultTab: "technical", orderKey: "changePercent", orderDirection: "desc", signal: "breakout_52w", filters: [{ field: "highLow52w", value: "breakout" }, { field: "relativeVolume", value: "over_1_5" }] },
  { name: "Dividend", groupTab: "fundamental", resultTab: "financial", orderKey: "fundamental.dividendYield", orderDirection: "desc", signal: "none", filters: [{ field: "dividendYield", value: "positive" }] },
]
