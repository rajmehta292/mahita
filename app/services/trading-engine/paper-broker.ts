import { MarketDataPoint } from '../market-data/types'
import { CompletedTrade, SignalType } from './types'

export class PaperBrokerProvider {
    private initialCapital: number
    private currentCapital: number
    private position: {
        side: 'Long' | 'Short',
        entryPrice: number,
        entryTime: number,
        quantity: number,
        stopLoss?: number,
        takeProfit?: number,
        entryIndex: number
    } | null = null
    private barIndex = 0

    public tradeHistory: CompletedTrade[] = []

    private commissionPercent = 0.001 // 0.1% per trade leg
    private slippagePercent = 0.0005  // 0.05% slippage

    constructor(initialCapital: number = 10000) {
        this.initialCapital = initialCapital
        this.currentCapital = initialCapital
    }

    public processSignal(signal: SignalType, bar: MarketDataPoint, risk: any) {
        this.barIndex++

        // 1. Check for Auto-Exits (SL/TP) first
        if (this.position) {
            this.checkExits(bar)
        }

        if (signal === 'Hold') return

        const fillPrice = this.calculateFillPrice(bar.close, signal)

        // 2. Handle Reversals or manual Exit signals
        if (this.position) {
            if ((this.position.side === 'Long' && signal === 'Sell') ||
                (this.position.side === 'Short' && signal === 'Buy')) {
                this.closePosition(fillPrice, bar.time)
            }
        }

        // 3. Open new position
        if (!this.position) {
            if (signal === 'Buy') {
                this.openPosition('Long', fillPrice, bar.time, risk)
            } else if (signal === 'Sell') {
                this.openPosition('Short', fillPrice, bar.time, risk)
            }
        }
    }

    private checkExits(bar: MarketDataPoint) {
        if (!this.position) return

        let hitPrice: number | null = null

        if (this.position.side === 'Long') {
            if (this.position.stopLoss && bar.low <= this.position.stopLoss) hitPrice = this.position.stopLoss
            if (this.position.takeProfit && bar.high >= this.position.takeProfit) hitPrice = this.position.takeProfit
        } else {
            if (this.position.stopLoss && bar.high >= this.position.stopLoss) hitPrice = this.position.stopLoss
            if (this.position.takeProfit && bar.low <= this.position.takeProfit) hitPrice = this.position.takeProfit
        }

        if (hitPrice) {
            this.closePosition(hitPrice, bar.time)
        }
    }

    private calculateFillPrice(price: number, signal: SignalType): number {
        const slippage = price * this.slippagePercent
        return signal === 'Buy' ? price + slippage : price - slippage
    }

    private openPosition(side: 'Long' | 'Short', price: number, time: number, risk: any) {
        const allocatedCash = this.currentCapital * (risk.positionSizingPercent / 100)
        const quantity = allocatedCash / price

        // Calculate SL/TP levels
        let stopLoss: number | undefined
        let takeProfit: number | undefined

        if (risk.stopLossPercent) {
            const multiplier = risk.stopLossPercent / 100
            stopLoss = side === 'Long' ? price * (1 - multiplier) : price * (1 + multiplier)
        }
        if (risk.takeProfitPercent) {
            const multiplier = risk.takeProfitPercent / 100
            takeProfit = side === 'Long' ? price * (1 + multiplier) : price * (1 - multiplier)
        }

        // Deduct entry commission
        const commission = allocatedCash * this.commissionPercent
        this.currentCapital -= commission

        this.position = {
            side,
            entryPrice: price,
            entryTime: time,
            quantity,
            stopLoss,
            takeProfit,
            entryIndex: this.barIndex
        }
    }

    private closePosition(price: number, time: number) {
        if (!this.position) return

        const positionValue = this.position.quantity * price
        const entryValue = this.position.quantity * this.position.entryPrice

        let pnl = 0
        if (this.position.side === 'Long') {
            pnl = positionValue - entryValue
        } else {
            pnl = entryValue - positionValue
        }

        // Deduct exit commission
        const commission = positionValue * this.commissionPercent
        pnl -= commission

        const pnlPercent = (pnl / entryValue) * 100
        this.currentCapital += pnl

        this.tradeHistory.push({
            id: Math.random().toString(36).substring(7),
            symbol: "TEST",
            side: this.position.side,
            entryTime: this.position.entryTime,
            entryPrice: this.position.entryPrice,
            exitTime: time,
            exitPrice: price,
            quantity: this.position.quantity,
            pnl,
            pnlPercent,
            durationBars: this.barIndex - this.position.entryIndex
        })

        this.position = null
    }
}
