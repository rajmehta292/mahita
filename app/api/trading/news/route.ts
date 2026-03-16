import { NextRequest, NextResponse } from 'next/server'
import YahooFinance from 'yahoo-finance2'

interface YahooNewsItem {
    title?: string
    publisher?: string
    providerPublishTime?: number
    link?: string
}

interface YahooSearchResponse {
    news?: YahooNewsItem[]
}

const YahooFinanceClient = YahooFinance as unknown as {
    new (): {
        search(query: string, options: { newsCount: number }): Promise<YahooSearchResponse>
    }
}

export async function GET(request: NextRequest) {
    try {
        const yahooFinance = new YahooFinanceClient()

        // Fetch news related to the broader market via a major index ETF
        const result = await yahooFinance.search('SPY', { newsCount: 6 })

        if (!result || !result.news) {
            return NextResponse.json({ success: true, news: [] })
        }

        const news = result.news.map((item) => ({
            title: item.title,
            source: item.publisher,
            time: new Date((item.providerPublishTime ?? 0) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            link: item.link,
            // Yahoo doesn't provide sentiment, so we provide a neutral default
            sentiment: 'neutral'
        }))

        return NextResponse.json({
            success: true,
            news
        })

    } catch (error) {
        console.error('[NewsRoute] Error fetching news:', error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : 'Failed to fetch news',
        }, { status: 500 })
    }
}
