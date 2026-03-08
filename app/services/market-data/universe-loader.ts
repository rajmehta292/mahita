import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { GLOBAL_UNIVERSE } from './universe'

const CUSTOM_UNIVERSE_PATH = path.join(process.cwd(), 'data', 'symbol-universe.txt')

function normalizeLines(lines: string[]): string[] {
    return lines
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .map((line) => line.toUpperCase())
}

export async function getGlobalUniverse(): Promise<string[]> {
    try {
        const extraUniverse = await readFile(CUSTOM_UNIVERSE_PATH, 'utf8')
        return [...new Set([...GLOBAL_UNIVERSE, ...normalizeLines(extraUniverse.split('\n'))])]
    } catch {
        return [...GLOBAL_UNIVERSE]
    }
}

export function getStarterUniverse(): string[] {
    return [...GLOBAL_UNIVERSE]
}
