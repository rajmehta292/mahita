import {
    buildCustomerChartCatalog,
    buildCustomerRuntimeStatus,
} from '@/lib/platform/customer-read-models'

describe('customer read models', () => {
    it('summarizes runtime status for customer-facing pages', () => {
        const summary = buildCustomerRuntimeStatus(
            {
                running: true,
                startedAt: '2026-03-10T00:00:00.000Z',
                lastCompletedAt: '2026-03-10T00:05:00.000Z',
                cycleCount: 12,
                currentPhase: 'sleeping 60s before next cycle',
                providerOverride: 'schwab',
                intervalMs: 60000,
                lastError: null,
            },
            ['schwab', 'yahoo'],
            {
                symbolCount: 120,
                timeframeCount: 8,
                latestSyncAt: new Date('2026-03-10T00:04:00.000Z'),
            }
        )

        expect(summary.dataPipeline.running).toBe(true)
        expect(summary.dataPipeline.availableProviders).toEqual(['schwab', 'yahoo'])
        expect(summary.inventory.symbolCount).toBe(120)
        expect(summary.inventory.latestSyncAt).toBe('2026-03-10T00:04:00.000Z')
    })

    it('groups chart catalog rows by symbol and timeframes', () => {
        const catalog = buildCustomerChartCatalog([
            {
                symbol: 'AAPL',
                timeframe: '1d',
                lastSynced: new Date('2026-03-10T00:00:00.000Z'),
                lastBar: new Date('2026-03-09T00:00:00.000Z'),
                barCount: 250,
            },
            {
                symbol: 'AAPL',
                timeframe: '1h',
                lastSynced: new Date('2026-03-10T02:00:00.000Z'),
                lastBar: new Date('2026-03-10T01:00:00.000Z'),
                barCount: 500,
            },
            {
                symbol: 'MSFT',
                timeframe: '1d',
                lastSynced: new Date('2026-03-08T00:00:00.000Z'),
                lastBar: new Date('2026-03-07T00:00:00.000Z'),
                barCount: 120,
            },
        ])

        expect(catalog).toHaveLength(2)
        expect(catalog[0]).toMatchObject({
            symbol: 'AAPL',
            timeframes: ['1d', '1h'],
            barCount: 750,
            latestBarAt: '2026-03-10T01:00:00.000Z',
        })
    })
})
