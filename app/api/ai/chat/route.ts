import { NextRequest, NextResponse } from "next/server"

// Hardcode default model
const OLLAMA_MODEL = 'llama3.2:latest'

export async function POST(req: NextRequest) {
    try {
        const body = await req.json()
        const { messages, model } = body

        if (!messages) {
            return NextResponse.json({ error: "Missing messages array" }, { status: 400 })
        }

        const selectedModel = model || 'llama3.2:latest'

        // Routing Logic
        if (selectedModel.includes('kimi')) {
            // Kimi Cloud (OpenAI Compatible)
            const KIMI_KEY = process.env.KIMI_API_KEY
            if (!KIMI_KEY) {
                return NextResponse.json({ error: "Kimi API Key missing in environment." }, { status: 500 })
            }

            const kimiRes = await fetch("https://api.moonshot.cn/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${KIMI_KEY}`
                },
                body: JSON.stringify({
                    model: "moonshot-v1-8k", // Defaulting to an available Kimi model
                    messages: messages,
                    stream: true,
                })
            })

            if (!kimiRes.ok) {
                const errText = await kimiRes.text()
                console.error("Kimi API Error:", errText)
                return NextResponse.json({ error: `Kimi Cloud Error: ${errText}` }, { status: 502 })
            }

            return new NextResponse(kimiRes.body, {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                }
            })
        }

        // Default: Hit the local Ollama daemon
        const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: selectedModel,
                messages: messages,
                stream: true,
            })
        })

        if (!ollamaRes.ok) {
            console.error("Ollama API Error:", await ollamaRes.text())
            return NextResponse.json({ error: `Ollama error: Failed to connect to ${selectedModel}` }, { status: 502 })
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
        return NextResponse.json({ error: "AI Engine connection refused. Check logs." }, { status: 503 })
    }
}
