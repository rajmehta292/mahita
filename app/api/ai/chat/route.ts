import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { InferenceService } from "@/lib/ai/inference"
import { authOptions } from "@/lib/auth"

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions)
        if (!session?.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        const body = await req.json()
        const { messages, modelId } = body

        if (!messages) {
            return NextResponse.json({ error: "Missing messages array" }, { status: 400 })
        }

        const userId = session.user.id

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
    } catch (error) {
        console.error("AI Proxy Error:", error)
        return NextResponse.json({
            error: error instanceof Error ? error.message : "AI Engine connection failed."
        }, { status: 503 })
    }
}
