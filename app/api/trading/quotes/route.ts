import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

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
                    const result = await (YahooFinance as any).quote(sym)
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

    } catch (error: any) {
        console.error('[QuotesRoute] Error fetching quotes:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch quotes' }, { status: 500 })
    }
}
