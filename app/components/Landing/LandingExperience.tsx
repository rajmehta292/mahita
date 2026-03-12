'use client'

import Link from 'next/link'
import { ArrowRight, BarChart3, BrainCircuit, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react'
import { LandingSignInMenu } from '@/app/components/Auth/LandingSignInMenu'

const pillars = [
    {
        title: 'Research with confidence',
        body: 'Backtest, compare runs, and keep strategy context attached to the exact parameter set you trust.',
        icon: BarChart3,
    },
    {
        title: 'Deploy when ready',
        body: 'Move from validated research into execution and monitoring without re-entering the strategy by hand.',
        icon: TrendingUp,
    },
    {
        title: 'Stay inside one system',
        body: 'Portfolio, automation, screening, data acquisition, and AI guidance stay tied to the same account context.',
        icon: BrainCircuit,
    },
]

export function LandingExperience() {
    return (
        <div className="min-h-screen bg-[#0c0f16] text-white">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute left-[-10%] top-[-12%] h-[34rem] w-[34rem] rounded-full bg-cyan-500/10 blur-[140px]" />
                <div className="absolute bottom-[-18%] right-[-8%] h-[30rem] w-[30rem] rounded-full bg-emerald-500/10 blur-[140px]" />
            </div>

            <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0f1320]/88 backdrop-blur-xl">
                <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold tracking-[0.24em] text-white/40">MAHITA</p>
                            <p className="text-xs text-white/35">Strategy intelligence for live traders</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Link href="/docs" className="hidden text-sm text-white/45 transition hover:text-white md:inline">
                            Documentation
                        </Link>
                        <Link href="/api/health/auth" className="hidden text-sm text-white/45 transition hover:text-white md:inline">
                            Auth health
                        </Link>
                        <LandingSignInMenu />
                    </div>
                </div>
            </header>

            <main className="relative">
                <section className="mx-auto flex max-w-7xl flex-col gap-12 px-4 pb-20 pt-20 sm:px-6 lg:flex-row lg:items-end lg:px-8 lg:pt-28">
                    <div className="max-w-3xl flex-1">
                        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-cyan-300/72">Mahita Terminal</p>
                        <h1 className="mt-5 text-5xl font-semibold leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
                            Research, validate, and run strategies without leaving the platform.
                        </h1>
                        <p className="mt-6 max-w-2xl text-lg leading-8 text-white/58">
                            Mahita ties together broker connectivity, strategy research, execution, and monitoring so the same system that explains a setup can eventually run it for the account you choose.
                        </p>

                        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                            <Link
                                href="/signup"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300"
                            >
                                Get started
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link
                                href="/signup"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-6 py-3 text-sm font-medium text-white transition hover:border-white/24 hover:bg-white/10"
                            >
                                Open setup guide
                            </Link>
                            <Link
                                href="/docs"
                                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-6 py-3 text-sm font-medium text-white transition hover:border-white/24 hover:bg-white/10"
                            >
                                Read documentation
                            </Link>
                        </div>
                    </div>

                    <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#141927]/92 p-6 shadow-2xl shadow-black/35 backdrop-blur-xl">
                        <div className="flex items-center justify-between border-b border-white/8 pb-4">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/32">Workflow</p>
                                <h2 className="mt-2 text-xl font-semibold text-white">From idea to execution</h2>
                            </div>
                            <Sparkles className="h-5 w-5 text-cyan-300" />
                        </div>

                        <div className="mt-6 space-y-4">
                            <WorkflowRow step="1" title="Validate the strategy" body="Backtest with explicit assumptions, inspect metrics, and keep the exact parameter set that produced the run." />
                            <WorkflowRow step="2" title="Choose the account" body="Carry your selected account context through portfolio, trader, and automation surfaces without reselecting it everywhere." />
                            <WorkflowRow step="3" title="Monitor the live state" body="See what your strategies are watching, where the market is matching conditions, and when a deployment is eligible to go live." />
                        </div>
                    </div>
                </section>

                <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-3">
                        {pillars.map(({ title, body, icon: Icon }) => (
                            <div key={title} className="rounded-[28px] border border-white/10 bg-[#121726]/90 p-6 shadow-xl shadow-black/20">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/6 text-cyan-300 ring-1 ring-white/8">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <h3 className="mt-5 text-xl font-semibold text-white">{title}</h3>
                                <p className="mt-3 text-sm leading-7 text-white/55">{body}</p>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 flex items-center gap-3 rounded-[28px] border border-emerald-400/12 bg-emerald-400/7 px-5 py-4 text-sm text-emerald-100/82">
                        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                        <span>Signed-in sessions reopen into the most recent working page when the prior sign-in is recent; otherwise Mahita resets to the dashboard for a clean start.</span>
                    </div>
                </section>
            </main>
        </div>
    )
}

function WorkflowRow({
    step,
    title,
    body,
}: {
    step: string
    title: string
    body: string
}) {
    return (
        <div className="flex gap-4 rounded-2xl border border-white/8 bg-black/16 p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/12 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/18">
                {step}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/52">{body}</p>
            </div>
        </div>
    )
}
