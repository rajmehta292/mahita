import OpenAI from 'openai'
import { ChatRequest } from '../types'

export class OpenAIAdapter {
    async chat(request: ChatRequest, apiKey: string) {
        const openai = new OpenAI({ apiKey })

        return await openai.chat.completions.create({
            model: request.modelId,
            messages: request.messages as any,
            stream: request.stream !== false,
            temperature: request.temperature || 0.7,
        })
    }
}
