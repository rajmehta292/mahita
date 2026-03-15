import { MarketDataPoint } from '../market-data/types'
import { CompletedTrade, NormalizedTradeRecord, SignalType, type StrategyRunSettings } from './types'

interface OpenLot {
    tradeNumber: number
    entryId: string
    side: 'Long'
    entryPrice: number
    entryTime: number
    quantity: number
    entryIndex: number
}

interface PendingOrder {
    kind: 'entry' | 'close' | 'close_all'
    id: string
    direction?: 'long' | 'short'
    comment?: string
}

interface BrokerConfig {
    initialCapital?: number
    symbol?: string
    settings?: Partial<StrategyRunSettings>
}

const TRADE_LABEL_FORMATTER = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
})

export class PaperBrokerProvider {
    private initialCapital: number
    private symbol: string
    private strategySettings: StrategyRunSettings
    private currentBarIndex = -1
    private pendingOrders: PendingOrder[] = []
    private openLots: OpenLot[] = []
    private cumulativePnl = 0
    private nextTradeNumber = 1

    public tradeHistory: CompletedTrade[] = []
    public tradeRows: NormalizedTradeRecord[] = []
    public warnings: string[] = []

    constructor(config: BrokerConfig = {}) {
        this.strategySettings = {
            pyramiding: config.settings?.pyramiding ?? 1,
            initialCapital: config.settings?.initialCapital ?? config.initialCapital ?? 10000,
            defaultQtyType: config.settings?.defaultQtyType ?? 'cash',
            defaultQtyValue: config.settings?.defaultQtyValue ?? 10000,
            commissionPercent: config.settings?.commissionPercent ?? 0,
            verifyPriceForLimitOrdersTicks: config.settings?.verifyPriceForLimitOrdersTicks ?? 0,
            slippageTicks: config.settings?.slippageTicks ?? 0,
            marginLongPercent: config.settings?.marginLongPercent ?? 100,
            marginShortPercent: config.settings?.marginShortPercent ?? 100,
            calcAfterOrderFilled: config.settings?.calcAfterOrderFilled ?? false,
            calcOnEveryTick: config.settings?.calcOnEveryTick ?? false,
            useBarMagnifier: config.settings?.useBarMagnifier ?? false,
            onBarClose: config.settings?.onBarClose ?? false,
            useStandardOhlc: config.settings?.useStandardOhlc ?? true,
            source: config.settings?.source,
        }
        this.initialCapital = config.initialCapital ?? this.strategySettings.initialCapital
        this.symbol = config.symbol ?? 'TEST'
    }

    get openTrades() {
        return this.openLots.length
    }

    get positionSize() {
        return this.openLots.reduce((sum, lot) => sum + lot.quantity, 0)
    }

    get positionAvgPrice() {
        const quantity = this.positionSize
        if (quantity <= 0) {
            return 0
        }

        const totalCost = this.openLots.reduce((sum, lot) => sum + lot.entryPrice * lot.quantity, 0)
        return totalCost / quantity
    }

    beginBar(bar: MarketDataPoint, barIndex: number) {
        this.currentBarIndex = barIndex
        if (this.pendingOrders.length === 0) {
            return
        }

        const pending = this.pendingOrders.splice(0)

        for (const order of pending.filter((candidate) => candidate.kind !== 'entry')) {
            if (order.kind === 'close_all') {
                this.closeMatchingLots(() => true, bar.open, bar.time, barIndex, order.comment)
            } else if (order.kind === 'close') {
                this.closeMatchingLots((lot) => lot.entryId === order.id, bar.open, bar.time, barIndex, order.comment)
            }
        }

        for (const order of pending.filter((candidate) => candidate.kind === 'entry')) {
            if (order.direction !== 'long') {
                this.warnings.push(`Mahita PineTS runtime currently supports long-only parity execution. Ignored ${order.direction ?? 'unknown'} entry.`)
                continue
            }

            if (this.openLots.length >= this.strategySettings.pyramiding) {
                continue
            }

            const entryPrice = this.applyEntryFillPrice(bar.open)
            const quantity = this.calculateEntryQuantity(entryPrice, bar.open)
            if (quantity <= 0) {
                this.warnings.push(`Skipped ${order.id} entry at ${this.formatTradeLabel(bar.time)} because quantity resolved to 0.`)
                continue
            }

            this.openLots.push({
                tradeNumber: this.nextTradeNumber,
                entryId: order.id,
                side: 'Long',
                entryPrice,
                entryTime: bar.time,
                quantity,
                entryIndex: barIndex,
            })
            this.nextTradeNumber += 1
        }
    }

    queueEntry(id: string, direction: 'long' | 'short', _params?: Record<string, unknown>) {
        this.pendingOrders.push({ kind: 'entry', id, direction })
    }

    queueClose(id: string, params?: Record<string, unknown>) {
        this.pendingOrders.push({
            kind: 'close',
            id,
            comment: typeof params?.comment === 'string' ? params.comment : undefined,
        })
    }

    queueCloseAll(comment?: string) {
        this.pendingOrders.push({ kind: 'close_all', id: 'ALL', comment })
    }

    processSignal(signal: SignalType, bar: MarketDataPoint) {
        if (signal === 'Buy') {
            this.queueEntry('Legacy Long', 'long')
        } else if (signal === 'Sell') {
            this.queueCloseAll('Legacy exit')
        }

        this.beginBar({ ...bar, open: bar.close }, this.currentBarIndex + 1)
    }

    markToMarket(price: number) {
        const unrealized = this.openLots.reduce((sum, lot) => sum + (price - lot.entryPrice) * lot.quantity, 0)
        return this.initialCapital + this.cumulativePnl + unrealized
    }

    finalize(bar?: MarketDataPoint) {
        if (!bar) {
            return
        }

        if (this.pendingOrders.length > 0) {
            this.warnings.push('Pending strategy orders remained at the end of the dataset and were not filled.')
        }

        if (this.openLots.length > 0) {
            this.closeMatchingLots(() => true, this.applyForcedExitPrice(bar.close), bar.time, this.currentBarIndex, 'Open')
        }
    }

    private calculateEntryQuantity(price: number, markPrice: number) {
        if (this.strategySettings.defaultQtyType === 'fixed') {
            return Math.max(0, Math.floor(this.strategySettings.defaultQtyValue))
        }

        if (this.strategySettings.defaultQtyType === 'percent_of_equity') {
            const equity = this.markToMarket(markPrice)
            const allocation = equity * (this.strategySettings.defaultQtyValue / 100)
            return Math.max(0, Math.floor(allocation / price))
        }

        return Math.max(0, Math.floor(this.strategySettings.defaultQtyValue / price))
    }

    private closeMatchingLots(
        predicate: (lot: OpenLot) => boolean,
        exitPrice: number,
        exitTime: number,
        exitBarIndex: number,
        exitComment?: string
    ) {
        const remaining: OpenLot[] = []

        for (const lot of this.openLots) {
            if (!predicate(lot)) {
                remaining.push(lot)
                continue
            }

            const grossPnl = (this.applyExitFillPrice(exitPrice) - lot.entryPrice) * lot.quantity
            const commission = ((lot.entryPrice * lot.quantity) + (this.applyExitFillPrice(exitPrice) * lot.quantity)) * (this.strategySettings.commissionPercent / 100)
            const realizedExitPrice = this.applyExitFillPrice(exitPrice)
            const pnl = this.round(grossPnl - commission)
            const entryValue = lot.entryPrice * lot.quantity
            const pnlPercent = entryValue === 0 ? 0 : this.round((pnl / entryValue) * 100)
            this.cumulativePnl = this.round(this.cumulativePnl + pnl)

            const completedTrade: CompletedTrade = {
                id: `${lot.tradeNumber}`,
                symbol: this.symbol,
                side: lot.side,
                entryTime: lot.entryTime,
                entryPrice: lot.entryPrice,
                exitTime,
                exitPrice: realizedExitPrice,
                quantity: lot.quantity,
                pnl,
                pnlPercent,
                durationBars: Math.max(0, exitBarIndex - lot.entryIndex),
                entryId: lot.entryId,
                exitComment,
                reportedPositionSize: lot.quantity,
                cumulativePnl: this.cumulativePnl,
            }

            this.tradeHistory.push(completedTrade)
            this.tradeRows.push({
                tradeNumber: lot.tradeNumber,
                type: 'Exit long',
                timestampLabel: this.formatTradeLabel(exitTime),
                price: this.round(realizedExitPrice),
                positionSizeQty: lot.quantity,
                positionSizeValue: this.round(entryValue),
                netPnl: pnl,
                netPnlPercent: pnlPercent,
                cumulativePnl: this.cumulativePnl,
                cumulativePnlPercent: this.round((this.cumulativePnl / this.initialCapital) * 100),
                signal: exitComment ?? lot.entryId,
            })
            this.tradeRows.push({
                tradeNumber: lot.tradeNumber,
                type: 'Entry long',
                timestampLabel: this.formatTradeLabel(lot.entryTime),
                price: this.round(lot.entryPrice),
                positionSizeQty: lot.quantity,
                positionSizeValue: this.round(entryValue),
                netPnl: pnl,
                netPnlPercent: pnlPercent,
                cumulativePnl: this.cumulativePnl,
                cumulativePnlPercent: this.round((this.cumulativePnl / this.initialCapital) * 100),
                signal: lot.entryId,
            })
        }

        this.openLots = remaining
    }

    private formatTradeLabel(timestamp: number) {
        return TRADE_LABEL_FORMATTER.format(new Date(timestamp * 1000))
    }

    private round(value: number) {
        return Math.round(value * 100) / 100
    }

    private applyEntryFillPrice(price: number) {
        if (this.strategySettings.slippageTicks <= 0) {
            return price
        }

        return this.round(price + this.strategySettings.slippageTicks * 0.01)
    }

    private applyExitFillPrice(price: number) {
        if (this.strategySettings.slippageTicks <= 0) {
            return price
        }

        return this.round(price - this.strategySettings.slippageTicks * 0.01)
    }

    private applyForcedExitPrice(price: number) {
        return this.applyExitFillPrice(price)
    }
}
