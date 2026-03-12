import { render, screen } from '@testing-library/react'

const push = vi.fn()
const refresh = vi.fn()

vi.mock('next-auth/react', () => ({
  signIn: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}))

vi.mock('@/app/hooks/use-auth-health', () => ({
  useAuthHealth: () => ({
    ok: true,
    googleSignInEnabled: true,
    devBypassEnabled: false,
    publicAppOrigin: 'https://mahita.ai',
  }),
}))

import { SignInCard } from '@/app/components/Auth/SignInCard'

describe('SignInCard', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renders actionable copy for OAuthAccountNotLinked', () => {
    render(<SignInCard authErrorCode="OAuthAccountNotLinked" />)

    expect(screen.getByText(/google account not linked yet/i)).toBeInTheDocument()
    expect(screen.getByText(/existing workspace for this email/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('renders Google sign-in when auth is healthy', () => {
    render(<SignInCard />)

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.queryByText(/google account not linked yet/i)).not.toBeInTheDocument()
  })
})
