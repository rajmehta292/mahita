import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LandingSignInMenu } from '@/app/components/Auth/LandingSignInMenu'
import { signIn } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
    signIn: vi.fn(),
}))

describe('LandingSignInMenu', () => {
    beforeEach(() => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({
                ok: true,
                hasGoogleProvider: true,
                googleSignInEnabled: true,
                devBypassEnabled: false,
                usesSafeLocalOrigin: true,
                authMode: 'production-google',
                publicAppOrigin: 'https://mahita.ai',
            }),
        }))
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        vi.clearAllMocks()
    })

    it('opens the dropdown widget and starts Google sign-in with the post-sign-in callback', async () => {
        render(<LandingSignInMenu />)

        fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

        expect(await screen.findByText(/continue into mahita/i)).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

        await waitFor(() => {
            expect(signIn).toHaveBeenCalledWith('google', {
                callbackUrl: 'http://localhost:3000/auth/post-signin',
            })
        })
    })

    it('shows production-only guidance when Google sign-in is disabled locally', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({
                ok: true,
                hasGoogleProvider: true,
                googleSignInEnabled: false,
                devBypassEnabled: true,
                usesSafeLocalOrigin: true,
                authMode: 'development-bypass',
                publicAppOrigin: 'https://mahita.ai',
            }),
        }))

        render(<LandingSignInMenu />)

        fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

        expect(await screen.findByText(/google sign-in is disabled on localhost/i)).toBeInTheDocument()
        expect(screen.getByText(/mahita.ai/i)).toBeInTheDocument()
    })
})
