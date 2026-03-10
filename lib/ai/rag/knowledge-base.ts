/**
 * Financial Knowledge Base for Alpha Insights
 * Synthesized from money manager logic and life-stage investing principles.
 * This serves as the 'expert context' for our RAG-driven analysis.
 */

export interface KnowledgeEntry {
    category: 'LIFE_STAGE' | 'RISK_MANAGEMENT' | 'TACTICAL' | 'TAX_EFFICIENCY'
    title: string
    content: string
    tags: string[]
}

export const FINANCIAL_KNOWLEDGE_BASE: KnowledgeEntry[] = [
    {
        category: 'LIFE_STAGE',
        title: 'Early Career Portfolio Strategy (Accumulation Phase)',
        content: 'Investors in their 20s-30s should focus on aggressive growth. Time horizon allows for higher volatility tolerance. Key principles: 1) High equity exposure (80-100%), 2) Emphasis on technology and growth sectors, 3) Systematic contribution over market timing, 4) Utilization of tax-advantaged accounts like Roth IRAs.',
        tags: ['growth', 'aggressive', 'accumulation', 'roth']
    },
    {
        category: 'LIFE_STAGE',
        title: 'Mid-Career Portfolio Strategy (Consolidation Phase)',
        content: 'Investors in their 40s-50s should shift toward moderate growth with increasing emphasis on diversification. Key principles: 1) Balanced equity exposure (60-80%), 2) Introduction of fixed income and alternative assets, 3) Focus on "Quality" and "Value" factors, 4) Rebalancing to prevent sector over-concentration.',
        tags: ['moderate', 'diversification', 'value', 'quality']
    },
    {
        category: 'LIFE_STAGE',
        title: 'Retirement/Pre-Retirement Strategy (Distribution Phase)',
        content: 'Investors near or in retirement focus on capital preservation and income generation. Key principles: 1) Conservative asset allocation (30-50% equity), 2) High allocation to dividend-paying stocks, REITs, and corporate bonds, 3) 2-3 years of cash equivalents to weather market downturns, 4) Focus on "Minimum Volatility" indices.',
        tags: ['conservative', 'income', 'capital-preservation', 'dividends']
    },
    {
        category: 'RISK_MANAGEMENT',
        title: 'Risk Parity and Correlation',
        content: 'Effective risk management requires understanding the correlation between assets. Diversifying within equities (e.g., holding both Tech and Utilities) reduces idiosyncratic risk. A money manager looks for assets that respond differently to inflation, interest rate hikes, and economic growth shifts.',
        tags: ['risk', 'correlation', 'diversification', 'inflation']
    },
    {
        category: 'TACTICAL',
        title: 'Sector Rotation and Macro Awareness',
        content: 'Tactical adjustments involve over-weighting sectors expected to outperform based on the economic cycle. Early cycle: Financials, Consumer Discretionary. Late cycle: Healthcare, Consumer Staples, Utilities. Recession: Energy, Gold, Defensive Cash.',
        tags: ['tactical', 'sector-rotation', 'macro', 'cycle']
    },
    {
        category: 'TAX_EFFICIENCY',
        title: 'Tax Loss Harvesting Logic',
        content: 'Money managers systematically "harvest" losses in taxable accounts to offset gains or up to $3,000 of ordinary income. This involves selling a security at a loss and immediately buying a "substantially similar" but not "identical" security to maintain market exposure while generating a tax benefit.',
        tags: ['tax', 'harvesting', 'efficiency', 'cost-basis']
    },
    {
        category: 'RISK_MANAGEMENT',
        title: 'The 10/10/10 Rule for Concentration',
        content: 'To prevent ruinous concentration risk: No single position should exceed 10% of the portfolio, no single industry should exceed 10%, and no more than 10% of the portfolio should be in illiquid "moonshot" investments.',
        tags: ['concentration', 'risk-limits', 'sizing']
    }
]

export function queryKnowledgeBase(query: string): KnowledgeEntry[] {
    const term = query.toLowerCase()
    return FINANCIAL_KNOWLEDGE_BASE.filter(entry =>
        entry.title.toLowerCase().includes(term) ||
        entry.content.toLowerCase().includes(term) ||
        entry.tags.some(t => t.toLowerCase().includes(term))
    )
}
