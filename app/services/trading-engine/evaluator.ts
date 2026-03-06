import { MarketDataPoint } from '../market-data/types'
import { StrategyAST, SignalType, Rule, ConditionSet } from './types'
import { SMA, RSI } from 'technicalindicators'

export class StrategyEvaluator {
    private ast: StrategyAST
    private history: MarketDataPoint[] = []

    // Keep instances of indicators to calculate rolling values
    private currentFeatures: Record<string, number> = {}
    private previousFeatures: Record<string, number> = {}

    constructor(ast: StrategyAST) {
        this.ast = ast
    }

    // Called on every new tick/bar
    public evaluate(bar: MarketDataPoint, skipSignal: boolean = false): SignalType {
        this.previousFeatures = { ...this.currentFeatures }
        this.history.push(bar)

        // Maintain a window of max 200 bars for performance
        if (this.history.length > 200) {
            this.history.shift()
        }

        this.calculateFeatures()

        // If we are in warmup or don't have enough history, don't generate signals
        if (skipSignal || this.history.length < 2) return 'Hold'

        const entrySignal = this.checkConditionSet(this.ast.entryConditions)
        if (entrySignal) return 'Buy'

        if (this.ast.exitConditions) {
            const exitSignal = this.checkConditionSet(this.ast.exitConditions)
            if (exitSignal) return 'Sell'
        }

        return 'Hold'
    }

    private calculateFeatures() {
        this.currentFeatures['Price'] = this.history[this.history.length - 1].close
        this.currentFeatures['Volume'] = this.history[this.history.length - 1].volume

        // Find all distinct required indicators in AST
        const allRules = [...this.ast.entryConditions.rules, ...(this.ast.exitConditions?.rules || [])]

        for (const rule of allRules) {
            const key = `${rule.indicator}_${rule.parameter}`
            if (this.currentFeatures[key] !== undefined) continue // Already calc'd

            const closePrices = this.history.map(b => b.close)

            if (rule.indicator === 'SMA' && closePrices.length >= rule.parameter) {
                const values = SMA.calculate({ period: rule.parameter, values: closePrices })
                this.currentFeatures[key] = values[values.length - 1]
            } else if (rule.indicator === 'RSI' && closePrices.length > rule.parameter) {
                const values = RSI.calculate({ period: rule.parameter, values: closePrices })
                this.currentFeatures[key] = values[values.length - 1]
            }
        }
    }

    private checkConditionSet(set: ConditionSet): boolean {
        if (set.rules.length === 0) return false

        const results = set.rules.map(rule => this.evaluateRule(rule))

        if (set.logic === 'AND') {
            return results.every(r => r === true)
        } else {
            return results.some(r => r === true)
        }
    }

    private evaluateRule(rule: Rule): boolean {
        const key = rule.indicator === 'Price' || rule.indicator === 'Volume'
            ? rule.indicator
            : `${rule.indicator}_${rule.parameter}`

        const currentValue = this.currentFeatures[key]
        const previousValue = this.previousFeatures[key]

        if (currentValue === undefined) return false // Not enough data yet

        switch (rule.operator) {
            case '>': return currentValue > rule.value
            case '<': return currentValue < rule.value
            case '>=': return currentValue >= rule.value
            case '<=': return currentValue <= rule.value
            case '==': return currentValue === rule.value
            case 'crosses_above':
                return previousValue !== undefined && previousValue <= rule.value && currentValue > rule.value
            case 'crosses_below':
                return previousValue !== undefined && previousValue >= rule.value && currentValue < rule.value
            default: return false
        }
    }
}
