import { MODELS, getModel } from './registry'
import { ChatRequest } from './types'
import { OllamaAdapter } from './providers/ollama'
import { OpenAIAdapter } from './providers/openai'
import { UsageTracker } from './usage-tracker'
import { decrypt } from './encryption'
import prisma from '@/lib/prisma'

export class InferenceService {
    static async chat(userId: string, request: ChatRequest): Promise<ReadableStream<Uint8Array> | null> {
        const model = getModel(request.modelId)
        if (!model) throw new Error(`Model ${request.modelId} not found`)

        // 1. Resolve API Key
        let apiKey = ''
        let isByok = false

        if (model.provider !== 'ollama') {
            const userKey = await prisma.aIKey.findUnique({
                where: { userId_provider: { userId, provider: model.provider } }
            })

            if (userKey && userKey.isActive) {
                apiKey = decrypt(userKey.key)
                isByok = true
            } else {
                // Fallback to platform keys
                const envMap: Record<string, string> = {
                    'openai': 'OPENAI_API_KEY',
                    'anthropic': 'ANTHROPIC_API_KEY',
                    'moonshot': 'KIMI_API_KEY'
                }
                apiKey = process.env[envMap[model.provider] || ''] || ''
            }

            if (!apiKey) throw new Error(`No API key found for ${model.provider}`)
        }

        // 2. Route to Adapter
        let stream: ReadableStream<Uint8Array> | null
        if (model.provider === 'ollama') {
            const adapter = new OllamaAdapter()
            stream = await adapter.chat(request)
        } else if (model.provider === 'openai') {
            const adapter = new OpenAIAdapter()
            stream = await adapter.chat(request, apiKey)
        } else {
            throw new Error(`Provider ${model.provider} not implemented`)
        }

        // 3. Track Usage (Async)
        UsageTracker.track(userId, model.provider, model.id, 0, isByok).catch(console.error)

        return stream
    }
}
