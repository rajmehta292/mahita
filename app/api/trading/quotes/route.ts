import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

interface YahooQuoteResponse {
    shortName?: string
    longName?: string
    regularMarketPrice?: number
    regularMarketChange?: number
    regularMarketChangePercent?: number
}

const YahooFinanceClient = YahooFinance as unknown as {
    new (): {
        quote(symbol: string): Promise<YahooQuoteResponse>
    }
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const symbolsParam = searchParams.get('symbols')

    if (!symbolsParam) {
        return NextResponse.json({ error: 'Missing symbols parameter' }, { status: 400 })
    }

    const symbols = symbolsParam.split(',').map(s => s.trim().toUpperCase())

    try {
        const quotes = await Promise.all(
            symbols.map(async (sym) => {
                try {
                    const yahooFinance = new YahooFinanceClient()
                    const result = await yahooFinance.quote(sym)
                    return {
                        symbol: sym,
                        name: result.shortName || result.longName || sym,
                        price: result.regularMarketPrice,
                        change: result.regularMarketChange,
                        changePercent: result.regularMarketChangePercent
                    }
                } catch (e) {
                    console.warn(`[QuotesRoute] Failed to fetch quote for ${sym}:`, e)
                    return null
                }
            })
        )

        const validQuotes = quotes.filter(q => q !== null)

        return NextResponse.json({
            success: true,
            quotes: validQuotes
        })

    } catch (error) {
        console.error('[QuotesRoute] Error fetching quotes:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to fetch quotes',
        }, { status: 500 })
    }
}
