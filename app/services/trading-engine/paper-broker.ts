import { MarketDataPoint } from '../market-data/types'
import { CompletedTrade, SignalType } from './types'

export class PaperBrokerProvider {
    private initialCapital: number
    private currentCapital: number
    private position: { side: 'Long' | 'Short', entryPrice: number, entryTime: number, quantity: number } | null = null

    public tradeHistory: CompletedTrade[] = []

    private commissionPercent = 0.001 // 0.1% per trade leg
    private slippagePercent = 0.0005  // 0.05% slippage

    constructor(initialCapital: number = 10000) {
        this.initialCapital = initialCapital
        this.currentCapital = initialCapital
    }

    public processSignal(signal: SignalType, bar: MarketDataPoint, percentAllocation: number) {
        if (signal === 'Hold') return

        const fillPrice = this.calculateFillPrice(bar.close, signal)

        // Flat position if we want to reverse or just exit
        if (this.position) {
            if ((this.position.side === 'Long' && signal === 'Sell') ||
                (this.position.side === 'Short' && signal === 'Buy')) {
                this.closePosition(fillPrice, bar.time)
            }
        }

        // Open new position
        if (!this.position) {
            if (signal === 'Buy') {
                this.openPosition('Long', fillPrice, bar.time, percentAllocation)
            } else if (signal === 'Sell') {
                this.openPosition('Short', fillPrice, bar.time, percentAllocation)
            }
        }
    }

    private calculateFillPrice(price: number, signal: SignalType): number {
        const slippage = price * this.slippagePercent
        return signal === 'Buy' ? price + slippage : price - slippage
    }

    private openPosition(side: 'Long' | 'Short', price: number, time: number, percentAllocation: number) {
        const allocatedCash = this.currentCapital * (percentAllocation / 100)
        const quantity = allocatedCash / price

        // Deduct entry commission
        const commission = allocatedCash * this.commissionPercent
        this.currentCapital -= commission

        this.position = { side, entryPrice: price, entryTime: time, quantity }
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

        this.currentCapital += pnl

        this.tradeHistory.push({
            id: Math.random().toString(36).substring(7),
            symbol: "TEST", // In reality passed from context
            side: this.position.side,
            entryTime: this.position.entryTime,
            entryPrice: this.position.entryPrice,
            exitTime: time,
            exitPrice: price,
            quantity: this.position.quantity,
            pnl
        })

        this.position = null
    }
}
