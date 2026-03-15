'use client'

import { useEffect, useState } from 'react'
import { Building2, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { MainLayout } from '@/app/components/Layout/MainLayout'

interface AccountSummary {
    accountId: string
    accountKey: string
    displayName: string
    accountValue: number
    cashAndCashInvestments: number
    holdingsMarketValue: number
    totalUnrealizedGainLoss: number
    dayChange: number
    dayChangePercent: number
    positionsCount: number
    lastSyncedAt?: string | null
}

function formatCurrency(value: number) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 2,
    }).format(value)
}

export default function AccountsPage() {
    const [accounts, setAccounts] = useState<AccountSummary[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    async function loadAccounts() {
        setLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/schwab/account-summaries', { cache: 'no-store' })
            const json = await response.json()
            if (!response.ok) {
                throw new Error(json.error || 'Failed to load account summaries.')
            }
            setAccounts((json.accounts ?? []) as AccountSummary[])
        } catch (nextError) {
            setAccounts([])
            setError(nextError instanceof Error ? nextError.message : 'Failed to load account summaries.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadAccounts()
    }, [])

    return (
        <MainLayout showBottomPanel={false}>
            <div className="min-h-[calc(100vh-3rem)] bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.14),_transparent_30%),linear-gradient(180deg,_#161922_0%,_#0f1218_100%)] px-6 py-6 text-white">
                <div className="mx-auto max-w-7xl">
                    <div className="flex flex-col gap-4 rounded-[32px] border border-white/10 bg-[#0b0f16]/88 p-6 shadow-[0_30px_80px_rgba(0,0,0,0.45)] md:flex-row md:items-center md:justify-between">
                        <div>
                            <div className="text-[11px] font-black uppercase tracking-[0.24em] text-blue-300/80">Accounts</div>
                            <h1 className="mt-3 text-3xl font-black tracking-tight text-white">Brokerage account center</h1>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                                This view keeps a clean account-first surface for balances, cash, holdings, and sync state while SuperChart and Active Trader stay focused on charting and execution.
                            </p>
                        </div>
                        <button
                            onClick={() => void loadAccounts()}
                            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/[0.08]"
                        >
                            <RefreshCw className="h-4 w-4" />
                            Refresh Accounts
                        </button>
                    </div>

                    {loading ? (
                        <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-[32px] border border-white/10 bg-[#0b0f16]/88">
                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                <Loader2 className="h-7 w-7 animate-spin text-blue-300" />
                                <span className="text-sm font-medium">Loading account summaries…</span>
                            </div>
                        </div>
                    ) : error ? (
                        <div className="mt-6 rounded-[32px] border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-100">
                            {error}
                        </div>
                    ) : accounts.length === 0 ? (
                        <div className="mt-6 rounded-[32px] border border-dashed border-white/10 bg-[#0b0f16]/88 p-10 text-center">
                            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-slate-500">
                                <Wallet className="h-6 w-6" />
                            </div>
                            <div className="mt-4 text-lg font-bold text-white">No linked brokerage accounts</div>
                            <div className="mt-2 text-sm text-slate-400">Connect Schwab from the existing auth flow to populate this page.</div>
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 lg:grid-cols-2">
                            {accounts.map((account) => (
                                <div key={account.accountKey} className="rounded-[28px] border border-white/10 bg-[#0b0f16]/88 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <div className="text-xl font-black tracking-tight text-white">{account.displayName || account.accountId}</div>
                                            <div className="mt-1 text-sm text-slate-400">{account.accountId}</div>
                                        </div>
                                        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-slate-300">
                                            <Building2 className="h-5 w-5" />
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                                        <AccountMetric label="Account value" value={formatCurrency(account.accountValue)} tone="neutral" />
                                        <AccountMetric label="Cash" value={formatCurrency(account.cashAndCashInvestments)} tone="neutral" />
                                        <AccountMetric label="Holdings" value={formatCurrency(account.holdingsMarketValue)} tone="neutral" />
                                        <AccountMetric label="Positions" value={String(account.positionsCount)} tone="neutral" />
                                        <AccountMetric label="Unrealized" value={formatCurrency(account.totalUnrealizedGainLoss)} tone={account.totalUnrealizedGainLoss >= 0 ? 'positive' : 'negative'} />
                                        <AccountMetric label="Day change" value={`${formatCurrency(account.dayChange)} • ${account.dayChangePercent.toFixed(2)}%`} tone={account.dayChange >= 0 ? 'positive' : 'negative'} />
                                    </div>

                                    <div className="mt-5 border-t border-white/10 pt-4 text-xs text-slate-500">
                                        Last synced: {account.lastSyncedAt ? new Date(account.lastSyncedAt).toLocaleString() : 'Pending sync'}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </MainLayout>
    )
}

function AccountMetric({ label, value, tone }: { label: string, value: string, tone: 'neutral' | 'positive' | 'negative' }) {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{label}</div>
            <div className={`mt-2 text-base font-bold ${tone === 'positive' ? 'text-emerald-300' : tone === 'negative' ? 'text-rose-300' : 'text-white'}`}>{value}</div>
        </div>
    )
}
