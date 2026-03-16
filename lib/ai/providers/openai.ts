import OpenAI from 'openai'
import { ChatRequest } from '../types'

export class OpenAIAdapter {
    async chat(request: ChatRequest, apiKey: string): Promise<ReadableStream<Uint8Array>> {
        return this.toStream(request, apiKey)
    }

    private async toStream(request: ChatRequest, apiKey: string): Promise<ReadableStream<Uint8Array>> {
        const openai = new OpenAI({ apiKey })
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = request.messages.map((message) => ({
            role: message.role,
            content: message.content,
        }))
        const completion = await openai.chat.completions.create({
            model: request.modelId,
            messages,
            stream: true,
            temperature: request.temperature || 0.7,
        })
        const encoder = new TextEncoder()

        return new ReadableStream<Uint8Array>({
            async start(controller) {
                try {
                    for await (const chunk of completion) {
                        const content = chunk.choices[0]?.delta?.content
                        if (!content) {
                            continue
                        }

                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`)
                        )
                    }

                    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                    controller.close()
                } catch (error) {
                    controller.error(error)
                }
            },
        })
    }
}
