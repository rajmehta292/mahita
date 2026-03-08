import fs from 'fs'
import path from 'path'
import * as parquet from 'parquetjs-lite'
import { Timeframe } from './timeframe-math'

export interface ParquetBar {
    time: number      // Unix timestamp in seconds
    open: number
    high: number
    low: number
    close: number
    volume: number
}

// Fixed Schema for Mahita V2 Data Lake
const barSchema = new parquet.ParquetSchema({
    time: { type: 'INT64' }, // ParquetJS lite INT64 handles unix timestamps safely
    open: { type: 'DOUBLE' },
    high: { type: 'DOUBLE' },
    low: { type: 'DOUBLE' },
    close: { type: 'DOUBLE' },
    volume: { type: 'DOUBLE' }
})

export class ParquetStorageService {
    private readonly basePath = path.join(process.cwd(), 'data', 'lake')

    constructor() {
        if (!fs.existsSync(this.basePath)) {
            fs.mkdirSync(this.basePath, { recursive: true })
        }
    }

    /**
     * Resolves the canonical partition path:
     * data/lake/{assetClass}/{symbol}/{timeframe}/{YYYY}/{MM}/{DD}/bars.parquet
     */
    getPartitionPath(
        assetClass: string,
        symbol: string,
        timeframe: Timeframe,
        partitionDate: Date
    ): string {
        const year = partitionDate.getUTCFullYear().toString()
        const month = String(partitionDate.getUTCMonth() + 1).padStart(2, '0')
        const day = String(partitionDate.getUTCDate()).padStart(2, '0')

        return path.join(
            this.basePath,
            assetClass,
            symbol.replace('/', '_').toUpperCase(),
            timeframe,
            year,
            month,
            day,
            'bars.parquet'
        )
    }

    /**
     * Writes a batch of bars to a specific Parquet partition file.
     * Replaces the file if it already exists (Data Lake partitions are immutable overwrites in V1).
     */
    async writePartition(filePath: string, bars: ParquetBar[]): Promise<void> {
        if (bars.length === 0) return

        const dir = path.dirname(filePath)
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true })
        }

        // Write to a temporary file first to prevent corruption during crash
        const tempPath = `${filePath}.tmp`

        try {
            const writer = await parquet.ParquetWriter.openFile(barSchema, tempPath)

            // Sort to ensure sequential layout on disk 
            bars.sort((a, b) => a.time - b.time)

            for (const bar of bars) {
                await writer.appendRow(bar as any) // ParquetJS lite type bridging
            }

            await writer.close()

            // Atomic rename
            fs.renameSync(tempPath, filePath)
        } catch (error) {
            if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath)
            }
            throw new Error(`Failed to write Parquet partition at ${filePath}: ${error}`)
        }
    }

    /**
     * Reads a full Parquet partition into memory, returning an array of raw bars.
     * Returns an empty array if the file doesn't exist.
     */
    async readPartition(filePath: string): Promise<ParquetBar[]> {
        if (!fs.existsSync(filePath)) {
            return []
        }

        const bars: ParquetBar[] = []
        try {
            const reader = await parquet.ParquetReader.openFile(filePath)
            const cursor = reader.getCursor()
            let record = null

            while (record = await cursor.next()) {
                bars.push({
                    time: Number(record.time),
                    open: Number(record.open),
                    high: Number(record.high),
                    low: Number(record.low),
                    close: Number(record.close),
                    volume: Number(record.volume)
                })
            }

            await reader.close()
            return bars
        } catch (error) {
            console.error(`[ParquetStore] Failed to read ${filePath}:`, error)
            return []
        }
    }
}

export const parquetStore = new ParquetStorageService()
