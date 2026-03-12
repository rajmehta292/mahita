import fs from 'node:fs/promises';
import path from 'node:path';

const CSV_PATH = path.join(process.cwd(), 'data', 'top_1000_assets_by_market_cap.csv');

type YahooSearchQuote = {
    symbol: string
    exchange?: string
    isYahooFinance?: boolean
}

type YahooSearchResponse = {
    quotes?: YahooSearchQuote[]
}

async function resolveTicker(name: string, originalTicker: string): Promise<string> {
    // If the ticker is a standard US ticker (1-5 uppercase letters, no numbers, no dots except BRK.B)
    if (/^[A-Z]{1,5}$/.test(originalTicker) || originalTicker === 'BRK-B' || originalTicker === 'BRK-A') {
        return originalTicker;
    }

    // Crypto
    if (originalTicker === 'BTC') return 'BTC-USD';
    if (originalTicker === 'ETH') return 'ETH-USD';

    try {
        console.log(`[Resolver] Searching for US equivalent of ${name} (originally ${originalTicker})...`);
        const res = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(name)}&quotesCount=5`, {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const searchResults = await res.json() as YahooSearchResponse;

        if (searchResults.quotes && searchResults.quotes.length > 0) {
            // Try to find a US listed equity (NYSE, NASDAQ, OTC)
            const usQuotes = searchResults.quotes.filter((q: YahooSearchQuote) =>
                q.isYahooFinance === true &&
                (q.exchange === 'NYQ' || q.exchange === 'NMS' || q.exchange === 'NYSE' || q.exchange === 'NASDAQ' || q.exchange === 'PNK' || q.exchange === 'OTC')
            );

            if (usQuotes.length > 0) {
                console.log(`  -> Found US Ticker: ${usQuotes[0].symbol} (${usQuotes[0].exchange}) for ${name}`);
                return usQuotes[0].symbol;
            } else {
                console.log(`  -> No US Ticker found. Falling back to top result: ${searchResults.quotes[0].symbol}`);
                return searchResults.quotes[0].symbol;
            }
        }
    } catch (err) {
        console.error(`  -> Search failed for ${name}:`, err);
    }

    return originalTicker;
}

async function run() {
    console.log("Starting Ticker Resolution...");
    const content = await fs.readFile(CSV_PATH, 'utf-8');
    const lines = content.split('\n');
    const header = lines[0];

    const resolvedLines: string[] = [header];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',');
        if (parts.length >= 3) {
            const originalTicker = parts[parts.length - 2].trim();
            const marketCap = parts[parts.length - 1].trim();
            const nameIdxEnd = line.lastIndexOf(originalTicker) - 1;
            const name = line.substring(0, nameIdxEnd).trim().replace(/^"|"$/g, '');

            const resolvedTicker = await resolveTicker(name, originalTicker);
            const cleanedName = name.replace(/,/g, ''); // strip commas internally to protect CSV bounds
            resolvedLines.push(`${cleanedName},${resolvedTicker},${marketCap}`);

            if (originalTicker !== resolvedTicker) {
                await new Promise(r => setTimeout(r, 200)); // sleep only if we hit the network
            }
        }
    }

    const OUT_PATH = path.join(process.cwd(), 'data', 'resolved_top_1000.csv');
    await fs.writeFile(OUT_PATH, resolvedLines.join('\n'), 'utf-8');
    console.log(`Saved ${resolvedLines.length} resolved assets to ${OUT_PATH}`);
}

run();
