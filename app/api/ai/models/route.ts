import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { MODELS } from '@/lib/ai/registry'
import prisma from '@/lib/prisma'

interface OllamaTagResponse {
    models?: Array<{
        name: string
    }>
}

type RuntimeModel = {
    id: string
    name: string
    provider: string
    isLocal: boolean
    capabilities: {
        streaming: boolean
        toolCalling: boolean
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions)
        const userId = session?.user?.id

        // 1. Check for BYOK
        let hasByok = false
        if (userId) {
            const keys = await prisma.aIKey.findMany({ where: { userId, isActive: true } })
            hasByok = keys.length > 0
        }

        // 2. Fetch Ollama
        let ollamaModels: RuntimeModel[] = []
        try {
            const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
            if (res.ok) {
                const data = await res.json() as OllamaTagResponse
                ollamaModels = (data.models ?? [])
                    .filter((model) => !model.name.includes('embed'))
                    .map((model) => ({
                        id: model.name,
                        name: model.name,
                        provider: 'ollama',
                        isLocal: true,
                        capabilities: { streaming: true, toolCalling: true }
                    }))
            }
        } catch { }

        // 3. Merge & Filter
        // User rule: "unless user has provided their own keys, in which case the server's ollama automatically disappears"
        const finalOllama = hasByok ? [] : ollamaModels
        const allModels = [...finalOllama, ...MODELS.filter(m => m.provider !== 'ollama')]

        return NextResponse.json({
            models: allModels,
            context: { hasByok, ollamaHidden: hasByok && ollamaModels.length > 0 }
        })
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load AI models'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
