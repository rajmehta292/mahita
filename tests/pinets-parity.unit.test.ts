import { describe, expect, it } from 'vitest'
import { compareCompletedTradesToFixture, detectFixtureWindowMismatch, groupFixtureTrades } from '@/app/services/trading-engine/parity'
import type { CompletedTrade, NormalizedTradeRecord } from '@/app/services/trading-engine/types'

describe('PineTS parity helpers', () => {
    it('groups TradingView entry and exit rows into completed trades', () => {
        const rows: NormalizedTradeRecord[] = [
            {
                tradeNumber: 1,
                type: 'Exit long',
                timestampLabel: '2026-03-13 15:59',
                price: 326.15,
                positionSizeQty: 2,
                positionSizeValue: 682.02,
                netPnl: -29.72,
                netPnlPercent: -4.36,
                cumulativePnl: 1554.21,
                cumulativePnlPercent: 15.54,
                signal: 'Open',
            },
            {
                tradeNumber: 1,
                type: 'Entry long',
                timestampLabel: '2026-02-11 10:42',
                price: 341.01,
                positionSizeQty: 2,
                positionSizeValue: 682.02,
                netPnl: -29.72,
                netPnlPercent: -4.36,
                cumulativePnl: 1554.21,
                cumulativePnlPercent: 15.54,
                signal: 'Long',
            },
        ]

        expect(groupFixtureTrades(rows)).toEqual([
            {
                tradeNumber: 1,
                entryTimeLabel: '2026-02-11 10:42',
                exitTimeLabel: '2026-03-13 15:59',
                entryPrice: 341.01,
                exitPrice: 326.15,
                quantity: 2,
                pnl: -29.72,
                cumulativePnl: 1554.21,
                entrySignal: 'Long',
                exitSignal: 'Open',
            },
        ])
    })

    it('flags fixture window mismatches and non-overlapping trade exports', () => {
        const rows: NormalizedTradeRecord[] = [
            {
                tradeNumber: 1,
                type: 'Exit long',
                timestampLabel: '2025-03-13 10:24',
                price: 274.26,
                positionSizeQty: 3,
                positionSizeValue: 822.21,
                netPnl: 0.57,
                netPnlPercent: 0.07,
                cumulativePnl: 0.57,
                cumulativePnlPercent: 0.01,
                signal: 'PSAR 2-bar exit',
            },
            {
                tradeNumber: 1,
                type: 'Entry long',
                timestampLabel: '2025-03-13 10:13',
                price: 274.07,
                positionSizeQty: 3,
                positionSizeValue: 822.21,
                netPnl: 0.57,
                netPnlPercent: 0.07,
                cumulativePnl: 0.57,
                cumulativePnlPercent: 0.01,
                signal: 'Long',
            },
        ]
        const actualTrades: CompletedTrade[] = [
            {
                id: '1',
                symbol: 'VTI',
                side: 'Long',
                entryTime: 1771016100,
                entryPrice: 336.58,
                exitTime: 1771345800,
                exitPrice: 336.58,
                quantity: 1,
                pnl: 0,
                pnlPercent: 0,
                durationBars: 125,
                entryId: 'Long',
                exitComment: 'PSAR 2-bar exit',
                reportedPositionSize: 1,
                cumulativePnl: 0,
            },
        ]

        expect(detectFixtureWindowMismatch(1771013760, 1773431940, rows)).toContain('does not match candle fixture year')
        expect(
            compareCompletedTradesToFixture(actualTrades, rows, 'fixture', {
                firstBarTime: 1771013760,
                lastBarTime: 1773431940,
            })
        ).toMatchObject({
            fixtureId: 'fixture',
            exactMatch: false,
            expectedTradeCount: 0,
            actualTradeCount: 1,
            firstDivergenceField: 'trade-count',
        })
    })
})
