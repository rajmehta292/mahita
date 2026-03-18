import { EventEmitter } from 'node:events'
import { closeSync, existsSync, fstatSync, mkdirSync, openSync, readSync } from 'node:fs'
import { appendFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

export type ProviderTelemetryKind = 'request' | 'response' | 'error' | 'verification' | 'control'

export interface ProviderTelemetryEvent {
    id: string
    timestamp: string
    kind: ProviderTelemetryKind
    provider?: string
    symbol?: string
    timeframe?: string
    rangeStart?: number
    rangeEnd?: number
    message: string
    request?: Record<string, unknown>
    response?: Record<string, unknown>
}

class ProviderTelemetryBus {
    private readonly emitter = new EventEmitter()
    private readonly logPath = path.join(process.cwd(), 'logs', 'provider-traffic.jsonl')
    private events: ProviderTelemetryEvent[] = []
    private readonly maxEvents = 500
    private readonly hydrateByteLimit = 2 * 1024 * 1024

    constructor() {
        this.emitter.setMaxListeners(0)
        this.hydrateFromDisk()
    }

    subscribe(listener: (event: ProviderTelemetryEvent) => void): () => void {
        this.emitter.on('event', listener)
        return () => {
            this.emitter.off('event', listener)
        }
    }

    getRecent(limit = 200): ProviderTelemetryEvent[] {
        return this.events.slice(-limit)
    }

    async clear(): Promise<void> {
        this.events = []
        this.ensureLogDir()
        await writeFile(this.logPath, '', 'utf8')
    }

    async log(event: Omit<ProviderTelemetryEvent, 'id' | 'timestamp'>): Promise<ProviderTelemetryEvent> {
        const fullEvent: ProviderTelemetryEvent = {
            ...event,
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            timestamp: new Date().toISOString()
        }

        this.events.push(fullEvent)
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents)
        }

        this.emitter.emit('event', fullEvent)

        try {
            this.ensureLogDir()
            await appendFile(this.logPath, `${JSON.stringify(fullEvent)}\n`, 'utf8')
        } catch (error) {
            console.error('[ProviderTelemetryBus] Failed to append telemetry event:', error)
        }

        return fullEvent
    }

    private hydrateFromDisk() {
        try {
            if (!existsSync(this.logPath)) {
                return
            }

            const raw = this.readRecentLogChunk().trim()
            if (!raw) {
                return
            }

            const lines = raw.split('\n')
            const safeLines = lines.length > this.maxEvents
                ? lines.slice(-this.maxEvents)
                : lines

            this.events = safeLines
                .slice(-this.maxEvents)
                .map((line) => JSON.parse(line) as ProviderTelemetryEvent)
                .filter((event) => !!event?.id)
        } catch (error) {
            console.error('[ProviderTelemetryBus] Failed to hydrate telemetry log:', error)
            this.events = []
        }
    }

    private readRecentLogChunk() {
        const fd = openSync(this.logPath, 'r')

        try {
            const stats = fstatSync(fd)
            if (stats.size === 0) {
                return ''
            }

            const bytesToRead = Math.min(stats.size, this.hydrateByteLimit)
            const start = Math.max(0, stats.size - bytesToRead)
            const buffer = Buffer.alloc(bytesToRead)
            readSync(fd, buffer, 0, bytesToRead, start)

            let chunk = buffer.toString('utf8')
            if (start > 0) {
                const firstNewline = chunk.indexOf('\n')
                chunk = firstNewline >= 0 ? chunk.slice(firstNewline + 1) : ''
            }

            return chunk
        } finally {
            closeSync(fd)
        }
    }

    private ensureLogDir() {
        const dir = path.dirname(this.logPath)
        if (!existsSync(dir)) {
            mkdirSync(dir, { recursive: true })
        }
    }
}

declare global {
    var __mahitaProviderTelemetryBus: ProviderTelemetryBus | undefined
}

export const providerTelemetryBus = globalThis.__mahitaProviderTelemetryBus ?? new ProviderTelemetryBus()

if (process.env.NODE_ENV !== 'production') {
    globalThis.__mahitaProviderTelemetryBus = providerTelemetryBus
}
