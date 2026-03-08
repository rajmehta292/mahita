import { ingestionService } from './ingestion'
import { providerTelemetryBus } from './provider-telemetry'

export interface ContinuousIngestStatus {
    running: boolean
    startedAt: string | null
    lastCompletedAt: string | null
    cycleCount: number
    currentPhase: string
    providerOverride: string | null
    intervalMs: number
    lastError: string | null
}

interface StartOptions {
    provider?: string
    intervalMs?: number
}

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

class ContinuousIngestController {
    private running = false
    private startedAt: Date | null = null
    private lastCompletedAt: Date | null = null
    private cycleCount = 0
    private currentPhase = 'idle'
    private providerOverride: string | null = null
    private intervalMs = 60_000
    private lastError: string | null = null
    private loopPromise: Promise<void> | null = null

    getStatus(): ContinuousIngestStatus {
        return {
            running: this.running,
            startedAt: this.startedAt?.toISOString() || null,
            lastCompletedAt: this.lastCompletedAt?.toISOString() || null,
            cycleCount: this.cycleCount,
            currentPhase: this.currentPhase,
            providerOverride: this.providerOverride,
            intervalMs: this.intervalMs,
            lastError: this.lastError
        }
    }

    async start(options: StartOptions = {}): Promise<ContinuousIngestStatus> {
        if (this.running) {
            return this.getStatus()
        }

        if (ingestionService.isRunning()) {
            throw new Error('Another ingestion sweep is already running. Wait for it to finish before starting continuous mode.')
        }

        this.running = true
        this.startedAt = new Date()
        this.providerOverride = options.provider || null
        this.intervalMs = Math.max(15_000, options.intervalMs || 60_000)
        this.lastError = null
        this.currentPhase = 'starting'

        await providerTelemetryBus.log({
            kind: 'control',
            message: 'Continuous ingestion started.',
            response: {
                providerOverride: this.providerOverride || 'auto',
                intervalMs: this.intervalMs
            }
        })

        this.loopPromise = this.runLoop()
        return this.getStatus()
    }

    async stop(): Promise<ContinuousIngestStatus> {
        this.running = false
        this.currentPhase = ingestionService.isRunning() ? 'stopping after current sweep' : 'idle'

        await providerTelemetryBus.log({
            kind: 'control',
            message: 'Continuous ingestion stop requested.'
        })

        return this.getStatus()
    }

    private async runLoop() {
        while (this.running) {
            this.cycleCount += 1
            this.currentPhase = `running cycle ${this.cycleCount}`

            try {
                await ingestionService.runSweep({ provider: this.providerOverride || undefined })
                this.lastCompletedAt = new Date()
                this.lastError = null
            } catch (error) {
                this.lastCompletedAt = new Date()
                this.lastError = error instanceof Error ? error.message : 'Unknown error'
                await providerTelemetryBus.log({
                    kind: 'error',
                    message: 'Continuous ingestion cycle failed.',
                    response: {
                        cycleCount: this.cycleCount,
                        error: this.lastError
                    }
                })
            }

            if (!this.running) {
                break
            }

            this.currentPhase = `sleeping ${Math.round(this.intervalMs / 1000)}s before next cycle`

            let remaining = this.intervalMs
            while (this.running && remaining > 0) {
                const nextSleep = Math.min(remaining, 1_000)
                await sleep(nextSleep)
                remaining -= nextSleep
            }
        }

        this.currentPhase = 'idle'
        this.running = false
    }
}

declare global {
    var __mahitaContinuousIngestController: ContinuousIngestController | undefined
}

export const continuousIngestController = globalThis.__mahitaContinuousIngestController ?? new ContinuousIngestController()

if (process.env.NODE_ENV !== 'production') {
    globalThis.__mahitaContinuousIngestController = continuousIngestController
}
