import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useUserPreferences } from '@/app/hooks/use-user-preferences'
import { useSession } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
    useSession: vi.fn(),
}))

function PreferenceHarness() {
    const { preferences, loading, updatePreferences } = useUserPreferences()

    if (loading) {
        return <div>loading</div>
    }

    return (
        <div>
            <span data-testid="selected-account">{preferences?.selectedAccountId ?? 'none'}</span>
            <button onClick={() => updatePreferences({ selectedAccountId: 'acct-2' })}>update</button>
            <button onClick={() => updatePreferences({ selectedAccountId: preferences?.selectedAccountId ?? null })}>noop</button>
        </div>
    )
}

describe('useUserPreferences', () => {
    beforeEach(() => {
        vi.mocked(useSession).mockReturnValue({
            data: {
                user: {
                    id: 'user-1',
                    email: 'user@example.com',
                    role: 'USER',
                },
                expires: '2099-01-01T00:00:00.000Z',
            },
            status: 'authenticated',
            update: vi.fn(),
        } as ReturnType<typeof useSession>)
    })

    it('loads preferences and persists updates', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    preferences: {
                        selectedAccountId: 'acct-1'
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    preferences: {
                        selectedAccountId: 'acct-2'
                    }
                })
            })

        vi.stubGlobal('fetch', fetchMock)

        render(<PreferenceHarness />)

        await waitFor(() => expect(screen.getByTestId('selected-account')).toHaveTextContent('acct-1'))

        await act(async () => {
            fireEvent.click(screen.getByText('update'))
        })

        await waitFor(() => expect(screen.getByTestId('selected-account')).toHaveTextContent('acct-2'))
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('does not PATCH when the requested preference value is already current', async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                preferences: {
                    selectedAccountId: 'acct-1'
                }
            })
        })

        vi.stubGlobal('fetch', fetchMock)

        render(<PreferenceHarness />)

        await waitFor(() => expect(screen.getByTestId('selected-account')).toHaveTextContent('acct-1'))

        await act(async () => {
            fireEvent.click(screen.getByText('noop'))
        })

        expect(fetchMock).toHaveBeenCalledTimes(1)
    })
})
