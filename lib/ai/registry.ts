import { AIModel } from './types'

export const MODELS: AIModel[] = [
    {
        id: 'gpt-4o',
        name: 'GPT-4o',
        provider: 'openai',
        isLocal: false,
        capabilities: { streaming: true, toolCalling: true, vision: true },
        contextWindow: 128000
    },
    {
        id: 'gpt-4o-mini',
        name: 'GPT-4o Mini',
        provider: 'openai',
        isLocal: false,
        capabilities: { streaming: true, toolCalling: true },
        contextWindow: 128000
    },
    {
        id: 'claude-3-5-sonnet',
        name: 'Claude 3.5 Sonnet',
        provider: 'anthropic',
        isLocal: false,
        capabilities: { streaming: true, toolCalling: true, vision: true },
        contextWindow: 200000
    },
    {
        id: 'kimi-k2.5-cloud',
        name: 'Kimi V1 (8k)',
        provider: 'moonshot',
        isLocal: false,
        capabilities: { streaming: true, toolCalling: false },
        contextWindow: 8000
    },
    {
        id: 'llama3.2:latest',
        name: 'Llama 3.2 (Local)',
        provider: 'ollama',
        isLocal: true,
        capabilities: { streaming: true, toolCalling: true },
        contextWindow: 4096
    }
]

export function getModel(id: string): AIModel | undefined {
    return MODELS.find(m => m.id === id)
}
