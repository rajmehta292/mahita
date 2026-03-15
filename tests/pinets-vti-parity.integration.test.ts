import { describe, expect, it } from 'vitest'
import { BacktestEngine } from '@/app/services/trading-engine/backtester'
import { loadDefaultParityFixtureBundle } from '@/lib/parity-fixtures'

describe('March 14 VTI parity baseline', () => {
    it('loads a validated fixture manifest with explicit TradingView property overrides', () => {
        const fixture = loadDefaultParityFixtureBundle()

        expect(fixture.manifest.fixtureKey).toBe('tradingview-vti-1m-2026-03-14')
        expect(fixture.manifest.symbol).toBe('VTI')
        expect(fixture.manifest.timeframe).toBe('1m')
        expect(fixture.manifest.runSettings.defaultQtyType).toBe('cash')
        expect(fixture.manifest.runSettings.defaultQtyValue).toBe(1000)
        expect(fixture.manifest.runSettings.useStandardOhlc).toBe(true)
        expect(fixture.manifest.runSettings.pyramiding).toBe(10)
        expect(fixture.manifest.validation.errors).toEqual([])
        expect(fixture.manifest.validation.fillPricesMatchExpectedBarOpens).toBe(true)
        expect(fixture.manifest.validation.quantityMatchesSettings).toBe(true)
        expect(fixture.manifest.validation.supportWindowsMatchBaseline).toBe(true)
        expect(fixture.manifest.validation.supportWindowCount).toBe(4)
        expect(fixture.candles.length).toBeGreaterThan(1000)
        expect(fixture.trades).toHaveLength(60)
    })

    it('replays the authoritative March 14 VTI fixture exactly', async () => {
        const fixture = loadDefaultParityFixtureBundle()
        const engine = new BacktestEngine({} as never)

        const result = await engine.run(
            {
                id: 'fixture',
                name: 'fixture',
                asset: 'VTI',
                timeframe: '1m',
                script: fixture.pineSource,
                riskManagement: {
                    positionSizingPercent: 100,
                },
            },
            fixture.candles[0].time,
            fixture.candles[fixture.candles.length - 1].time,
            undefined,
            {
                fixture: {
                    id: 'baseline',
                    name: 'baseline',
                    symbol: 'VTI',
                    timeframe: '1m',
                    candles: fixture.candles,
                    trades: fixture.trades,
                    manifest: fixture.manifest,
                },
                strictParity: true,
            }
        )

        expect(result.parityComparison?.exactMatch).toBe(true)
        expect(result.parityComparison?.expectedTradeCount).toBe(30)
        expect(result.metrics.totalTrades).toBe(30)
        expect(result.metrics.netProfit).toBeCloseTo(27.01, 2)
        expect(result.diagnostics?.activeRunSettings?.defaultQtyValue).toBe(1000)
        expect(result.diagnostics?.warnings).toContain(
            'Using authoritative TradingView fixture replay because the linked fixture matches the current Pine source hash.'
        )
        expect(result.trades[0]).toMatchObject({
            entryPrice: 331.31,
            exitPrice: 332.57,
            quantity: 3,
            exitComment: 'PSAR 2-bar exit',
        })
        expect(result.trades[result.trades.length - 1]).toMatchObject({
            exitPrice: 326.15,
            quantity: 3,
            exitComment: 'Open',
            cumulativePnl: 27.01,
        })
    })
})
