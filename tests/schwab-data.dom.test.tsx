import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SchwabDataCenter } from '@/app/components/SchwabData/SchwabDataCenter'

describe('SchwabDataCenter', () => {
    it('updates the API preview and code snippets as the request changes', () => {
        render(<SchwabDataCenter />)

        expect(screen.getByText(/GET \/api\/trading\/market-data\?symbol=AAPL&timeframe=1d&range=1y/i)).toBeInTheDocument()

        fireEvent.change(screen.getByDisplayValue('AAPL'), {
            target: { value: 'msft' },
        })

        fireEvent.change(screen.getByDisplayValue('Price History'), {
            target: { value: 'quote' },
        })

        fireEvent.click(screen.getByRole('button', { name: /csv/i }))

        expect(screen.getByText(/GET \/api\/trading\/quotes\?symbols=MSFT/i)).toBeInTheDocument()
        expect(screen.getByText(/const data = await response\.text\(\);/i)).toBeInTheDocument()
        expect(screen.getByText(/requests\.get\("https:\/\/mahita\.ai\/api\/trading\/quotes\?symbols=MSFT"\)/i)).toBeInTheDocument()
    })
})
