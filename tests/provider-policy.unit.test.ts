import {
    decideRuntimeProvider,
    getRuntimeProviderOrder,
    normalizeStage2Provider,
    resolveVerificationProviders,
} from '@/app/services/market-data/provider-policy'

describe('provider policy', () => {
    it('uses Schwab first by default for Stage 2 runtime reads', () => {
        expect(getRuntimeProviderOrder()).toEqual(['schwab', 'yahoo'])
        expect(getRuntimeProviderOrder('schwab')).toEqual(['schwab', 'yahoo'])
    })

    it('allows Yahoo-first order when explicitly requested', () => {
        expect(getRuntimeProviderOrder('yahoo')).toEqual(['yahoo', 'schwab'])
    })

    it('falls back to Yahoo when Schwab is unavailable', () => {
        expect(
            decideRuntimeProvider({
                preferredProvider: 'schwab',
                providerAvailability: { schwab: false, yahoo: true },
            })
        ).toEqual({
            preferredProvider: 'schwab',
            chosenProvider: 'yahoo',
            fallbackReason: 'schwab unavailable; falling back to yahoo.',
            blockedReason: null,
        })
    })

    it('reports a blocked decision when no Stage 2 runtime provider is available', () => {
        expect(
            decideRuntimeProvider({
                preferredProvider: 'schwab',
                providerAvailability: { schwab: false, yahoo: false },
            })
        ).toEqual({
            preferredProvider: 'schwab',
            chosenProvider: null,
            fallbackReason: null,
            blockedReason: 'No Stage 2 runtime provider is currently available.',
        })
    })

    it('pairs verification providers without using experimental feeds', () => {
        expect(
            resolveVerificationProviders({
                preferredProvider: 'schwab',
                availability: { schwab: true, yahoo: true },
            })
        ).toEqual({
            sourceProvider: 'schwab',
            comparisonProvider: 'yahoo',
            primaryDecision: {
                preferredProvider: 'schwab',
                chosenProvider: 'schwab',
                fallbackReason: null,
                blockedReason: null,
            },
        })
    })

    it('normalizes known provider names and rejects unknown providers', () => {
        expect(normalizeStage2Provider('Schwab')).toBe('schwab')
        expect(normalizeStage2Provider('GOOGLE')).toBe('google')
        expect(normalizeStage2Provider('unknown-provider')).toBeNull()
    })
})
