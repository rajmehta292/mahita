import { fireEvent, render, screen } from '@testing-library/react'
import { PositionTable, type Position } from '@/app/components/Portfolio/PositionTable'

const positions: Position[] = [
    {
        symbol: 'NVDA',
        quantity: 10,
        averagePrice: 700,
        currentPrice: 742.5,
        marketValue: 7425,
        unrealizedPL: 425,
        unrealizedPLPercent: 6.07,
        description: 'NVIDIA Corporation',
        lots: [
            { id: 'lot-1', quantity: 4, averagePrice: 690, openedAt: '2026-03-01T15:30:00.000Z' },
            { id: 'lot-2', quantity: 6, averagePrice: 706, openedAt: '2026-03-04T15:30:00.000Z' },
        ]
    },
    {
        symbol: 'AAPL',
        quantity: 5,
        averagePrice: 200,
        currentPrice: 195,
        marketValue: 975,
        unrealizedPL: -25,
        unrealizedPLPercent: -2.5,
        description: 'Apple Inc.'
    }
]

describe('PositionTable', () => {
    it('renders default columns, expands a row, and routes sell custom actions', () => {
        const onAction = vi.fn()
        const onExport = vi.fn()
        const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('3')

        render(<PositionTable positions={positions} onAction={onAction} onExport={onExport} />)

        expect(screen.getByText('Ticker')).toBeInTheDocument()
        expect(screen.getByText('Qty / Avg Price')).toBeInTheDocument()
        expect(screen.getByText('Last Price / MV')).toBeInTheDocument()
        expect(screen.getByText('% Change / Net')).toBeInTheDocument()

        fireEvent.click(screen.getByText('NVDA'))
        expect(screen.getByText('Active Position Detail')).toBeInTheDocument()
        expect(screen.queryByText('Current Holding')).not.toBeInTheDocument()
        const sellCustomButtons = screen.getAllByText('Sell Custom')
        expect(sellCustomButtons.length).toBeGreaterThan(0)

        fireEvent.click(sellCustomButtons[0])
        expect(promptSpy).toHaveBeenCalled()
        expect(onAction).toHaveBeenCalledWith('NVDA', 'SELL', 3)
    })

    it('sorts by quantity when the quantity header is clicked', () => {
        const onAction = vi.fn()
        const onExport = vi.fn()

        render(<PositionTable positions={positions} onAction={onAction} onExport={onExport} />)

        fireEvent.click(screen.getByText('Qty / Avg Price'))

        const tickerCells = screen.getAllByText(/NVDA|AAPL/)
        expect(tickerCells[0]).toHaveTextContent('AAPL')
    })
})
