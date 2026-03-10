import { ChatMessage, ChatRequest } from '../types'

export class OllamaAdapter {
    async chat(request: ChatRequest) {
        const response = await fetch('http://127.0.0.1:11434/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.modelId,
                messages: request.messages,
                stream: true,
                options: {
                    temperature: request.temperature || 0.7
                }
            })
        })

        if (!response.ok) {
            throw new Error(`Ollama error: ${response.statusText}`)
        }

        return response.body // Return the raw stream
    }
}
