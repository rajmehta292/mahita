import * as ta from 'technicalindicators'

export interface ScriptContext {
    index: number
    data: any[]
    indicators: Record<string, number[]>
    vars: Record<string, any>
    strategy: {
        entry: (id: string, direction: 'long' | 'short', params?: any) => void
        close: (id: string) => void
    }
}

export class ScriptCompiler {
    static compile(script: string) {
        // Simple "Series" replacement logic: close[1] -> context.data[context.index - 1].close
        let transpiled = script
            .replace(/\bclose\[(\d+)\]/g, 'context.data[context.index - $1].close')
            .replace(/\bopen\[(\d+)\]/g, 'context.data[context.index - $1].open')
            .replace(/\bhigh\[(\d+)\]/g, 'context.data[context.index - $1].high')
            .replace(/\blow\[(\d+)\]/g, 'context.data[context.index - $1].low')
            .replace(/\bvolume\[(\d+)\]/g, 'context.data[context.index - $1].volume')
            .replace(/\bclose\b/g, 'context.data[context.index].close')
            .replace(/\bopen\b/g, 'context.data[context.index].open')
            .replace(/\bhigh\b/g, 'context.data[context.index].high')
            .replace(/\blow\b/g, 'context.data[context.index].low')
            .replace(/\bvolume\b/g, 'context.data[context.index].volume')
            // Indicators: rsi(14) -> context.indicators.rsi[context.index]
            .replace(/ta\.rsi\((\d+)\)/g, 'context.indicators["RSI_$1"][context.index]')
            .replace(/ta\.sma\((\d+)\)/g, 'context.indicators["SMA_$1"][context.index]')
            .replace(/ta\.ema\((\d+)\)/g, 'context.indicators["EMA_$1"][context.index]')
            // Strategy calls
            .replace(/strategy\.entry\(/g, 'context.strategy.entry(')
            .replace(/strategy\.close\(/g, 'context.strategy.close(')

        try {
            return new Function('context', transpiled)
        } catch (e) {
            console.error("Compilation Error:", e)
            throw new Error("Failed to compile strategy script. Please check your syntax.")
        }
    }

    static prepareIndicators(data: any[], script: string): Record<string, number[]> {
        const indicators: Record<string, number[]> = {}
        const prices = data.map(d => d.close)

        // Find RSI(n) patterns
        const rsiMatches = script.matchAll(/ta\.rsi\((\d+)\)/g)
        for (const match of rsiMatches) {
            const period = parseInt(match[1])
            const key = `RSI_${period}`
            if (!indicators[key]) {
                const vals = ta.RSI.calculate({ period, values: prices })
                indicators[key] = new Array(data.length - vals.length).fill(NaN).concat(vals)
            }
        }

        // Find SMA(n) patterns
        const smaMatches = script.matchAll(/ta\.sma\((\d+)\)/g)
        for (const match of smaMatches) {
            const period = parseInt(match[1])
            const key = `SMA_${period}`
            if (!indicators[key]) {
                const vals = ta.SMA.calculate({ period, values: prices })
                indicators[key] = new Array(data.length - vals.length).fill(NaN).concat(vals)
            }
        }

        // Find EMA(n) patterns
        const emaMatches = script.matchAll(/ta\.ema\((\d+)\)/g)
        for (const match of emaMatches) {
            const period = parseInt(match[1])
            const key = `EMA_${period}`
            if (!indicators[key]) {
                const vals = ta.EMA.calculate({ period, values: prices })
                indicators[key] = new Array(data.length - vals.length).fill(NaN).concat(vals)
            }
        }

        return indicators
    }
}
