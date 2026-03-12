import { evaluateTrendingStrategy, parseStrategyForTrending } from '@/lib/trending-indicators'

function createBars(prices: number[]) {
    return prices.map((close, index) => ({
        time: 1_700_000_000 + index * 60,
        open: close - 1,
        high: close + 1,
        low: close - 2,
        close,
        volume: 10_000 + index,
    }))
}

describe('trending indicators kernel', () => {
    it('parses supported EMA + RSI strategies into monitor conditions', () => {
        const parsed = parseStrategyForTrending({
            id: 'strategy-1',
            name: 'EMA Confirmation',
            timeframe: '1d',
            script: `
                const ema_fast = ta.ema(9)
                const ema_slow = ta.ema(21)
                const rsi = ta.rsi(14)

                if (ema_fast > ema_slow && rsi < 80) {
                    strategy.entry("Long", "long")
                }
            `,
        })

        expect(parsed.supported).toBe(true)
        expect(parsed.conditions).toHaveLength(2)
        expect(parsed.conditions[0].kind).toBe('ema_alignment')
        expect(parsed.conditions[1].kind).toBe('rsi_below')
    })

    it('computes full matches, indicator matches, and near misses across a symbol set', () => {
        const parsed = parseStrategyForTrending({
            id: 'strategy-2',
            name: 'EMA Confirmation',
            timeframe: '1d',
            script: `
                const ema_fast = ta.ema(9)
                const ema_slow = ta.ema(21)
                const rsi = ta.rsi(14)

                if (ema_fast > ema_slow && rsi < 80) {
                    strategy.entry("Long", "long")
                }
            `,
        })

        const card = evaluateTrendingStrategy(parsed, ['AAPL', 'MSFT'], {
            AAPL: createBars([100, 101, 102, 101, 103, 104, 103, 105, 106, 105, 107, 108, 107, 109, 110, 109, 111, 112, 111, 113, 114, 113, 115, 116, 115, 117, 118, 117, 119, 120, 119, 121, 122, 121, 123, 124, 123, 125, 126, 125, 127, 128]),
            MSFT: createBars([120, 118, 117, 115, 114, 112, 111, 109, 107, 106, 104, 103, 101, 100, 99, 97, 96, 94, 93, 91, 90, 89, 88, 87, 86, 85, 84, 83, 82, 81, 80, 79, 78, 77, 76, 75, 74, 73, 72, 71, 70, 69]),
        })

        expect(card.status).toBe('active')
        expect(card.summary.symbolsScanned).toBe(2)
        expect(card.fullStrategyMatches.map((match) => match.symbol)).toContain('AAPL')
        expect(card.nearMisses.length).toBeGreaterThanOrEqual(0)
        expect(card.indicators[0].matches.length).toBeGreaterThan(0)
    })

    it('flags unsupported scripts instead of pretending to monitor them', () => {
        const parsed = parseStrategyForTrending({
            id: 'strategy-3',
            name: 'Unsupported Script',
            timeframe: '1d',
            script: 'request.security("SPY", "60", close)',
        })

        expect(parsed.supported).toBe(false)
        const card = evaluateTrendingStrategy(parsed, ['AAPL'], {})
        expect(card.status).toBe('unsupported')
        expect(card.supportNote).toContain('cannot evaluate yet')
    })
})
