
import { MarketDataPoint } from '../app/services/market-data/types'
import { StrategyEvaluator } from '../app/services/trading-engine/evaluator'
import { StrategyAST } from '../app/services/trading-engine/types'

async function testCrossLogic() {
    console.log("Testing Cross Logic...")

    const strategy: StrategyAST = {
        id: "test",
        name: "Test Cross",
        asset: "AAPL",
        timeframe: "1d",
        riskManagement: { positionSizingPercent: 100 },
        entryConditions: {
            logic: 'AND',
            rules: [
                { indicator: 'Price', parameter: 0, operator: 'crosses_above', value: 100 }
            ]
        },
        exitConditions: {
            logic: 'AND',
            rules: [
                { indicator: 'Price', parameter: 0, operator: 'crosses_below', value: 100 }
            ]
        }
    }

    const evaluator = new StrategyEvaluator(strategy)

    const data: MarketDataPoint[] = [
        { time: 1, open: 98, high: 99, low: 97, close: 98, volume: 100 },
        { time: 2, open: 98, high: 102, low: 98, close: 101, volume: 100 }, // Crosses Above 100
        { time: 3, open: 101, high: 105, low: 101, close: 103, volume: 100 }, // Still above
        { time: 4, open: 103, high: 103, low: 98, close: 99, volume: 100 }, // Crosses Below 100
    ]

    const expected = ['Hold', 'Buy', 'Hold', 'Sell']

    for (let i = 0; i < data.length; i++) {
        const signal = evaluator.evaluate(data[i])
        console.log(`Bar ${i}: Price=${data[i].close}, Signal=${signal}, Expected=${expected[i]}`)
        if (signal !== expected[i]) {
            console.error(`FAIL: Bar ${i} expected ${expected[i]} but got ${signal}`)
            process.exit(1)
        }
    }

    console.log("Cross logic verification PASSED")
}

testCrossLogic().catch(console.error)
