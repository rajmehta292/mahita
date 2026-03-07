export const SP500_SYMBOLS = [
    "AAPL", "MSFT", "NVDA", "AMZN", "META", "GOOGL", "GOOG", "BRK.B", "LLY", "AVGO",
    "JPM", "TSLA", "UNH", "V", "XOM", "MA", "JNJ", "PG", "HD", "COST",
    "MRK", "ABBV", "CVX", "CRM", "AMD", "BAC", "NFLX", "KO", "PEP", "TMO",
    "ADBE", "WMT", "LIN", "MCD", "DIS", "CSCO", "ABT", "INTC", "DHR", "INTU",
    "VZ", "CMCSA", "PFE", "AMAT", "IBM", "NOW", "AXP", "TXN", "COP", "CAT",
    "GE", "AMGN", "ISRG", "UNP", "BA", "HON", "SPGI", "QCOM", "SYK", "BKNG",
    "LRCX", "RTX", "VRTX", "LOW", "PGR", "TJX", "ELV", "ETN", "BSX", "CB",
    "GS", "C", "MDT", "REGN", "ADI", "SCHW", "MMC", "SBUX", "ADP", "CI",
    "SLB", "FI", "PANW", "MDLZ", "BDX", "ZTS", "KLAC", "BMY", "DE", "GILD",
    "CSX", "MU", "CME", "SNPS", "LMT", "CDNS", "SO", "EOG", "AON", "SHW"
];

export const CRYPTO_SYMBOLS = [
    "BTC-USD", "ETH-USD", "USDT-USD", "BNB-USD", "SOL-USD", "USDC-USD", "XRP-USD", 
    "ADA-USD", "AVAX-USD", "DOGE-USD", "TRX-USD", "DOT-USD", "LINK-USD", "MATIC-USD", "TON11419-USD"
];

export const FOREX_SYMBOLS = [
    "EURUSD=X", "USDJPY=X", "GBPUSD=X", "USDCHF=X", "AUDUSD=X", "USDCAD=X", 
    "NZDUSD=X", "EURGBP=X", "EURJPY=X", "GBPJPY=X"
];

export const GLOBAL_UNIVERSE = [
    ...SP500_SYMBOLS,
    ...CRYPTO_SYMBOLS,
    ...FOREX_SYMBOLS
];
