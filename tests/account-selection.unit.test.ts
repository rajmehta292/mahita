import { resolveHydratedAccountId } from '@/lib/account-selection'

const accounts = [
    {
        securitiesAccount: {
            accountId: '11112222',
            hashValue: 'hash-a',
        },
    },
    {
        securitiesAccount: {
            accountId: '33334444',
            hashValue: 'hash-b',
        },
    },
]

describe('resolveHydratedAccountId', () => {
    it('keeps the current selection when it is already valid', () => {
        expect(resolveHydratedAccountId(accounts, 'hash-a', 'hash-b')).toBeNull()
    })

    it('hydrates the preferred account when the current selection is empty', () => {
        expect(resolveHydratedAccountId(accounts, '', 'hash-b')).toBe('hash-b')
    })

    it('falls back to the first account when the preferred account is unavailable', () => {
        expect(resolveHydratedAccountId(accounts, '', 'missing')).toBe('hash-a')
    })
})
