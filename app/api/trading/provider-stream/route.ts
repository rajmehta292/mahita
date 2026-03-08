import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { providerTelemetryBus } from '@/app/services/market-data/provider-telemetry'

export async function GET(request: NextRequest) {
    const session = await getServerSession(authOptions)

    if (!session) {
        return new Response('Unauthorized', { status: 401 })
    }

    const encoder = new TextEncoder()
    const initialEvents = providerTelemetryBus.getRecent(200)
    let cleanup = () => undefined

    const stream = new ReadableStream({
        start(controller) {
            const send = (event: string, data: unknown) => {
                controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
            }

            send('snapshot', { events: initialEvents })

            const unsubscribe = providerTelemetryBus.subscribe((event) => {
                send('provider', event)
            })

            const heartbeat = setInterval(() => {
                send('heartbeat', { timestamp: new Date().toISOString() })
            }, 15000)

            cleanup = () => {
                clearInterval(heartbeat)
                unsubscribe()
            }

            request.signal.addEventListener('abort', () => {
                cleanup()
                try {
                    controller.close()
                } catch {
                    // no-op
                }
            })
        },
        cancel() {
            cleanup()
        }
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive'
        }
    })
}
