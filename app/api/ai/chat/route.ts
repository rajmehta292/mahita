import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { InferenceService } from "@/lib/ai/inference"

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession()
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { messages, modelId } = body

        if (!messages) {
            return NextResponse.json({ error: "Missing messages array" }, { status: 400 })
        }

        const userId = (session.user as any).id || 'default_user'

        // Use the centralized InferenceService
        const stream = await InferenceService.chat(userId, {
            modelId: modelId || 'llama3.2:latest',
            messages: messages,
            stream: true
        })

        // For OpenAI/Kimi, the body is already a stream.
        // For Ollama, we return the raw response body.
        return new NextResponse(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    } catch (e: any) {
        console.error("AI Proxy Error:", e)
        return NextResponse.json({
            error: e.message || "AI Engine connection failed."
        }, { status: 503 })
    }
}
