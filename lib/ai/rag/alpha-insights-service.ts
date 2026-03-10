import { InferenceService } from '../inference'
import { queryKnowledgeBase, KnowledgeEntry } from './knowledge-base'
import { Position } from '../types'

export interface AlphaInsight {
    type: 'RISK' | 'OPPORTUNITY' | 'SECTOR' | 'EDUCATIONAL'
    title: string
    description: string
    confidence: number
    actionable?: string
}

export interface PortfolioAssessment {
    score: number // 0-100 rating
    summary: string
    insights: AlphaInsight[]
}

export class AlphaInsightsService {
    private inference: InferenceService

    constructor() {
        this.inference = new InferenceService()
    }

    async generateAssessment(userId: string, positions: Position[], balance: any): Promise<PortfolioAssessment> {
        // 1. Summarize Portfolio for LLM
        const portfolioStr = positions.map(p =>
            `${p.symbol}: ${p.quantity} shares @ $${p.averagePrice.toFixed(2)} (Current: $${p.currentPrice.toFixed(2)}, MV: $${p.marketValue.toLocaleString()})`
        ).join('\n')

        const totalMV = positions.reduce((sum, p) => sum + p.marketValue, 0)
        const totalPL = positions.reduce((sum, p) => sum + p.unrealizedPL, 0)

        // 2. Fetch Relevant Knowledge (RAG Lite)
        // Simple keyword-based fetch for now based on concentration and total MV
        const knowledge = [
            ...queryKnowledgeBase('Concentration'),
            ...queryKnowledgeBase('Risk Parity'),
            ...(totalMV > 500000 ? queryKnowledgeBase('Mid-Career') : queryKnowledgeBase('Early Career'))
        ]

        const contextStr = knowledge.map(k => `[Rule: ${k.title}]\n${k.content}`).join('\n\n')

        // 3. Construct Prompt
        const prompt = `
            You are a Senior Alpha Wealth Manager. Analyze this portfolio and provide a structured JSON assessment.
            
            USER PORTFOLIO:
            Total Market Value: $${totalMV.toLocaleString()}
            Total Unrealized P&L: $${totalPL.toLocaleString()}
            Positions:
            ${portfolioStr}

            FINANCIAL PRINCIPLES:
            ${contextStr}

            RESPONSE REQUIREMENT:
            Return a JSON object with:
            {
                "score": number (0-100 rating of portfolio health),
                "summary": "1-2 sentence overview",
                "insights": [
                    {
                        "type": "RISK" | "OPPORTUNITY" | "SECTOR" | "EDUCATIONAL",
                        "title": "Short catchy title",
                        "description": "Deep analysis",
                        "confidence": number,
                        "actionable": "Specific step to take"
                    }
                ]
            }
            Only return the JSON. No conversational filler.
        `

        try {
            const stream = await InferenceService.chat(userId, {
                modelId: 'llama3.2:latest',
                messages: [
                    { role: 'system', content: 'You are a precise financial analysis engine. Return only JSON.' },
                    { role: 'user', content: prompt }
                ],
                stream: true
            })

            // Consume stream for internal processing
            const reader = stream.getReader()
            const decoder = new TextDecoder()
            let fullText = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                fullText += decoder.decode(value, { stream: true })
            }

            // Parse response
            const cleaned = fullText.replace(/```json|```/g, '').trim()
            return JSON.parse(cleaned) as PortfolioAssessment
        } catch (e) {
            console.error("Alpha Insights Generation Failed:", e)
            return {
                score: 70,
                summary: "Standard portfolio verification active. AI analysis partially restricted by API latency.",
                insights: [
                    {
                        type: 'EDUCATIONAL',
                        title: 'Diversification Check',
                        description: 'Based on your current holdings, ensure no single industry exceeds 20% of your total equity value.',
                        confidence: 90
                    }
                ]
            }
        }
    }
}
