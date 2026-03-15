export const DOW30_SYMBOLS = [
    "AAPL", "AMGN", "AMZN", "AXP", "BA", "CAT", "CRM", "CSCO", "CVX", "DIS",
    "GS", "HD", "HON", "IBM", "JNJ", "JPM", "KO", "MCD", "MMM", "MRK",
    "MSFT", "NKE", "NVDA", "PG", "SHW", "TRV", "UNH", "V", "VZ", "WMT",
];

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
    "CSX", "MU", "CME", "SNPS", "LMT", "CDNS", "SO", "EOG", "AON", "SHW",
    "MO", "ICE", "CVS", "FCX", "WM", "ITW", "CMG", "PH", "MCK", "FDX",
    "NOC", "T", "APH", "ECL", "PNC", "NXPI", "MAR", "CARR", "WELL", "USB",
    "EMR", "MMM", "HLT", "TGT", "TDG", "PYPL", "ORLY", "COF", "RSG", "PCAR",
    "AJG", "CSGP", "DXCM", "AIG", "NSC", "ROP", "NEM", "VLO", "O", "SPG",
    "F", "AZO", "CPRT", "TFC", "MCO", "PSA", "AFL", "KMB", "TRV", "MSI",
    "IDXX", "ROST", "CHTR", "PAYX", "TEL", "KMI", "D", "A", "OKE", "IQV",
    "AEP", "CNC", "SRE", "SYY", "EXC", "CTAS", "JCI", "NUE", "GWW", "YUM",
    "PCG", "TT", "PRU", "CTSH", "ALL", "AMP", "STZ", "GIS", "MTD", "PEG",
    "CCI", "ODFL", "FAST", "EA", "DFS", "FIS", "KVUE", "CSCO", "GPN", "KR",
    "WMB", "ROK", "BKR", "ADM", "BIIB", "DOW", "VICI", "FPA", "EXPE", "GLW",
    "HAL", "WBA", "HCA", "PPG", "CINF", "XYL", "HPQ", "CTRA", "VRSK", "VMC",
    "CAH", "KHC", "AWK", "EW", "IR", "DAL", "LGF.A", "CBRE", "TSCO", "VTR",
    "STT", "HES", "AEE", "EBAY", "HBI", "FITB", "NTRS", "DOV", "URI", "ZBH",
    "FTNT", "KEYS", "MTB", "WTW", "BRO", "INCY", "CHD", "CDW", "STE", "WEC",
    "ED", "EXPD", "VRSN", "ES", "K", "DTE", "ANET", "BR", "CPB", "RMD",
    "PFG", "AWK", "TFX", "AKAM", "CBOE", "BBY", "DPZ", "WDC", "TER", "PTC",
    "SJM", "NVR", "FMC", "HBAN", "VFC", "HRL", "RF", "CFG", "GPC", "TXT",
    "KMX", "LVS", "HOLX", "SWKS", "NTAP", "UDR", "KEY", "PKG", "CCL", "WAB",
    "EMN", "IP", "ESS", "BXP", "HST", "PEAK", "KIM", "UHS", "ALGN", "AAL",
    "WBD", "NRG", "CZR", "DISH", "SEE", "ROL", "PNW", "GEN", "FOXA", "FOX",
    "NWS", "NWSA", "IPG", "MAS", "LUV", "L", "HAS", "GNRC", "RL", "AAP",
    "BBWI", "TPR", "FRT", "MHK", "ZION", "CMA", "IVZ", "DXC", "VNO", "GL"
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
