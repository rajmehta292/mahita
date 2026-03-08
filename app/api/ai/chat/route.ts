import { NextRequest, NextResponse } from "next/server"

// Hardcode default model
const OLLAMA_MODEL = 'llama3.2:latest'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { messages } = body

        if (!messages) {
            return NextResponse.json({ error: "Missing messages array" }, { status: 400 })
        }

        // Hit the local Ollama daemon running on the host machine
        const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: messages,
                stream: true,
            })
        })

        if (!ollamaRes.ok) {
            console.error("Ollama API Error:", await ollamaRes.text())
            return NextResponse.json({ error: "Failed to communicate with local Ollama instance." }, { status: 502 })
        }

        // We stream the exact response chunks back to the client directly
        return new NextResponse(ollamaRes.body, {
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    } catch (e) {
        console.error("AI Proxy Error:", e)
        return NextResponse.json({ error: "Ollama connection refused. Is the local daemon running on port 11434?" }, { status: 503 })
    }
}
