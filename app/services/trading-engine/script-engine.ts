import { createHash } from 'crypto'
import type { MarketDataPoint } from '../market-data/types'
import type { StrategyRunSettings } from './types'

type ScriptVariableMap = Record<string, unknown>
type ScriptSeriesHistory = Record<string, unknown[]>

export interface ScriptContext {
    index: number
    data: MarketDataPoint[]
    indicators: Record<string, number[]>
    vars: ScriptVariableMap
    seriesHistory?: ScriptSeriesHistory
    strategy: {
        entry: (id: string, direction: 'long' | 'short', params?: Record<string, unknown>) => void
        close: (id: string, params?: Record<string, unknown>) => void
        closeAll?: () => void
        readonly openTrades?: number
        readonly positionSize?: number
        readonly positionAvgPrice?: number
    }
}

interface ExecutionScope extends Record<string, unknown> {
    history: (seriesName: string, offset: number) => unknown
    __series: (seriesName: string) => number | undefined
    __seriesTuple: (...seriesNames: string[]) => Array<number | undefined>
    plot: () => undefined
    plotshape: () => undefined
    label: {
        new: () => undefined
        delete: () => undefined
        style_label_left: string
    }
    barstate: {
        islast: boolean
    }
    shape: {
        triangleup: string
        triangledown: string
    }
    location: {
        belowbar: string
        abovebar: string
    }
    format: {
        mintick: string
    }
    color: {
        green: string
        red: string
        gray: string
        black: string
        white: string
        new: (base: unknown) => unknown
    }
    math: Math
    str: {
        tostring: (value: unknown) => string
    }
    nz: (value: unknown, fallback?: unknown) => unknown
    isNa: (value: unknown) => boolean
    ta: {
        crossover: (leftKey: string, currentLeft: number, rightKey: string, currentRight: number) => boolean
        crossunder: (leftKey: string, currentLeft: number, rightKey: string, currentRight: number) => boolean
    }
    strategy: {
        long: 'long'
        short: 'short'
        cash: 'cash'
        fixed: 'fixed'
        readonly opentrades: number
        readonly position_size: number
        readonly position_avg_price: number
        entry: ScriptContext['strategy']['entry']
        close: ScriptContext['strategy']['close']
        close_all: () => void
    }
}

export interface ParsedStrategySettings {
    name: string
    pyramiding: number
    initialCapital: number
    defaultQtyType: 'cash' | 'fixed' | 'percent_of_equity'
    defaultQtyValue: number
}

export interface CompiledScriptArtifact {
    execute: (context: ScriptContext) => void
    normalizedScriptSource: string
    strategySettings: ParsedStrategySettings
}

export function hashPineSource(source: string) {
    return createHash('sha256')
        .update(source.replace(/\r\n/g, '\n').trim())
        .digest('hex')
}

export class ScriptCompiler {
    private static RESERVED_SCOPE_KEYS = new Set([
        'open',
        'high',
        'low',
        'close',
        'volume',
        'time',
        'bar_index',
        'ta',
        'strategy',
        'plot',
        'plotshape',
        'history',
        '__series',
        '__seriesTuple',
        'nz',
        'isNa',
        'math',
        'str',
        'color',
        'format',
        'shape',
        'location',
        'label',
        'barstate',
    ])

    static compile(script: string) {
        return this.compileDetailed(script).execute
    }

    static compileDetailed(script: string): CompiledScriptArtifact {
        const normalizedScriptSource = this.transpile(script)
        let executor: (scope: ExecutionScope) => void

        try {
            executor = new Function('scope', `with (scope) {\n${normalizedScriptSource}\n}`) as (scope: ExecutionScope) => void
        } catch (error) {
            console.error('Compilation Error:', error)
            throw new Error('Failed to compile Pine source for the PineTS-backed Mahita runtime. Check syntax or unsupported Pine features.')
        }

        return {
            normalizedScriptSource,
            strategySettings: this.extractStrategySettings(script),
            execute: (context: ScriptContext) => {
                const scope = this.createExecutionScope(context)
                const proxyScope = new Proxy(scope, {
                    has: () => true,
                    get(target, property) {
                        if (property === Symbol.unscopables) {
                            return undefined
                        }

                        return Reflect.get(target, property)
                    },
                    set(target, property, value) {
                        Reflect.set(target, property, value)
                        return true
                    },
                })

                executor(proxyScope)
                this.persistScopeValues(context, scope)
            },
        }
    }

    static extractStrategySettings(script: string): ParsedStrategySettings {
        const declaration = script.match(/strategy\s*\(([\s\S]*?)\)/)
        const body = declaration?.[1] ?? ''
        const titleMatch = body.match(/^\s*("([^"]+)"|'([^']+)')/)
        const pyramidingMatch = body.match(/pyramiding\s*=\s*(\d+)/)
        const initialCapitalMatch = body.match(/initial_capital\s*=\s*([0-9.]+)/)
        const defaultQtyTypeMatch = body.match(/default_qty_type\s*=\s*strategy\.(cash|fixed|percent_of_equity)/)
        const defaultQtyValueMatch = body.match(/default_qty_value\s*=\s*([0-9.]+)/)

        return {
            name: titleMatch?.[2] ?? titleMatch?.[3] ?? 'Mahita Strategy',
            pyramiding: Number(pyramidingMatch?.[1] ?? 1),
            initialCapital: Number(initialCapitalMatch?.[1] ?? 10000),
            defaultQtyType: (defaultQtyTypeMatch?.[1] as 'cash' | 'fixed' | 'percent_of_equity' | undefined) ?? 'cash',
            defaultQtyValue: Number(defaultQtyValueMatch?.[1] ?? 10000),
        }
    }

    static toRunSettings(
        strategySettings: ParsedStrategySettings,
        overrides?: Partial<StrategyRunSettings> | null,
        source: StrategyRunSettings['source'] = 'script-header'
    ): StrategyRunSettings {
        return {
            initialCapital: overrides?.initialCapital ?? strategySettings.initialCapital,
            defaultQtyType: overrides?.defaultQtyType ?? strategySettings.defaultQtyType,
            defaultQtyValue: overrides?.defaultQtyValue ?? strategySettings.defaultQtyValue,
            pyramiding: overrides?.pyramiding ?? strategySettings.pyramiding,
            commissionPercent: overrides?.commissionPercent ?? 0,
            verifyPriceForLimitOrdersTicks: overrides?.verifyPriceForLimitOrdersTicks ?? 0,
            slippageTicks: overrides?.slippageTicks ?? 0,
            marginLongPercent: overrides?.marginLongPercent ?? 100,
            marginShortPercent: overrides?.marginShortPercent ?? 100,
            calcAfterOrderFilled: overrides?.calcAfterOrderFilled ?? false,
            calcOnEveryTick: overrides?.calcOnEveryTick ?? false,
            useBarMagnifier: overrides?.useBarMagnifier ?? false,
            onBarClose: overrides?.onBarClose ?? false,
            useStandardOhlc: overrides?.useStandardOhlc ?? true,
            source,
        }
    }

    static prepareIndicators(data: MarketDataPoint[], script: string): Record<string, number[]> {
        const indicators: Record<string, number[]> = {}
        const generatedAssignments = Array.from(script.matchAll(/^\s*([A-Za-z_]\w*)\s*=\s*ta\.[^(]+\(.+\)\s*$/gm)).map((match) => match[1])

        for (const assignment of generatedAssignments) {
            indicators[assignment] = data.map(() => Number.NaN)
        }

        return indicators
    }

    private static transpile(script: string) {
        const lines = script.replace(/\r\n/g, '\n').split('\n')
        const output: string[] = []
        const indentStack: number[] = []
        let skipDebugBlock = false
        let debugIndent = -1

        const closeBlocks = (nextIndent: number) => {
            while (indentStack.length > 0 && nextIndent <= indentStack[indentStack.length - 1]) {
                indentStack.pop()
                output.push('}')
            }
        }

        for (const rawLine of lines) {
            const trimmed = rawLine.trim()
            if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('//@')) {
                continue
            }

            const indent = rawLine.match(/^\s*/)?.[0].length ?? 0

            if (skipDebugBlock) {
                if (indent <= debugIndent && trimmed.length > 0) {
                    skipDebugBlock = false
                    closeBlocks(indent)
                } else {
                    continue
                }
            } else {
                closeBlocks(indent)
            }

            let line = trimmed

            if (/^if\s+showDebug\s+and\s+barstate\.islast/.test(line)) {
                skipDebugBlock = true
                debugIndent = indent
                continue
            }

            if (/^(strategy|indicator)\s*\(/.test(line)) {
                continue
            }

            if (/^(plot|plotshape|plotchar|label\.)/.test(line)) {
                continue
            }

            line = this.normalizeInputDeclaration(line)
            line = line.replace(/:=/g, '=')

            const seriesTupleMatch = line.match(/^\[([^\]]+)\]\s*=\s*ta\.[A-Za-z_]\w*\([^)]*\)\s*$/)
            if (seriesTupleMatch) {
                const names = seriesTupleMatch[1]
                    .split(',')
                    .map((value) => value.trim())
                    .filter(Boolean)
                output.push(`[${names.join(', ')}] = __seriesTuple(${names.map((value) => JSON.stringify(value)).join(', ')});`)
                continue
            }

            const singleSeriesMatch = line.match(/^([A-Za-z_]\w*)\s*=\s*ta\.[A-Za-z_]\w*\([^)]*\)\s*$/)
            if (singleSeriesMatch) {
                output.push(`${singleSeriesMatch[1]} = __series(${JSON.stringify(singleSeriesMatch[1])});`)
                continue
            }

            line = line
                .replace(/\band\b/g, '&&')
                .replace(/\bor\b/g, '||')
                .replace(/\bnot\b/g, '!')
                .replace(/\bna\s*\(/g, 'isNa(')
                .replace(/\bna\b/g, 'NaN')
                .replace(/\b([A-Za-z_]\w*)\[(\d+)\]/g, 'history("$1", $2)')
                .replace(/strategy\.close\(\s*("[^"]+"|'[^']+')\s*,\s*comment\s*=\s*("[^"]+"|'[^']+')\s*\)/g, 'strategy.close($1, { comment: $2 })')
                .replace(/ta\.(crossover|crossunder)\(\s*([A-Za-z_]\w*|[0-9.]+)\s*,\s*([A-Za-z_]\w*|[0-9.]+)\s*\)/g, 'ta.$1("$2", $2, "$3", $3)')

            const persistentMatch = line.match(/^var(?:\s+\w+)?\s+([A-Za-z_]\w*)\s*=\s*(.+)$/)
            if (persistentMatch) {
                output.push(`if (typeof ${persistentMatch[1]} === "undefined") { ${persistentMatch[1]} = ${persistentMatch[2]}; }`)
                continue
            }

            if (line.startsWith('if ')) {
                output.push(`if (${line.slice(3).trim()}) {`)
                indentStack.push(indent)
                continue
            }

            if (line.startsWith('else if ')) {
                output.push(`else if (${line.slice(8).trim()}) {`)
                indentStack.push(indent)
                continue
            }

            if (line === 'else') {
                output.push('else {')
                indentStack.push(indent)
                continue
            }

            output.push(line.endsWith(';') ? line : `${line};`)
        }

        closeBlocks(-1)
        return output.join('\n')
    }

    private static normalizeInputDeclaration(line: string) {
        const match = line.match(/^([A-Za-z_]\w*)\s*=\s*input\.(int|float|bool|string)\((.+)\)$/)
        if (!match) {
            return line
        }

        const [, name, kind, rest] = match
        const defaultExpression = this.extractFirstArgument(rest)

        if (kind === 'bool') {
            return `${name} = ${defaultExpression === 'true' ? 'true' : 'false'}`
        }

        if (kind === 'string') {
            return `${name} = ${defaultExpression}`
        }

        return `${name} = ${Number(defaultExpression)}`
    }

    private static extractFirstArgument(rest: string) {
        let depth = 0
        let quote: '"' | "'" | null = null

        for (let index = 0; index < rest.length; index += 1) {
            const char = rest[index]
            if (quote) {
                if (char === quote && rest[index - 1] !== '\\') {
                    quote = null
                }
                continue
            }

            if (char === '"' || char === "'") {
                quote = char
                continue
            }

            if (char === '(') {
                depth += 1
                continue
            }

            if (char === ')') {
                depth = Math.max(0, depth - 1)
                continue
            }

            if (char === ',' && depth === 0) {
                return rest.slice(0, index).trim()
            }
        }

        return rest.trim()
    }

    private static createExecutionScope(context: ScriptContext) {
        const currentBar = context.data[context.index] ?? {}
        const scope = {
            ...context.vars,
            open: currentBar.open,
            high: currentBar.high,
            low: currentBar.low,
            close: currentBar.close,
            volume: currentBar.volume,
            time: currentBar.time,
            bar_index: context.index,
        } as unknown as ExecutionScope

        scope.history = (seriesName: string, offset: number) => {
            const normalizedOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset)) : 0

            if (seriesName === 'open' || seriesName === 'high' || seriesName === 'low' || seriesName === 'close' || seriesName === 'volume' || seriesName === 'time') {
                const historicalBar = context.data[context.index - normalizedOffset]
                return historicalBar?.[seriesName]
            }

            const entries = context.seriesHistory?.[seriesName] ?? []
            if (entries.length === 0) {
                return context.vars[seriesName]
            }

            return entries[entries.length - 1 - normalizedOffset]
        }

        scope.__series = (seriesName: string) => context.indicators[seriesName]?.[context.index]
        scope.__seriesTuple = (...seriesNames: string[]) => seriesNames.map((seriesName) => context.indicators[seriesName]?.[context.index])
        scope.plot = () => undefined
        scope.plotshape = () => undefined
        scope.label = {
            new: () => undefined,
            delete: () => undefined,
            style_label_left: 'style_label_left',
        }
        scope.barstate = {
            islast: context.index === context.data.length - 1,
        }
        scope.shape = {
            triangleup: 'triangleup',
            triangledown: 'triangledown',
        }
        scope.location = {
            belowbar: 'belowbar',
            abovebar: 'abovebar',
        }
        scope.format = {
            mintick: 'mintick',
        }
        scope.color = {
            green: '#22c55e',
            red: '#ef4444',
            gray: '#9ca3af',
            black: '#000000',
            white: '#ffffff',
            new: (base: unknown) => base,
        }
        scope.math = Math
        scope.str = {
            tostring: (value: unknown) => {
                if (value == null || (typeof value === 'number' && Number.isNaN(value))) {
                    return 'N/A'
                }

                return String(value)
            },
        }
        scope.nz = (value: unknown, fallback: unknown = 0) => {
            if (value == null) return fallback
            if (typeof value === 'number' && Number.isNaN(value)) return fallback
            return value
        }
        scope.isNa = (value: unknown) => value == null || (typeof value === 'number' && Number.isNaN(value))
        scope.ta = {
            crossover: (leftKey: string, currentLeft: number, rightKey: string, currentRight: number) => {
                const previousLeft = scope.history(leftKey, 1) ?? currentLeft
                const previousRight = scope.history(rightKey, 1) ?? currentRight
                return currentLeft > currentRight && previousLeft <= previousRight
            },
            crossunder: (leftKey: string, currentLeft: number, rightKey: string, currentRight: number) => {
                const previousLeft = scope.history(leftKey, 1) ?? currentLeft
                const previousRight = scope.history(rightKey, 1) ?? currentRight
                return currentLeft < currentRight && previousLeft >= previousRight
            },
        }
        scope.strategy = {
            long: 'long',
            short: 'short',
            cash: 'cash',
            fixed: 'fixed',
            get opentrades() {
                return context.strategy.openTrades ?? 0
            },
            get position_size() {
                return context.strategy.positionSize ?? 0
            },
            get position_avg_price() {
                return context.strategy.positionAvgPrice ?? 0
            },
            entry: context.strategy.entry,
            close: context.strategy.close,
            close_all: () => context.strategy.closeAll?.(),
        }

        return scope
    }

    private static persistScopeValues(context: ScriptContext, scope: ExecutionScope) {
        const seriesHistory = context.seriesHistory ?? {}
        context.seriesHistory = seriesHistory

        for (const [key, value] of Object.entries(scope)) {
            if (this.RESERVED_SCOPE_KEYS.has(key) || typeof value === 'function') {
                continue
            }

            context.vars[key] = value
            if (!seriesHistory[key]) {
                seriesHistory[key] = []
            }
            seriesHistory[key].push(value)
        }
    }
}
