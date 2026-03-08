import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

export async function GET(request: NextRequest) {
    try {
        const yahooFinance = new (YahooFinance as any)()

        // Fetch news related to the broader market via a major index ETF
        const result = await yahooFinance.search('SPY', { newsCount: 6 })

        if (!result || !result.news) {
            return NextResponse.json({ success: true, news: [] })
        }

        const news = result.news.map((item: any) => ({
            title: item.title,
            source: item.publisher,
            time: new Date(item.providerPublishTime * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: item.link,
            // Yahoo doesn't provide sentiment, so we provide a neutral default
            sentiment: 'neutral'
        }))

        return NextResponse.json({
            success: true,
            news
        })

    } catch (error: any) {
        console.error('[NewsRoute] Error fetching news:', error)
        return NextResponse.json({ error: error.message || 'Failed to fetch news' }, { status: 500 })
    }
}
