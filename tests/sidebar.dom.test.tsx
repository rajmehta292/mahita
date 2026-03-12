import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/app/components/Layout/Sidebar'
import { useSession } from 'next-auth/react'

vi.mock('next-auth/react', () => ({
    useSession: vi.fn(),
}))

vi.mock('next/navigation', () => ({
    usePathname: () => '/dashboard',
}))

describe('Sidebar', () => {
    it('shows the documentation entry and hides admin items for regular users', () => {
        const sessionValue = {
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
        }
        vi.mocked(useSession).mockReturnValue(sessionValue as ReturnType<typeof useSession>)

        render(<Sidebar isOpen={true} onClose={vi.fn()} />)

        expect(screen.getByText('Trending Indicators')).toBeInTheDocument()
        expect(screen.getByText('Documentation')).toBeInTheDocument()
        expect(screen.queryByText('Admin Control')).not.toBeInTheDocument()
        expect(screen.queryByText('Dev Tests')).not.toBeInTheDocument()
    })
})
