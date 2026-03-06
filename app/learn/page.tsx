'use client'

import { useState } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import { 
    BookOpen, 
    Code, 
    Play,
    CheckCircle,
    ChevronRight,
    Copy,
    ExternalLink
} from 'lucide-react'

export default function LearnPage() {
    const [activeSection, setActiveSection] = useState('basics')
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    const copyCode = (code: string, id: string) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(id)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    const sections = [
        { id: 'basics', title: 'Basics', icon: BookOpen },
        { id: 'indicators', title: 'Technical Indicators', icon: Code },
        { id: 'strategy', title: 'Strategy Functions', icon: Play },
        { id: 'examples', title: 'Complete Examples', icon: CheckCircle },
    ]

    return (
        <MainLayout>
            <div className="flex-1 flex bg-[#131722] overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-[#1E222D] border-r border-[#2A2E39] overflow-auto">
                    <div className="p-4 border-b border-[#2A2E39]">
                        <h2 className="text-white font-semibold flex items-center gap-2">
                            <BookOpen className="w-5 h-5 text-blue-500" />
                            Pine Script Guide
                        </h2>
                    </div>
                    <div className="p-2">
                        {sections.map((section) => {
                            const Icon = section.icon
                            return (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={`w-full px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${
                                        activeSection === section.id
                                            ? 'bg-blue-500/20 text-blue-500'
                                            : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="text-sm font-medium">{section.title}</span>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto">
                    <div className="max-w-4xl mx-auto p-8">
                        {activeSection === 'basics' && <BasicsSection copyCode={copyCode} copiedCode={copiedCode} />}
                        {activeSection === 'indicators' && <IndicatorsSection copyCode={copyCode} copiedCode={copiedCode} />}
                        {activeSection === 'strategy' && <StrategySection copyCode={copyCode} copiedCode={copiedCode} />}
                        {activeSection === 'examples' && <ExamplesSection copyCode={copyCode} copiedCode={copiedCode} />}
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}

function BasicsSection({ copyCode, copiedCode }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Pine Script Basics</h1>
                <p className="text-gray-400">Learn the fundamentals of writing trading strategies</p>
            </div>

            <Section title="Script Structure">
                <p className="text-gray-300 mb-4">
                    Every Pine Script strategy starts with a version declaration and uses JavaScript-like syntax:
                </p>
                <CodeBlock
                    code={`// Pine Script Strategy
// @version=1

// Your strategy code goes here`}
                    id="structure"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Variables">
                <p className="text-gray-300 mb-4">
                    Declare variables using <code className="text-blue-400">const</code>:
                </p>
                <CodeBlock
                    code={`const price = close
const volume = volume
const high_price = high
const low_price = low`}
                    id="variables"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Conditional Logic">
                <p className="text-gray-300 mb-4">
                    Use if statements to create trading logic:
                </p>
                <CodeBlock
                    code={`if (close > open) {
    // Price is going up
    strategy.entry("Long", "long")
}

if (close < open) {
    // Price is going down
    strategy.close("Long")
}`}
                    id="conditionals"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Operators">
                <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#2A2E39]">
                                <th className="text-left py-2 text-gray-400">Operator</th>
                                <th className="text-left py-2 text-gray-400">Description</th>
                                <th className="text-left py-2 text-gray-400">Example</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-300">
                            <tr className="border-b border-[#2A2E39]">
                                <td className="py-2"><code className="text-blue-400">&gt;</code></td>
                                <td className="py-2">Greater than</td>
                                <td className="py-2"><code>price &gt; 100</code></td>
                            </tr>
                            <tr className="border-b border-[#2A2E39]">
                                <td className="py-2"><code className="text-blue-400">&lt;</code></td>
                                <td className="py-2">Less than</td>
                                <td className="py-2"><code>rsi &lt; 30</code></td>
                            </tr>
                            <tr className="border-b border-[#2A2E39]">
                                <td className="py-2"><code className="text-blue-400">===</code></td>
                                <td className="py-2">Equal to</td>
                                <td className="py-2"><code>volume === 0</code></td>
                            </tr>
                            <tr className="border-b border-[#2A2E39]">
                                <td className="py-2"><code className="text-blue-400">&amp;&amp;</code></td>
                                <td className="py-2">AND</td>
                                <td className="py-2"><code>rsi &lt; 30 &amp;&amp; macd &gt; 0</code></td>
                            </tr>
                            <tr>
                                <td className="py-2"><code className="text-blue-400">||</code></td>
                                <td className="py-2">OR</td>
                                <td className="py-2"><code>rsi &gt; 70 || price &lt; sma</code></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Section>
        </div>
    )
}

function IndicatorsSection({ copyCode, copiedCode }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Technical Indicators</h1>
                <p className="text-gray-400">Built-in indicators for technical analysis</p>
            </div>

            <Section title="Moving Averages">
                <CodeBlock
                    code={`// Simple Moving Average
const sma_20 = ta.sma(20)
const sma_50 = ta.sma(50)

// Exponential Moving Average
const ema_9 = ta.ema(9)
const ema_21 = ta.ema(21)

// Weighted Moving Average
const wma_10 = ta.wma(10)`}
                    id="ma"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Momentum Indicators">
                <CodeBlock
                    code={`// Relative Strength Index
const rsi = ta.rsi(14)

// MACD
const macd = ta.macd(12, 26, 9)

// Stochastic
const stoch = ta.stoch(14, 3, 3)

// CCI (Commodity Channel Index)
const cci = ta.cci(20)`}
                    id="momentum"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Volatility Indicators">
                <CodeBlock
                    code={`// Bollinger Bands
const bb = ta.bb(20, 2)
const bb_upper = bb.upper
const bb_middle = bb.middle
const bb_lower = bb.lower

// Average True Range
const atr = ta.atr(14)

// Standard Deviation
const stdev = ta.stdev(20)`}
                    id="volatility"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Volume Indicators">
                <CodeBlock
                    code={`// On-Balance Volume
const obv = ta.obv()

// Volume Weighted Average Price
const vwap = ta.vwap()

// Money Flow Index
const mfi = ta.mfi(14)`}
                    id="volume"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>
        </div>
    )
}

function StrategySection({ copyCode, copiedCode }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Strategy Functions</h1>
                <p className="text-gray-400">Functions for entering and exiting trades</p>
            </div>

            <Section title="Entry Functions">
                <p className="text-gray-300 mb-4">
                    Use <code className="text-blue-400">strategy.entry()</code> to open positions:
                </p>
                <CodeBlock
                    code={`// Enter a long position
strategy.entry("Long", "long")

// Enter a short position
strategy.entry("Short", "short")

// Entry with condition
if (close > sma_50) {
    strategy.entry("Long", "long")
}`}
                    id="entry"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Exit Functions">
                <p className="text-gray-300 mb-4">
                    Use <code className="text-blue-400">strategy.close()</code> to close positions:
                </p>
                <CodeBlock
                    code={`// Close a specific position
strategy.close("Long")

// Close with condition
if (rsi > 70) {
    strategy.close("Long")
}

// Close all positions
strategy.close_all()`}
                    id="exit"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Risk Management">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                    <p className="text-yellow-500 text-sm">
                        <strong>Important:</strong> Stop-loss and take-profit are configured in the backtest settings, 
                        not in the script. This keeps your strategy logic clean and reusable across different risk parameters.
                    </p>
                </div>
                <p className="text-gray-300 mb-4">
                    Your script focuses on entry/exit logic. Risk management is handled separately:
                </p>
                <CodeBlock
                    code={`// ✅ Good: Focus on entry/exit logic
if (ema_fast > ema_slow && rsi < 70) {
    strategy.entry("Long", "long")
}

if (ema_fast < ema_slow) {
    strategy.close("Long")
}

// ❌ Don't do this: Risk management in script
// Stop-loss and take-profit are set in backtest config`}
                    id="risk"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>
        </div>
    )
}

function ExamplesSection({ copyCode, copiedCode }: any) {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2">Complete Examples</h1>
                <p className="text-gray-400">Ready-to-use strategy templates</p>
            </div>

            <Section title="EMA Crossover Strategy">
                <p className="text-gray-300 mb-4">
                    A simple trend-following strategy using EMA crossovers:
                </p>
                <CodeBlock
                    code={`// EMA Crossover Strategy
// @version=1

const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)

// Entry: Fast EMA crosses above slow EMA
if (ema_fast > ema_slow) {
    strategy.entry("Long", "long")
}

// Exit: Fast EMA crosses below slow EMA
if (ema_fast < ema_slow) {
    strategy.close("Long")
}`}
                    id="ema-crossover"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="RSI Mean Reversion">
                <p className="text-gray-300 mb-4">
                    Buy oversold conditions and sell overbought:
                </p>
                <CodeBlock
                    code={`// RSI Mean Reversion
// @version=1

const rsi = ta.rsi(14)

// Entry: RSI crosses below 30 (oversold)
if (rsi < 30) {
    strategy.entry("Long", "long")
}

// Exit: RSI crosses above 70 (overbought)
if (rsi > 70) {
    strategy.close("Long")
}`}
                    id="rsi-mean"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Bollinger Band Breakout">
                <p className="text-gray-300 mb-4">
                    Trade breakouts from Bollinger Bands:
                </p>
                <CodeBlock
                    code={`// Bollinger Band Breakout
// @version=1

const bb = ta.bb(20, 2)
const price = close

// Entry: Price breaks above upper band
if (price > bb.upper) {
    strategy.entry("Long", "long")
}

// Exit: Price crosses back below middle band
if (price < bb.middle) {
    strategy.close("Long")
}`}
                    id="bb-breakout"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>

            <Section title="Multi-Indicator Confirmation">
                <p className="text-gray-300 mb-4">
                    Combine multiple indicators for stronger signals:
                </p>
                <CodeBlock
                    code={`// Multi-Indicator Strategy
// @version=1

const ema_fast = ta.ema(9)
const ema_slow = ta.ema(21)
const rsi = ta.rsi(14)
const macd = ta.macd(12, 26, 9)

// Entry: All conditions must be true
if (ema_fast > ema_slow && rsi < 70 && macd > 0) {
    strategy.entry("Long", "long")
}

// Exit: Any exit condition triggers
if (ema_fast < ema_slow || rsi > 70 || macd < 0) {
    strategy.close("Long")
}`}
                    id="multi-indicator"
                    copyCode={copyCode}
                    copiedCode={copiedCode}
                />
            </Section>
        </div>
    )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">{title}</h2>
            {children}
        </div>
    )
}

function CodeBlock({ code, id, copyCode, copiedCode }: any) {
    return (
        <div className="relative">
            <pre className="bg-[#0d0e12] border border-[#2A2E39] rounded-lg p-4 overflow-x-auto">
                <code className="text-sm text-gray-300">{code}</code>
            </pre>
            <button
                onClick={() => copyCode(code, id)}
                className="absolute top-2 right-2 p-2 bg-[#1E222D] hover:bg-[#2A2E39] rounded border border-[#2A2E39] transition-colors"
            >
                {copiedCode === id ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                )}
            </button>
        </div>
    )
}
