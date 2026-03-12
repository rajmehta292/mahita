import { describe, expect, it } from 'vitest'
import {
    buildOrderRequestFromDraft,
    createOrderDraft,
    parseOrderDraft,
    resolveDraftQuantity,
    serializeOrderDraft,
} from '@/lib/trading/order-draft'

describe('order-draft helpers', () => {
    it('serializes and parses a reusable active trader draft', () => {
        const draft = createOrderDraft({
            accountId: 'acct-123',
            symbol: 'aapl',
            side: 'SELL',
            quantityMode: 'ALL',
            orderType: 'LIMIT',
            limitPrice: 210.5,
            duration: 'GTC',
            session: 'NORMAL',
        })

        const encoded = serializeOrderDraft(draft)
        const parsed = parseOrderDraft(new URLSearchParams(encoded))

        expect(parsed).toEqual({
            accountId: 'acct-123',
            symbol: 'AAPL',
            side: 'SELL',
            quantityMode: 'ALL',
            quantity: undefined,
            orderType: 'LIMIT',
            limitPrice: 210.5,
            stopPrice: undefined,
            duration: 'GTC',
            session: 'NORMAL',
        })
    })

    it('builds Schwab order payloads from the resolved quantity', () => {
        const draft = createOrderDraft({
            symbol: 'MSFT',
            side: 'SELL',
            quantityMode: 'ALL',
            orderType: 'MARKET',
        })

        expect(resolveDraftQuantity(draft, 12)).toBe(12)
        expect(buildOrderRequestFromDraft(draft, 12)).toEqual({
            symbol: 'MSFT',
            quantity: 12,
            orderType: 'MARKET',
            instruction: 'SELL',
            duration: 'DAY',
            session: 'NORMAL',
            price: undefined,
            stopPrice: undefined,
        })
    })

    it('rejects invalid quantities before order submission', () => {
        const draft = createOrderDraft({
            symbol: 'NVDA',
            side: 'BUY',
            quantityMode: 'CUSTOM',
            quantity: 0,
        })

        expect(() => buildOrderRequestFromDraft(draft)).toThrow('Quantity must be greater than zero.')
    })
})
