import { NextRequest, NextResponse } from 'next/server'
import { ingestionService } from '@/app/services/market-data/ingestion'

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}))
    const symbol = body.symbol as string | undefined
    const overrideTimeframe = body.overrideTimeframe
    const provider = body.provider as string | undefined

    if (ingestionService.isRunning()) {
        return NextResponse.json({ error: 'Ingestion currently in progress.' }, { status: 429 })
    }

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const send = (type: 'log' | 'result' | 'error', data: unknown) => {
                controller.enqueue(encoder.encode(JSON.stringify({ type, data }) + '\n'))
            }

            try {
                const result = await ingestionService.runSweep({
                    symbols: symbol ? [symbol] : undefined,
                    overrideTimeframe,
                    provider
                }, async (payload, level = 'log') => {
                    send(level === 'error' ? 'error' : 'log', payload)
                })

                send('result', {
                    processed: result.processed,
                    persistedBars: result.persistedBars,
                    symbols: result.symbols.length,
                    timeframes: result.timeframes
                })
            } catch (error) {
                send('error', {
                    message: error instanceof Error ? error.message : 'Fatal ingestion error'
                })
            } finally {
                controller.close()
            }
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
        }
    })
}
