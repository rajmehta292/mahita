import { fireEvent, render, screen } from '@testing-library/react'
import { TrendingIndicatorsDashboard } from '@/app/components/TrendingIndicators/TrendingIndicatorsDashboard'
import type { TrendingIndicatorCard, TrendingStrategyInput } from '@/lib/trending-indicators'

const strategies: TrendingStrategyInput[] = [
    { id: 'strategy-1', name: 'EMA Confirmation', script: '', timeframe: '1d', symbol: 'AAPL' },
    { id: 'strategy-2', name: 'RSI Reset', script: '', timeframe: '15m', symbol: 'NVDA' },
]

const cards: TrendingIndicatorCard[] = [
    {
        strategyId: 'strategy-1',
        name: 'EMA Confirmation',
        timeframe: '1d',
        status: 'active',
        lastScanAt: '2026-03-10T17:10:00.000Z',
        summary: {
            symbolsScanned: 6,
            fullEntryMatches: 1,
            newTriggers: 1,
            nearMisses: 2,
            indicatorMatchesTotal: 4,
        },
        fullStrategyMatches: [
            { symbol: 'AAPL', matchedAt: '2026-03-10T17:10:00.000Z', price: 201.5, matchedConditions: 2, totalConditions: 2, isNewTrigger: true },
        ],
        newTriggers: [
            { symbol: 'AAPL', matchedAt: '2026-03-10T17:10:00.000Z', price: 201.5, matchedConditions: 2, totalConditions: 2, isNewTrigger: true },
        ],
        nearMisses: [
            { symbol: 'MSFT', matchedAt: '2026-03-10T17:10:00.000Z', price: 410.25, matchedConditions: 1, totalConditions: 2, isNewTrigger: false },
        ],
        indicators: [
            {
                conditionId: 'ema-trend',
                label: 'EMA Trend Alignment',
                ruleText: 'EMA(9) > EMA(21)',
                role: 'entry_confirmation',
                matchCount: 2,
                matches: [
                    { symbol: 'AAPL', matchedAt: '2026-03-10T17:10:00.000Z', price: 201.5, reason: 'EMA(9) 201.2 vs 21 200.8', value: 0.4 },
                    { symbol: 'MSFT', matchedAt: '2026-03-10T17:10:00.000Z', price: 410.25, reason: 'EMA(9) 410.0 vs 21 409.5', value: 0.5 },
                ],
            },
        ],
    },
]

describe('TrendingIndicatorsDashboard', () => {
    it('renders strategy cards and toggles strategy visibility from the selector', () => {
        const onToggleStrategy = vi.fn()

        render(
            <TrendingIndicatorsDashboard
                generatedAt="2026-03-10T17:10:00.000Z"
                strategies={strategies}
                cards={cards}
                selectedStrategyIds={['strategy-1']}
                loading={false}
                error={null}
                onToggleStrategy={onToggleStrategy}
                onSelectAll={vi.fn()}
                onClearAll={vi.fn()}
                onRefresh={vi.fn()}
            />
        )

        expect(screen.getByText('Trending Indicators')).toBeInTheDocument()
        expect(screen.getByText('EMA Confirmation')).toBeInTheDocument()
        expect(screen.getByText('Full Strategy Buy Matches')).toBeInTheDocument()
        expect(screen.getAllByText('AAPL').length).toBeGreaterThan(0)

        fireEvent.click(screen.getByText('Strategy Display'))
        fireEvent.click(screen.getByLabelText(/RSI Reset/i))
        expect(onToggleStrategy).toHaveBeenCalledWith('strategy-2')
    })
})
