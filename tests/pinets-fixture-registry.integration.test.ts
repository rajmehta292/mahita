import { describe, expect, it } from 'vitest'
import { loadBuiltInParityFixtureBundles, runBuiltInParityBatch } from '@/lib/parity-fixtures'

describe('built-in parity fixture registry', () => {
    it('loads the seeded VTI 1m, VTI 60m, and AAPL 1m fixture bundles with per-fixture settings', () => {
        const fixtures = loadBuiltInParityFixtureBundles()
        const byKey = new Map(fixtures.map((fixture) => [fixture.fixtureKey, fixture]))

        expect(fixtures).toHaveLength(3)

        const vti60m = byKey.get('tradingview-vti-60m-2026-03-14')
        expect(vti60m?.manifest.symbol).toBe('VTI')
        expect(vti60m?.manifest.timeframe).toBe('1h')
        expect(vti60m?.manifest.runSettings.defaultQtyValue).toBe(500)
        expect(vti60m?.manifest.runSettings.useStandardOhlc).toBe(false)
        expect(vti60m?.manifest.validation.errors).toEqual([])

        const aapl1m = byKey.get('tradingview-aapl-1m-2026-03-14')
        expect(aapl1m?.manifest.symbol).toBe('AAPL')
        expect(aapl1m?.manifest.timeframe).toBe('1m')
        expect(aapl1m?.manifest.runSettings.defaultQtyValue).toBe(500)
        expect(aapl1m?.manifest.runSettings.useStandardOhlc).toBe(false)
        expect(aapl1m?.manifest.supportCandleFileNames).toEqual(['bars-window-1.csv', 'bars-window-2.csv', 'bars-window-3.csv'])
        expect(aapl1m?.manifest.validation.supportWindowsMatchBaseline).toBe(true)
        expect(aapl1m?.manifest.validation.supportWindowCount).toBe(3)
        expect(aapl1m?.manifest.validation.errors).toEqual([])
    })

    it('runs a deterministic parity batch for the newly staged VTI 60m and AAPL 1m fixtures', async () => {
        const report = await runBuiltInParityBatch([
            'tradingview-vti-60m-2026-03-14',
            'tradingview-aapl-1m-2026-03-14',
        ])

        expect(report.totalFixtures).toBe(2)
        expect(report.exactReplayCount).toBe(2)
        expect(report.invalidCount).toBe(0)

        const byKey = new Map(report.fixtures.map((fixture) => [fixture.fixtureKey, fixture]))
        expect(byKey.get('tradingview-vti-60m-2026-03-14')).toMatchObject({
            status: expect.stringMatching(/^(verified-fixture-replay|engine-compare)$/),
            replayComparison: expect.objectContaining({
                exactMatch: true,
                expectedTradeCount: 12,
                actualTradeCount: 12,
            }),
        })
        expect(byKey.get('tradingview-aapl-1m-2026-03-14')).toMatchObject({
            status: expect.stringMatching(/^(verified-fixture-replay|engine-compare)$/),
            replayComparison: expect.objectContaining({
                exactMatch: true,
                expectedTradeCount: 60,
                actualTradeCount: 60,
            }),
        })
    }, 30000)
})
