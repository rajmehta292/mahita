import {
    buildBrokerageConnectionSyncUpdate,
    resolveBrokerageAccountSelection,
} from '@/lib/brokerage-connections'

type BrokerageConnectionSelectionFixture = {
    accounts: Array<{
        accountHash: string | null
        providerAccountId: string
    }>
}

function fixtureToConnection(
    fixture: BrokerageConnectionSelectionFixture
): Parameters<typeof resolveBrokerageAccountSelection>[0] {
    return fixture as unknown as Parameters<typeof resolveBrokerageAccountSelection>[0]
}

describe('resolveBrokerageAccountSelection', () => {
    it('prefers an explicitly requested account id', () => {
        const selected = resolveBrokerageAccountSelection(fixtureToConnection({
            accounts: [
                {
                    accountHash: 'hash-a',
                    providerAccountId: 'acct-a',
                },
            ],
        }), 'acct-explicit')

        expect(selected).toBe('acct-explicit')
    })

    it('falls back to the first active account hash when no explicit selection exists', () => {
        const selected = resolveBrokerageAccountSelection(fixtureToConnection({
            accounts: [
                {
                    accountHash: 'hash-a',
                    providerAccountId: 'acct-a',
                },
            ],
        }))

        expect(selected).toBe('hash-a')
    })

    it('falls back to the provider account id when no hash exists', () => {
        const selected = resolveBrokerageAccountSelection(fixtureToConnection({
            accounts: [
                {
                    accountHash: null,
                    providerAccountId: 'acct-a',
                },
            ],
        }))

        expect(selected).toBe('acct-a')
    })
})

describe('buildBrokerageConnectionSyncUpdate', () => {
    it('preserves pending OAuth state by not clearing pending auth fields during sync', () => {
        const update = buildBrokerageConnectionSyncUpdate({
            id: 'cfg-1',
            clientId: 'client-id',
            clientSecret: 'encrypted-secret',
            accessToken: null,
            refreshToken: null,
        })

        expect(update).toMatchObject({
            label: 'Schwab',
            linkedSchwabConfigId: 'cfg-1',
            isPrimary: true,
            lastError: null,
        })
        expect(update).not.toHaveProperty('pendingAuthState')
        expect(update).not.toHaveProperty('pendingAuthStartedAt')
    })
})
