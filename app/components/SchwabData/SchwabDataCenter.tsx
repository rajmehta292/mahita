'use client'

import { useMemo, useState } from 'react'
import { Database, FileCode2, Download, Search, Braces, FileJson, FileSpreadsheet } from 'lucide-react'

const endpointOptions = [
    { value: 'price-history', label: 'Price History', description: 'Historical bars for a single symbol and timeframe.' },
    { value: 'quote', label: 'Quote Snapshot', description: 'Single-symbol real-time quote lookup.' },
    { value: 'quotes', label: 'Batch Quotes', description: 'Fetch multiple quote snapshots in one request.' },
    { value: 'option-chain', label: 'Option Chain', description: 'Retrieve the option chain for an underlying symbol.' },
    { value: 'instrument-search', label: 'Instrument Search', description: 'Search the Schwab instrument universe by symbol or keyword.' },
]

const formatOptions = [
    { value: 'json', label: 'JSON', icon: FileJson },
    { value: 'csv', label: 'CSV', icon: FileSpreadsheet },
    { value: 'parquet', label: 'Parquet', icon: Braces },
]

export function SchwabDataCenter() {
    const [endpoint, setEndpoint] = useState('price-history')
    const [symbol, setSymbol] = useState('AAPL')
    const [range, setRange] = useState('1y')
    const [timeframe, setTimeframe] = useState('1d')
    const [format, setFormat] = useState('json')

    const apiPath = useMemo(() => {
        if (endpoint === 'quote') {
            return `/api/trading/quotes?symbols=${symbol}`
        }

        if (endpoint === 'quotes') {
            return `/api/trading/quotes?symbols=${symbol},MSFT,NVDA`
        }

        if (endpoint === 'option-chain') {
            return `/api/schwab/options?symbol=${symbol}`
        }

        if (endpoint === 'instrument-search') {
            return `/api/schwab/instruments?query=${symbol}`
        }

        return `/api/trading/market-data?symbol=${symbol}&timeframe=${timeframe}&range=${range}`
    }, [endpoint, range, symbol, timeframe])

    const codePreview = useMemo(() => {
        return {
            curl: `curl -X GET "https://mahita.ai${apiPath}"`,
            typescript: `const response = await fetch("${apiPath}");\nconst data = await response.${format === 'json' ? 'json' : 'text'}();`,
            python: `import requests\nresponse = requests.get("https://mahita.ai${apiPath}")\nprint(response.${format === 'json' ? 'json()' : 'text'})`,
        }
    }, [apiPath, format])

    const selectedEndpoint = endpointOptions.find((option) => option.value === endpoint)

    return (
        <div className="flex-1 overflow-auto bg-[#131722]">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
                <section className="rounded-[32px] border border-[#2A2E39] bg-[#1E222D] p-8 shadow-2xl">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="mb-3 flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.3em] text-blue-400">
                                <Database className="h-4 w-4" />
                                Schwab Data Center
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">Download, inspect, and stage Schwab market data</h1>
                            <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                                This is the first product surface for the Schwab Data Center program. Configure the request, inspect the exact API call,
                                and preview the code that Mahita will use as the data-download pipeline is expanded.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-xs font-bold uppercase tracking-widest text-blue-300">
                            Execution surface aligned with the recovery program
                        </div>
                    </div>
                </section>

                <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                    <section className="rounded-[28px] border border-[#2A2E39] bg-[#1E222D] p-6 shadow-xl">
                        <div className="mb-6 flex items-center gap-3 text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                            <Search className="h-4 w-4 text-blue-400" />
                            Request Builder
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Endpoint</span>
                                <select value={endpoint} onChange={(event) => setEndpoint(event.target.value)} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                                    {endpointOptions.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                                <span className="text-xs leading-5 text-gray-500">{selectedEndpoint?.description}</span>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Symbol Search</span>
                                <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none" placeholder="Search a Schwab symbol" />
                                <span className="text-xs leading-5 text-gray-500">Catalog-wide symbol search will land in the next phase. This surface already drives the request/code preview model.</span>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Range</span>
                                <select value={range} onChange={(event) => setRange(event.target.value)} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                                    <option value="1m">1 month</option>
                                    <option value="3m">3 months</option>
                                    <option value="6m">6 months</option>
                                    <option value="1y">1 year</option>
                                    <option value="5y">5 years</option>
                                </select>
                                <span className="text-xs leading-5 text-gray-500">Controls the history window requested from Mahita’s market-data pipeline.</span>
                            </label>

                            <label className="flex flex-col gap-2">
                                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Timeframe</span>
                                <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)} className="rounded-2xl border border-[#2A2E39] bg-[#11141B] px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none">
                                    <option value="1m">1 minute</option>
                                    <option value="5m">5 minutes</option>
                                    <option value="15m">15 minutes</option>
                                    <option value="1h">1 hour</option>
                                    <option value="1d">1 day</option>
                                </select>
                                <span className="text-xs leading-5 text-gray-500">Mahita will eventually normalize canonical intervals locally and derive larger bars when appropriate.</span>
                            </label>
                        </div>

                        <div className="mt-6 rounded-3xl border border-[#2A2E39] bg-[#11141B] p-5">
                            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">Output Format</div>
                            <div className="flex flex-wrap gap-3">
                                {formatOptions.map((option) => {
                                    const Icon = option.icon
                                    const active = format === option.value
                                    return (
                                        <button
                                            key={option.value}
                                            onClick={() => setFormat(option.value)}
                                            className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-xs font-bold uppercase tracking-widest transition-all ${active ? 'border-blue-500 bg-blue-500/10 text-blue-300' : 'border-[#2A2E39] bg-[#0D0F14] text-gray-400 hover:text-white'}`}
                                        >
                                            <Icon className="h-4 w-4" />
                                            {option.label}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    </section>

                    <section className="flex flex-col gap-6">
                        <div className="rounded-[28px] border border-[#2A2E39] bg-[#1E222D] p-6 shadow-xl">
                            <div className="mb-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                                <FileCode2 className="h-4 w-4 text-blue-400" />
                                Live API Preview
                            </div>
                            <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4 font-mono text-xs text-emerald-300">
                                GET {apiPath}
                            </div>
                            <p className="mt-4 text-xs leading-6 text-gray-500">
                                This preview updates live as the request builder changes. The next execution phase will wire job queueing, artifacts, and catalog-backed search.
                            </p>
                        </div>

                        <div className="rounded-[28px] border border-[#2A2E39] bg-[#1E222D] p-6 shadow-xl">
                            <div className="mb-4 flex items-center gap-3 text-xs font-black uppercase tracking-[0.25em] text-gray-400">
                                <Braces className="h-4 w-4 text-blue-400" />
                                Code Examples
                            </div>
                            <div className="space-y-4">
                                <CodeBlock title="cURL" code={codePreview.curl} />
                                <CodeBlock title="TypeScript" code={codePreview.typescript} />
                                <CodeBlock title="Python" code={codePreview.python} />
                            </div>
                        </div>

                        <div className="rounded-[28px] border border-[#2A2E39] bg-gradient-to-br from-blue-600/20 to-indigo-600/20 p-6 shadow-xl">
                            <div className="mb-3 flex items-center gap-3 text-xs font-black uppercase tracking-[0.25em] text-blue-200">
                                <Download className="h-4 w-4" />
                                Pipeline Status
                            </div>
                            <p className="text-sm leading-6 text-blue-50/90">
                                Download artifact queueing, full Schwab symbol catalog sync, and export history are scheduled in the next program phase. This page already establishes the final interaction model and request contract.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

function CodeBlock({ title, code }: { title: string; code: string }) {
    return (
        <div className="rounded-2xl border border-[#2A2E39] bg-[#11141B] p-4">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.2em] text-gray-500">{title}</div>
            <pre className="overflow-x-auto text-xs leading-6 text-gray-200">{code}</pre>
        </div>
    )
}
