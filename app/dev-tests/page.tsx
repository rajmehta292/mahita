'use client'

import React, { useState, useMemo, useEffect } from 'react'
import { FlaskConical, Play, AlertCircle, CheckCircle2, ChevronRight, ChevronDown, Search, Plus, Trash2 } from 'lucide-react'

// Base type for a diagnostic test card
export interface DiagnosticTest {
    id: string
    title: string
    description: string
    method: 'GET' | 'POST' | 'DELETE' | 'PUT'
    endpoint: string
    category: string
    defaultParams?: Record<string, string>
}

interface SchwabAccountSummary {
    securitiesAccount?: {
        hashValue?: string
        accountId?: string
        accountNumber?: string
    }
}

// Configured categories
const CATEGORIES = ['Auth & Accounts', 'Trading & Orders', 'Market Data', 'Ingestion & Health']

// Configured list of diagnostic tests
const DIAGNOSTIC_TESTS: DiagnosticTest[] = [
    // Auth & Accounts
    {
        id: 'user_schwab_config',
        title: 'User Schwab Config',
        description: 'Fetch the active saved Schwab auth configuration for the user.',
        method: 'GET',
        endpoint: '/api/user/schwab-config',
        category: 'Auth & Accounts'
    },
    {
        id: 'schwab_auth',
        title: 'Schwab Auth Status',
        description: 'Check the connection status of the Schwab API for the current user.',
        method: 'GET',
        endpoint: '/api/schwab/auth',
        category: 'Auth & Accounts'
    },
    {
        id: 'schwab_accounts',
        title: 'Schwab Accounts',
        description: 'Fetch linked Schwab account numbers and balances.',
        method: 'GET',
        endpoint: '/api/schwab/accounts',
        category: 'Auth & Accounts'
    },
    {
        id: 'schwab_positions',
        title: 'Schwab Positions',
        description: 'Fetch real-time holdings. Requires accountId (hashValue) from Accounts payload.',
        method: 'GET',
        endpoint: '/api/schwab/positions',
        category: 'Auth & Accounts',
        defaultParams: { accountId: '' }
    },
    // Trading & Orders
    {
        id: 'schwab_orders',
        title: 'Schwab Orders',
        description: 'Fetch active/historical orders. Requires accountId.',
        method: 'GET',
        endpoint: '/api/schwab/orders',
        category: 'Trading & Orders',
        defaultParams: { accountId: '' }
    },
    {
        id: 'schwab_place_order',
        title: 'Place Schwab Order',
        description: 'Submit a new trade order to Schwab. Requires accountId and a JSON stringified order object.',
        method: 'POST',
        endpoint: '/api/schwab/orders',
        category: 'Trading & Orders',
        defaultParams: { accountId: '', order: '{"orderType":"MARKET","session":"NORMAL","duration":"DAY","orderStrategyType":"SINGLE","orderLegCollection":[{"instruction":"BUY","quantity":1,"instrument":{"symbol":"AAPL","assetType":"EQUITY"}}]}' }
    },
    {
        id: 'schwab_cancel_order',
        title: 'Cancel open Schwab Order',
        description: 'Cancel an open order by ID. Requires accountId and orderId.',
        method: 'DELETE',
        endpoint: '/api/schwab/orders',
        category: 'Trading & Orders',
        defaultParams: { accountId: '', orderId: '' }
    },
    {
        id: 'screener',
        title: 'Market Screener',
        description: 'Run the algorithmic backend screener against the universe.',
        method: 'GET',
        endpoint: '/api/trading/screener',
        category: 'Trading & Orders'
    },
    // Market Data
    {
        id: 'schwab_quotes',
        title: 'Schwab Real-Time Quotes',
        description: 'Fetch live L1 quotes for a symbol.',
        method: 'GET',
        endpoint: '/api/trading/quotes',
        category: 'Market Data',
        defaultParams: { symbols: 'AAPL', provider: 'schwab' }
    },
    {
        id: 'schwab_history',
        title: 'Schwab Historical Data',
        description: 'Fetch raw historical candles from Schwab API via backend.',
        method: 'GET',
        endpoint: '/api/trading/market-data',
        category: 'Market Data',
        defaultParams: { symbol: 'AAPL', timeframe: '1d', provider: 'schwab' }
    },
    {
        id: 'yahoo_quotes',
        title: 'Yahoo Finance Quotes',
        description: 'Fetch fallback quotes from Yahoo Finance.',
        method: 'GET',
        endpoint: '/api/trading/quotes',
        category: 'Market Data',
        defaultParams: { symbols: 'AAPL', provider: 'yahoo' }
    },
    {
        id: 'yahoo_history',
        title: 'Yahoo Finance History',
        description: 'Fetch raw historical candles from Yahoo Finance.',
        method: 'GET',
        endpoint: '/api/trading/market-data',
        category: 'Market Data',
        defaultParams: { symbol: 'AAPL', timeframe: '1d', provider: 'yahoo' }
    },
    {
        id: 'market_news',
        title: 'Market News Feed',
        description: 'Fetch latest financial news from API.',
        method: 'GET',
        endpoint: '/api/trading/news',
        category: 'Market Data'
    },
    // Ingestion & Health
    {
        id: 'data_vaults',
        title: 'SQLite Vault Status',
        description: 'List active database vaults and size stats.',
        method: 'GET',
        endpoint: '/api/trading/vaults',
        category: 'Ingestion & Health'
    },
    {
        id: 'data_inventory',
        title: 'Global Inventory',
        description: 'Examine fast-counts of stored assets across timeframes.',
        method: 'GET',
        endpoint: '/api/trading/inventory',
        category: 'Ingestion & Health'
    },
    {
        id: 'data_health',
        title: 'Vault Data Health',
        description: 'Retrieve detailed gap analysis scores for all symbols.',
        method: 'GET',
        endpoint: '/api/trading/data-health',
        category: 'Ingestion & Health'
    },
    {
        id: 'provider_traffic',
        title: 'Provider Telemetry',
        description: 'Get internal logs of the last 200 backend API pings made to Schwab/Yahoo.',
        method: 'GET',
        endpoint: '/api/trading/provider-traffic',
        category: 'Ingestion & Health'
    },
    {
        id: 'continuous_ingest',
        title: 'Continuous Ingest Status',
        description: 'Check if the background Data Doctor sweep is running.',
        method: 'GET',
        endpoint: '/api/trading/continuous-ingest',
        category: 'Ingestion & Health'
    },
    {
        id: 'cron_sync',
        title: 'CRON: Trigger Sync',
        description: 'Simulate a cron job hit to sync market data gaps.',
        method: 'GET',
        endpoint: '/api/cron/sync',
        category: 'Ingestion & Health'
    }
]

export default function DevTestsPage() {
    const [searchQuery, setSearchQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<string>('All')
    const [accounts, setAccounts] = useState<Array<{ id: string, label: string }>>([])

    useEffect(() => {
        fetch('/api/schwab/accounts')
            .then(res => res.json())
            .then(data => {
                if (data.success && Array.isArray(data.accounts)) {
                    const mapped = (data.accounts as SchwabAccountSummary[])
                        .filter((account) => account.securitiesAccount?.hashValue)
                        .map((account) => ({
                            id: account.securitiesAccount?.hashValue ?? '',
                            label: `Account ${account.securitiesAccount?.accountId || account.securitiesAccount?.accountNumber || 'Unknown'}`
                        }))
                    setAccounts(mapped)
                }
            })
            .catch(err => console.error('Failed to pre-fetch accounts for Dev Tests', err))
    }, [])

    const filteredTests = useMemo(() => {
        return DIAGNOSTIC_TESTS.filter(test => {
            const matchesSearch = test.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                test.endpoint.toLowerCase().includes(searchQuery.toLowerCase()) ||
                test.description.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesCategory = activeCategory === 'All' || test.category === activeCategory
            return matchesSearch && matchesCategory
        })
    }, [searchQuery, activeCategory])

    return (
        <div className="min-h-screen bg-[#131722] text-white p-6 md:p-10 font-sans">
            <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-10">
                {/* Floating Navigation Sidebar */}
                <div className="lg:w-64 flex-shrink-0">
                    <div className="sticky top-10 space-y-8">
                        {/* Header */}
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/20 rounded-xl">
                                    <FlaskConical className="w-6 h-6 text-blue-400" />
                                </div>
                                <h1 className="text-2xl font-bold tracking-tight text-white">Diagnostics</h1>
                            </div>
                            <p className="text-sm text-gray-400 leading-relaxed">
                                Directly test API payloads isolated from the UI layer.
                            </p>
                        </div>

                        {/* Search Bar */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search queries..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-[#1E222D] border border-[#2A2E39] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>

                        {/* Category Menu */}
                        <nav className="space-y-1">
                            <button
                                onClick={() => setActiveCategory('All')}
                                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === 'All' ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                                    }`}
                            >
                                All Endpoints
                            </button>
                            {CATEGORIES.map(category => (
                                <button
                                    key={category}
                                    onClick={() => setActiveCategory(category)}
                                    className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeCategory === category ? 'bg-blue-500/10 text-blue-400' : 'text-gray-400 hover:bg-[#2A2E39] hover:text-white'
                                        }`}
                                >
                                    {category}
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 space-y-8">
                    {CATEGORIES.filter(c => activeCategory === 'All' || c === activeCategory).map(category => {
                        const testsInCategory = filteredTests.filter(t => t.category === category)
                        if (testsInCategory.length === 0) return null

                        return (
                            <div key={category} className="space-y-4">
                                <div className="border-b border-[#2A2E39] pb-2">
                                    <h2 className="text-xl font-bold text-gray-200">{category}</h2>
                                </div>
                                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                    {testsInCategory.map(test => (
                                        <TestCard key={test.id} test={test} accounts={accounts} />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                    {filteredTests.length === 0 && (
                        <div className="text-center py-20 text-gray-500 border border-dashed border-[#2A2E39] rounded-xl bg-[#1E222D]/30">
                            No endpoints found matching your search.
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

function TestCard({ test, accounts }: { test: DiagnosticTest, accounts: Array<{ id: string, label: string }> }) {
    const [isExpanded, setIsExpanded] = useState(false)
    const [params, setParams] = useState<Array<{ key: string, value: string }>>(
        Object.entries(test.defaultParams || {}).map(([key, value]) => ({ key, value }))
    )
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [duration, setDuration] = useState<number | null>(null)
    const [output, setOutput] = useState<string | null>(null)

    const updateParam = (index: number, field: 'key' | 'value', val: string) => {
        const newParams = [...params]
        newParams[index][field] = val
        setParams(newParams)
    }

    const removeParam = (index: number) => {
        setParams(params.filter((_, i) => i !== index))
    }

    const addParam = () => {
        setParams([...params, { key: '', value: '' }])
    }

    const runTest = async (e: React.MouseEvent) => {
        e.stopPropagation() // Prevent accordion toggle
        setIsExpanded(true) // Auto-expand to show results
        setStatus('loading')
        setOutput(null)
        setDuration(null)

        const startTime = Date.now()

        try {
            // Build parameter dictionary
            const paramDict: Record<string, string> = {}
            params.forEach(p => {
                if (p.key.trim()) paramDict[p.key.trim()] = p.value.trim()
            })

            let url = test.endpoint
            const queryParams = new URLSearchParams()

            Object.entries(paramDict).forEach(([k, v]) => {
                if (v) queryParams.append(k, v)
            })

            if (test.method === 'GET' && queryParams.toString()) {
                url += `?${queryParams.toString()}`
            }

            const res = await fetch(url, {
                method: test.method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: test.method === 'POST' ? JSON.stringify(paramDict) : undefined
            })

            const endTime = Date.now()
            setDuration(endTime - startTime)

            const rawText = await res.text()

            try {
                const jsonObj = JSON.parse(rawText)
                setOutput(JSON.stringify(jsonObj, null, 2))
                setStatus(res.ok ? 'success' : 'error')
            } catch (err) {
                setOutput(rawText)
                setStatus(res.ok ? 'success' : 'error')
            }

        } catch (error) {
            setDuration(Date.now() - startTime)
            setStatus('error')
            setOutput(error instanceof Error ? error.message : 'Network request failed completely.')
        }
    }

    return (
        <div className={`bg-[#1E222D] border border-[#2A2E39] rounded-xl overflow-hidden transition-all duration-300 shadow-lg shadow-black/20 ${isExpanded ? 'col-span-1 xl:col-span-2' : ''}`}>
            {/* Header (Always Visible, Clickable) */}
            <div
                className="p-4 bg-[#1a1e28] cursor-pointer hover:bg-[#252a36] transition-colors flex items-center justify-between group"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 flex-1">
                    <button className="text-gray-500 group-hover:text-white transition-colors">
                        {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                    </button>
                    <div>
                        <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                            {test.title}
                            {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            {status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                        </h3>
                        <p className="text-[13px] text-gray-400 line-clamp-1">{test.description}</p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="hidden sm:block px-2 py-1 bg-[#2A2E39] rounded text-[11px] font-mono text-gray-300">
                        <span className={test.method === 'GET' ? 'text-blue-400' : 'text-purple-400'}>{test.method}</span> {test.endpoint}
                    </div>
                    {duration !== null && !isExpanded && (
                        <span className="text-xs text-gray-500 font-mono hidden sm:inline-block">{duration}ms</span>
                    )}
                    <button
                        onClick={runTest}
                        disabled={status === 'loading'}
                        className={`p-2 rounded-lg transition-all ${status === 'loading'
                            ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                            : 'bg-[#2A2E39] hover:bg-blue-600 text-gray-300 hover:text-white'
                            }`}
                    >
                        <Play className={`w-4 h-4 ${status === 'loading' ? 'animate-pulse' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Expanded Content Area */}
            {isExpanded && (
                <div className="border-t border-[#2A2E39] bg-[#1E222D] animate-in slide-in-from-top-2 duration-200 fade-in">

                    {/* Controls & Parameters */}
                    <div className="p-5 flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="flex items-center justify-between">
                                <h4 className="text-sm font-semibold text-gray-300">API Parameters</h4>
                                <button onClick={addParam} className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors">
                                    <Plus className="w-3 h-3" /> Add Param
                                </button>
                            </div>

                            {params.length === 0 ? (
                                <p className="text-xs text-gray-500 italic">No parameters configured for this request.</p>
                            ) : (
                                <div className="space-y-2">
                                    {params.map((param, idx) => (
                                        <div key={idx} className="flex items-start gap-2 group flex-wrap sm:flex-nowrap">
                                            <input
                                                type="text"
                                                placeholder="Key"
                                                value={param.key}
                                                onChange={(e) => updateParam(idx, 'key', e.target.value)}
                                                className="w-full sm:w-1/3 min-w-[100px] bg-[#131722] border border-[#2A2E39] rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                                            />
                                            <span className="text-gray-500 hidden sm:inline-block mt-2">=</span>

                                            <div className="flex-1 flex flex-col gap-1 w-full relative">
                                                {param.key.length > 5 && (test.method === 'POST' || test.method === 'PUT') ? (
                                                    <textarea
                                                        placeholder="Value (JSON or String)"
                                                        value={param.value}
                                                        onChange={(e) => updateParam(idx, 'value', e.target.value)}
                                                        className="w-full bg-[#131722] border border-[#2A2E39] rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500 min-h-[60px] resize-y"
                                                    />
                                                ) : (
                                                    <input
                                                        type="text"
                                                        placeholder="Value"
                                                        value={param.value}
                                                        onChange={(e) => updateParam(idx, 'value', e.target.value)}
                                                        className="w-full bg-[#131722] border border-[#2A2E39] rounded px-3 py-1.5 text-sm font-mono text-white focus:outline-none focus:border-blue-500"
                                                    />
                                                )}

                                                {param.key === 'accountId' && accounts.length > 0 && (
                                                    <div className="flex gap-2 mt-1">
                                                        <select
                                                            className="bg-[#2A2E39] border border-[#363A45] rounded px-2 py-1 text-xs text-gray-300 focus:outline-none flex-1"
                                                            onChange={(e) => {
                                                                if (e.target.value) updateParam(idx, 'value', e.target.value)
                                                            }}
                                                            value={accounts.find(a => a.id === param.value) ? param.value : ''}
                                                        >
                                                            <option value="" disabled>Auto-inject account hash...</option>
                                                            {accounts.map(acc => (
                                                                <option key={acc.id} value={acc.id}>{acc.label}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => removeParam(idx)}
                                                className="mt-1 sm:mt-0 p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors self-start"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="pt-4 flex items-center gap-4 border-t border-[#2A2E39]">
                                <button
                                    onClick={runTest}
                                    disabled={status === 'loading'}
                                    className={`flex items-center gap-2 px-5 py-2 rounded-lg font-medium text-sm transition-all shadow-sm ${status === 'loading'
                                        ? 'bg-blue-600/50 text-white/50 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20'
                                        }`}
                                >
                                    <Play className={`w-4 h-4 ${status === 'loading' ? 'animate-pulse' : ''}`} />
                                    {status === 'loading' ? 'Executing API...' : 'Run Query'}
                                </button>

                                {duration !== null && (
                                    <span className="text-xs text-gray-500 font-mono">
                                        Server Response Time: {duration}ms
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Output Terminal */}
                    {output && (
                        <div className="relative border-t border-[#2A2E39] bg-[#0E1117] min-h-[250px] max-h-[600px] flex flex-col">
                            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2A2E39] bg-[#1E222D]">
                                <span className="text-xs font-mono text-gray-400 flex items-center gap-2">
                                    <span className={test.method === 'GET' ? 'text-blue-400' : 'text-purple-400'}>{test.method}</span>
                                    {test.endpoint}
                                </span>
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-sm uppercase tracking-wider ${status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                                    }`}>
                                    {status}
                                </span>
                            </div>
                            <div className="flex-1 overflow-auto relative">
                                <pre className="p-4 text-[13px] font-mono text-gray-300 custom-scrollbar absolute inset-0">
                                    <code>{output}</code>
                                </pre>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
