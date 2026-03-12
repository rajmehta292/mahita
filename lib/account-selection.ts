export interface SelectableAccount {
    securitiesAccount: {
        accountId: string
        hashValue?: string
    }
}

export function getSelectableAccountId(account: SelectableAccount) {
    return account.securitiesAccount.hashValue || account.securitiesAccount.accountId
}

export function resolveHydratedAccountId(
    accounts: SelectableAccount[],
    currentSelectedAccountId?: string | null,
    preferredAccountId?: string | null
) {
    if (accounts.length === 0) {
        return null
    }

    const currentSelectionIsValid = Boolean(
        currentSelectedAccountId &&
        accounts.some((account) => getSelectableAccountId(account) === currentSelectedAccountId)
    )

    if (currentSelectionIsValid) {
        return null
    }

    if (preferredAccountId) {
        const preferredAccount = accounts.find(
            (account) => getSelectableAccountId(account) === preferredAccountId
        )

        if (preferredAccount) {
            return getSelectableAccountId(preferredAccount)
        }
    }

    return getSelectableAccountId(accounts[0])
}
