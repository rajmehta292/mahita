import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MahitaCodeEditor } from '@/app/components/Backtest/MahitaCodeEditor'

const {
    loaderConfigMock,
    loaderInitMock,
    registerMock,
    setTokensMock,
} = vi.hoisted(() => ({
    loaderConfigMock: vi.fn(),
    loaderInitMock: vi.fn(),
    registerMock: vi.fn(),
    setTokensMock: vi.fn(),
}))

vi.mock('@monaco-editor/react', () => {
    const mockMonaco = {
        languages: {
            getLanguages: () => [],
            register: registerMock,
            setMonarchTokensProvider: setTokensMock,
        },
    }

    const MockEditor = ({
        beforeMount,
        onMount,
        value,
    }: {
        beforeMount?: (monaco: typeof mockMonaco) => void
        onMount?: () => void
        value?: string
    }) => {
        React.useEffect(() => {
            beforeMount?.(mockMonaco)
            onMount?.()
        }, [beforeMount, onMount])

        return <div data-testid="monaco-editor">{value}</div>
    }

    return {
        __esModule: true,
        default: MockEditor,
        loader: {
            config: loaderConfigMock,
            init: loaderInitMock,
        },
    }
})

describe('MahitaCodeEditor', () => {
    beforeEach(() => {
        loaderConfigMock.mockReset()
        loaderInitMock.mockReset()
        registerMock.mockReset()
        setTokensMock.mockReset()
    })

    it('renders Monaco when initialization succeeds', async () => {
        loaderInitMock.mockResolvedValue({
            languages: {
                getLanguages: () => [],
                register: registerMock,
                setMonarchTokensProvider: setTokensMock,
            },
        })

        render(<MahitaCodeEditor value={'strategy.entry("Long")'} onChange={() => { }} />)

        await waitFor(() => expect(screen.getByTestId('monaco-editor')).toBeInTheDocument())
        expect(loaderConfigMock).toHaveBeenCalled()
        expect(registerMock).toHaveBeenCalled()
    })

    it('falls back to a textarea when Monaco initialization fails', async () => {
        loaderInitMock.mockRejectedValue(new Error('boom'))

        render(<MahitaCodeEditor value={'plot(close)'} onChange={() => { }} />)

        await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
        expect(screen.getByText(/boom/i)).toBeInTheDocument()
    })

    it('normalizes Event rejections into a readable fallback message', async () => {
        loaderInitMock.mockRejectedValue(new Event('error'))

        render(<MahitaCodeEditor value={'plot(close)'} onChange={() => { }} />)

        await waitFor(() => expect(screen.getByRole('textbox')).toBeInTheDocument())
        expect(screen.queryByText(/\[object Event\]/i)).not.toBeInTheDocument()
        expect(screen.getByText(/Mahita could not initialize Monaco/i)).toBeInTheDocument()
    })
})
