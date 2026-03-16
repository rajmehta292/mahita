import fs from 'fs'
import { parse } from 'csv-parse/sync'
import { MarketDataPoint, Timeframe } from '../types'
import { marketDataStore } from '../store'

export class CSVImportService {
    /**
     * Imports a CSV file into the 'csv' vault.
     */
    async importFile(filePath: string, symbol: string, timeframe: Timeframe): Promise<number> {
        const content = fs.readFileSync(filePath, 'utf-8')
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true
        }) as Array<Record<string, string>>

        const points: MarketDataPoint[] = records.map((record) => {
            // Expected TradingView format: time, open, high, low, close, Volume
            const timeStr = record.time || record.Date || record.timestamp
            const date = new Date(timeStr)

            return {
                time: Math.floor(date.getTime() / 1000),
                open: parseFloat(record.open || record.Open),
                high: parseFloat(record.high || record.High),
                low: parseFloat(record.low || record.Low),
                close: parseFloat(record.close || record.Close),
                volume: parseFloat(record.volume || record.Volume || '0')
            }
        }).filter((p: MarketDataPoint) => !isNaN(p.time) && !isNaN(p.close))

        if (points.length === 0) return 0

        return marketDataStore.persistBars(
            symbol.toUpperCase(),
            timeframe,
            points,
            'csv-upload',
            true, // Overwrite
            'csv'
        )
    }
}

export const csvImportService = new CSVImportService()
