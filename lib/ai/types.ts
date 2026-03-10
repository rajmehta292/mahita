export type MessageRole = 'system' | 'user' | 'assistant'

export interface Position {
    symbol: string
    quantity: number
    averagePrice: number
    currentPrice: number
    marketValue: number
    unrealizedPL: number
    unrealizedPLPercent: number
    description?: string
}

export interface ChatMessage {
    role: MessageRole
    content: string
}

export interface ChatRequest {
    modelId: string
    messages: ChatMessage[]
    temperature?: number
    stream?: boolean
}

export interface AIProviderCapabilities {
    streaming: boolean
    toolCalling: boolean
    reasoning?: boolean
    vision?: boolean
}

export interface AIModel {
    id: string
    name: string
    provider: string
    isLocal: boolean
    capabilities: AIProviderCapabilities
    contextWindow?: number
    pricing?: {
        input: number
        output: number
    }
}
