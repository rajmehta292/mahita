import { describe, expect, it, vi } from 'vitest'
import { ScriptCompiler, type ScriptContext } from '@/app/services/trading-engine/script-engine'

describe('ScriptCompiler', () => {
    it('extracts Pine strategy settings for the PineTS-backed runtime', () => {
        const history = Array.from({ length: 40 }, (_, index) => ({
            time: index + 1,
            open: 100 + index,
            high: 101 + index,
            low: 99 + index,
            close: 100 + index,
            volume: 1000 + index,
        }))

        const compiled = ScriptCompiler.compileDetailed(
            `//@version=6
strategy("Indicator Keys", overlay=true, pyramiding=10, initial_capital=10000, default_qty_type=strategy.cash, default_qty_value=500)
fastEma = ta.ema(close, 9)
slowSma = ta.sma(21)
rsiValue = ta.rsi(close, 14)
`
        )

        expect(history).toHaveLength(40)
        expect(compiled.strategySettings).toEqual({
            name: 'Indicator Keys',
            pyramiding: 10,
            initialCapital: 10000,
            defaultQtyType: 'cash',
            defaultQtyValue: 500,
        })
        expect(compiled.normalizedScriptSource).toContain('fastEma = __series("fastEma");')
    })

    it('runs Pine-style source with indentation blocks, series history, and persistent vars', () => {
        const history = [
            { time: 1, open: 100, high: 101, low: 99, close: 100, volume: 1000 },
            { time: 2, open: 100, high: 112, low: 99, close: 110, volume: 1100 },
            { time: 3, open: 110, high: 111, low: 103, close: 104, volume: 1050 },
            { time: 4, open: 104, high: 121, low: 103, close: 120, volume: 1200 },
        ]

        const script = `//@version=6
strategy("Close Strength", overlay=true)

var entryCount = 0

if close > close[1]
    entryCount = nz(entryCount, 0) + 1
    strategy.entry("Long", strategy.long)

plot(close, "Close", color=color.green)
`

        const compiled = ScriptCompiler.compile(script)
        const indicators = ScriptCompiler.prepareIndicators(history, script)
        const entries: Array<{ id: string; direction: 'long' | 'short' }> = []
        const state = {
            vars: {} as Record<string, unknown>,
            seriesHistory: {} as Record<string, unknown[]>,
        }

        history.forEach((_, index) => {
            const context: ScriptContext = {
                index,
                data: history,
                indicators,
                vars: state.vars,
                seriesHistory: state.seriesHistory,
                strategy: {
                    entry: (id, direction) => entries.push({ id, direction }),
                    close: vi.fn(),
                    closeAll: vi.fn(),
                },
            }

            compiled(context)
        })

        expect(entries).toHaveLength(2)
        expect(entries.every((entry) => entry.direction === 'long')).toBe(true)
        expect(state.vars.entryCount).toBe(2)
        expect(state.seriesHistory.entryCount).toEqual([0, 1, 1, 2])
    })
})
