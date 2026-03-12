import Link from "next/link"
import { ArrowRight, CheckCircle2, Settings, ShieldCheck } from "lucide-react"
import { LandingSignInMenu } from "@/app/components/Auth/LandingSignInMenu"
import { SchwabSetupFAQ } from "@/app/components/Auth/SchwabSetupFAQ"
import { getAppServerSession } from "@/lib/server-session"
import { getSchwabCallbackUrl } from "@/lib/schwab-config"

export default async function SignupPage() {
    const session = await getAppServerSession()
    const callbackUrl = getSchwabCallbackUrl()

    if (!session?.user?.id) {
        return (
            <div className="min-h-screen bg-[#0c0f16] text-white">
                <header className="border-b border-white/8 bg-[#0f1320]/88 backdrop-blur-xl">
                    <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Mahita</p>
                            <h1 className="mt-2 text-2xl font-semibold text-white">Create your Mahita workspace</h1>
                        </div>
                        <LandingSignInMenu />
                    </div>
                </header>
                <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                        <SchwabSetupFAQ callbackUrl={callbackUrl} />
                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Get Started</p>
                            <h2 className="mt-2 text-2xl font-semibold text-white">Sign in, then finish setup</h2>
                            <p className="mt-3 text-sm leading-7 text-white/60">
                                New users start with Google sign-in. After that, Mahita will guide you through saving your Schwab developer keys and connecting your real brokerage account.
                            </p>
                            <div className="mt-6">
                                <LandingSignInMenu />
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#0c0f16] text-white">
            <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
                <div className="mb-8 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Onboarding</p>
                        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Finish connecting Mahita</h1>
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
                            Your Google account is already connected to Mahita. The next steps are to add your Schwab developer app keys, then authorize your real Schwab brokerage account through OAuth.
                        </p>
                    </div>
                    <Link
                        href="/dashboard"
                        className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:border-white/24 hover:bg-white/10"
                    >
                        Skip to dashboard
                    </Link>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
                    <div className="space-y-6">
                        <SchwabSetupFAQ callbackUrl={callbackUrl} />

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Next Steps</p>
                            <div className="mt-4 space-y-4">
                                <StepRow
                                    step="1"
                                    title="Save your Schwab developer keys"
                                    body="Open Settings and paste the Client ID and Client Secret from Schwab Developer Portal. Use the callback URL shown there when configuring the app."
                                />
                                <StepRow
                                    step="2"
                                    title="Connect your brokerage account"
                                    body="Go to Dashboard, Portfolio, Active Trader, or History and click Connect Schwab. That opens Schwab OAuth for your actual brokerage login."
                                />
                                <StepRow
                                    step="3"
                                    title="Choose your default account"
                                    body="Once Mahita sees your Schwab accounts, pick the account you want Mahita to remember across dashboard, portfolio, and trading views."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-emerald-400/15 bg-emerald-400/8 p-6">
                            <div className="flex items-center gap-3">
                                <ShieldCheck className="h-5 w-5 text-emerald-300" />
                                <h2 className="text-lg font-semibold text-white">Security model</h2>
                            </div>
                            <ul className="mt-4 space-y-3 text-sm leading-6 text-white/70">
                                <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /><span>Mahita never asks for your Schwab website password in Settings.</span></li>
                                <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /><span>Developer keys identify your Schwab app. Brokerage OAuth happens separately in the popup connect step.</span></li>
                                <li className="flex gap-3"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-300" /><span>Real users always authenticate and reconnect through mahita.ai. Localhost is only used for internal developer-only testing.</span></li>
                            </ul>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Actions</p>
                            <div className="mt-4 flex flex-col gap-3">
                                <Link
                                    href="/settings"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-black transition hover:bg-cyan-300"
                                >
                                    <Settings className="h-4 w-4" />
                                    Open Settings
                                </Link>
                                <Link
                                    href="/dashboard"
                                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-medium text-white transition hover:border-white/24 hover:bg-white/10"
                                >
                                    Continue to Dashboard
                                    <ArrowRight className="h-4 w-4" />
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    )
}

function StepRow({
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
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-400/12 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/18">
                {step}
            </div>
            <div>
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
            </div>
        </div>
    )
}
