import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { GLOBAL_UNIVERSE } from './universe'

const CUSTOM_UNIVERSE_PATH = path.join(process.cwd(), 'data', 'symbol-universe.txt')
const TOP_1000_CSV_PATH = path.join(process.cwd(), 'data', 'resolved_top_1000.csv')

function normalizeLines(lines: string[]): string[] {
    return lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.toUpperCase())
}

export async function getGlobalUniverse(): Promise<string[]> {
    const extraAssets: string[] = []

    try {
        const extraUniverse = await readFile(CUSTOM_UNIVERSE_PATH, 'utf8')
        extraAssets.push(...normalizeLines(extraUniverse.split('\n')))
    } catch {
        // Optional file missing
    }

    try {
        const top1000Csv = await readFile(TOP_1000_CSV_PATH, 'utf8')
        const lines = top1000Csv.split('\n')

        // Skip header at i=0
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim()
            if (!line) continue

            // Name,Ticker,Market Cap (USD)
            // Due to corporate names potentially having commas (e.g. "Apple, Inc."), 
            // the safest split logic relies on picking the second to last element.
            const parts = line.split(',')
            if (parts.length >= 3) {
                let ticker = parts[parts.length - 2].trim().toUpperCase()

                // Map common formatting gaps provided by the crawler
                if (ticker === 'BTC') ticker = 'BTC-USD'
                else if (ticker === 'ETH') ticker = 'ETH-USD'
                else if (ticker === 'BRK-B') ticker = 'BRK.B'
                else if (ticker === 'BRK-A') ticker = 'BRK.A'

                // Keep the ticker even if it's foreign (.SR, .KS) 
                // as downstream providers (Yahoo) can handle them.
                if (ticker) {
                    extraAssets.push(ticker)
                }
            }
        }
    } catch (err) {
        console.error("[UniverseLoader] Error reading top 1000 assets CSV:", err)
    }

    return [...new Set([...GLOBAL_UNIVERSE, ...extraAssets])]
}

export function getStarterUniverse(): string[] {
    return [...GLOBAL_UNIVERSE]
}
