'use client'

import React, { useState } from 'react'
import { FlaskConical, Play, AlertCircle, CheckCircle2 } from 'lucide-react'

// Base type for a diagnostic test card
export interface DiagnosticTest {
    id: string
    title: string
    description: string
    method: 'GET' | 'POST'
    endpoint: string
    defaultParams?: Record<string, string>
}

// Configured list of diagnostic tests
const DIAGNOSTIC_TESTS: DiagnosticTest[] = [
    {
        id: 'schwab_accounts',
        title: 'Schwab Accounts',
        description: 'Fetch linked Schwab account numbers and balances.',
        method: 'GET',
        endpoint: '/api/schwab/accounts'
    },
    {
        id: 'schwab_positions',
        title: 'Schwab Positions',
        description: 'Fetch real-time holdings and positions for the active account.',
        method: 'GET',
        endpoint: '/api/schwab/positions'
    },
    {
        id: 'schwab_quotes',
        title: 'Schwab Real-Time Quotes',
        description: 'Fetch live L1 quotes for a symbol.',
        method: 'GET',
        endpoint: '/api/trading/quotes',
        defaultParams: { symbols: 'AAPL', provider: 'schwab' }
    },
    {
        id: 'schwab_history',
        title: 'Schwab Historical Data',
        description: 'Fetch raw historical candles from Schwab API via backend.',
        method: 'GET',
        endpoint: '/api/trading/market-data',
        defaultParams: { symbol: 'AAPL', timeframe: '1d', provider: 'schwab' }
    },
    {
        id: 'yahoo_quotes',
        title: 'Yahoo Finance Quotes',
        description: 'Fetch fallback quotes from Yahoo Finance.',
        method: 'GET',
        endpoint: '/api/trading/quotes',
        defaultParams: { symbols: 'AAPL', provider: 'yahoo' }
    },
    {
        id: 'yahoo_history',
        title: 'Yahoo Finance History',
        description: 'Fetch raw historical candles from Yahoo Finance.',
        method: 'GET',
        endpoint: '/api/trading/market-data',
        defaultParams: { symbol: 'AAPL', timeframe: '1d', provider: 'yahoo' }
    },
    {
        id: 'market_news',
        title: 'Market News Feed',
        description: 'Fetch latest financial news from API.',
        method: 'GET',
        endpoint: '/api/trading/news'
    }
]

export default function DevTestsPage() {
    return (
        <div className="min-h-screen bg-[#131722] text-white p-6 md:p-10 font-sans">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-500/20 rounded-xl">
                            <FlaskConical className="w-8 h-8 text-blue-400" />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white">Diagnostics & Dev Tests</h1>
                    </div>
                    <p className="text-gray-400 max-w-2xl leading-relaxed">
                        Manually trigger explicit, isolated backend API queries to prove routing and payload integrity independent of the UI charting components.
                    </p>
                </div>

                {/* Grid of Tests */}
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    {DIAGNOSTIC_TESTS.map(test => (
                        <TestCard key={test.id} test={test} />
                    ))}
                </div>
            </div>
        </div>
    )
}

function TestCard({ test }: { test: DiagnosticTest }) {
    const [params, setParams] = useState<Record<string, string>>(test.defaultParams || {})
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [duration, setDuration] = useState<number | null>(null)
    const [output, setOutput] = useState<string | null>(null)

    const handleParamChange = (key: string, value: string) => {
        setParams(prev => ({ ...prev, [key]: value }))
    }

    const runTest = async () => {
        setStatus('loading')
        setOutput(null)
        setDuration(null)

        const startTime = Date.now()

        try {
            // Build Query String if it's a GET request with params
            let url = test.endpoint
            const queryParams = new URLSearchParams()

            Object.entries(params).forEach(([k, v]) => {
                if (v.trim()) queryParams.append(k, v.trim())
            })

            if (test.method === 'GET' && queryParams.toString()) {
                url += `?${queryParams.toString()}`
            }

            const res = await fetch(url, {
                method: test.method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: test.method === 'POST' ? JSON.stringify(params) : undefined
            })

            const endTime = Date.now()
            setDuration(endTime - startTime)

            const rawText = await res.text()

            // Try formatting as JSON if possible
            try {
                const jsonObj = JSON.parse(rawText)
                setOutput(JSON.stringify(jsonObj, null, 2))
                setStatus(res.ok ? 'success' : 'error')
            } catch (e) {
                setOutput(rawText)
                setStatus(res.ok ? 'success' : 'error')
            }

        } catch (error: any) {
            setDuration(Date.now() - startTime)
            setStatus('error')
            setOutput(error.message || 'Network request failed completely.')
        }
    }

    return (
        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl overflow-hidden flex flex-col shadow-lg shadow-black/20">
            {/* Card Header */}
            <div className="p-5 border-b border-[#2A2E39] bg-[#1a1e28]">
                <div className="flex justify-between items-start gap-4">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
                            {test.title}
                            {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </h3>
                        <p className="text-sm text-gray-400">{test.description}</p>
                    </div>
                    <div className="px-2 py-1 bg-[#2A2E39] rounded-md border border-[#363A45] text-xs font-mono text-gray-300 whitespace-nowrap">
                        <span className={test.method === 'GET' ? 'text-blue-400' : 'text-purple-400'}>{test.method}</span> {test.endpoint}
                    </div>
                </div>
            </div>

            {/* Card Body - Controls */}
            <div className="p-5 space-y-4">
                {Object.keys(params).length > 0 && (
                    <div className="flex flex-wrap gap-3">
                        {Object.entries(params).map(([k, v]) => (
                            <div key={k} className="flex flex-col gap-1 w-[120px]">
                                <label className="text-xs text-gray-500 font-medium uppercase tracking-wider">{k}</label>
                                <input
                                    type="text"
                                    value={v}
                                    onChange={(e) => handleParamChange(k, e.target.value)}
                                    className="bg-[#131722] border border-[#2A2E39] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                                />
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center gap-4">
                    <button
                        onClick={runTest}
                        disabled={status === 'loading'}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all shadow-sm ${status === 'loading'
                                ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                                : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20'
                            }`}
                    >
                        <Play className={`w-4 h-4 ${status === 'loading' ? 'animate-pulse' : ''}`} />
                        {status === 'loading' ? 'Executing...' : 'Run Query'}
                    </button>

                    {duration !== null && (
                        <span className="text-xs text-gray-500 font-mono">
                            {duration}ms
                        </span>
                    )}
                </div>
            </div>

            {/* Card Footer - Output */}
            {output && (
                <div className="relative border-t border-[#2A2E39] bg-[#151924] flex-1 min-h-[200px] max-h-[400px]">
                    <div className="absolute top-0 right-0 p-2">
                        <span className={`text-[10px] font-mono px-2 py-1 rounded-sm ${status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                            {status.toUpperCase()}
                        </span>
                    </div>
                    <pre className="p-5 text-[13px] font-mono text-gray-300 overflow-auto h-full w-full custom-scrollbar">
                        <code>{output}</code>
                    </pre>
                </div>
            )}
        </div>
    )
}
