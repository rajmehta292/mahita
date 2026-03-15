import YahooFinance from 'yahoo-finance2'
import prisma from '@/lib/prisma'
import { parseStoredStringArray } from '@/lib/preferences-serialization'

interface SymbolLookupResult {
    symbol: string
    name: string
    exchange: string | null
    assetType: string
    source: 'catalog' | 'watchlist' | 'quote-fallback'
}

function scoreResult(query: string, symbol: string, name: string) {
    const normalized = query.trim().toUpperCase()
    const normalizedName = name.toUpperCase()
    if (symbol === normalized) return 100
    if (symbol.startsWith(normalized)) return 85
    if (normalizedName.startsWith(normalized)) return 70
    if (normalizedName.includes(normalized)) return 55
    return 20
}

export async function lookupSymbols(userId: string, query: string, limit = 12) {
    const normalized = query.trim().toUpperCase()
    if (!normalized) {
        return []
    }

    const [preference, catalogRows] = await Promise.all([
        prisma.userPreference.findUnique({
            where: { userId },
            select: { watchlistSymbols: true },
        }),
        prisma.instrumentMaster.findMany({
            where: {
                enabled: true,
                OR: [
                    { symbol: { contains: normalized } },
                    { name: { contains: query.trim() } },
                ],
            },
            take: limit,
            orderBy: [{ symbol: 'asc' }],
        }),
    ])

    const watchlistSymbols = parseStoredStringArray(preference?.watchlistSymbols)
    const watchlistMatches: SymbolLookupResult[] = watchlistSymbols
        .filter((symbol) => symbol.includes(normalized))
        .map((symbol) => ({
            symbol,
            name: symbol,
            exchange: null,
            assetType: 'equity',
            source: 'watchlist',
        }))

    const catalogMatches: SymbolLookupResult[] = catalogRows.map((row) => ({
        symbol: row.symbol,
        name: row.name || row.symbol,
        exchange: row.exchange,
        assetType: row.assetType,
        source: 'catalog',
    }))

    const deduped = new Map<string, SymbolLookupResult>()
    for (const result of [...watchlistMatches, ...catalogMatches]) {
        deduped.set(result.symbol, result)
    }

    if (!deduped.has(normalized) && /^[A-Z.\-]{1,10}$/.test(normalized)) {
        try {
            const yahoo = new (YahooFinance as any)()
            const quote = await yahoo.quote(normalized)
            if (quote?.symbol || quote?.shortName || quote?.longName) {
                const fallback: SymbolLookupResult = {
                    symbol: normalized,
                    name: quote.shortName || quote.longName || normalized,
                    exchange: quote.fullExchangeName || quote.exchange || null,
                    assetType: String(quote.quoteType || '').toLowerCase().includes('etf') ? 'etf' : 'equity',
                    source: 'quote-fallback',
                }
                deduped.set(fallback.symbol, fallback)
                await prisma.instrumentMaster.upsert({
                    where: { symbol: fallback.symbol },
                    update: {
                        name: fallback.name,
                        exchange: fallback.exchange,
                        assetType: fallback.assetType,
                        isEtf: fallback.assetType === 'etf',
                        enabled: true,
                    },
                    create: {
                        symbol: fallback.symbol,
                        name: fallback.name,
                        exchange: fallback.exchange,
                        assetType: fallback.assetType,
                        isEtf: fallback.assetType === 'etf',
                        enabled: true,
                    },
                })
            }
        } catch {
            // Exact ticker fallback is best-effort only.
        }
    }

    return Array.from(deduped.values())
        .sort((left, right) => scoreResult(normalized, right.symbol, right.name) - scoreResult(normalized, left.symbol, left.name))
        .slice(0, limit)
}
