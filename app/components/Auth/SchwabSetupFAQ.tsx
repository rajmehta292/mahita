import type { ReactNode } from "react"
import Link from "next/link"
import { ExternalLink, KeyRound, LockKeyhole, UserRoundCheck, Wallet } from "lucide-react"

export function SchwabSetupFAQ({
    callbackUrl,
    compact = false,
}: {
    callbackUrl?: string | null
    compact?: boolean
}) {
    return (
        <div className={`rounded-3xl border border-white/10 bg-white/[0.03] ${compact ? "p-5" : "p-6"}`}>
            <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300 ring-1 ring-cyan-300/20">
                    <LockKeyhole className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Schwab Setup</p>
                    <h2 className="mt-1 text-xl font-semibold text-white">How access works</h2>
                </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
                <InfoCard
                    icon={<UserRoundCheck className="h-4 w-4" />}
                    title="1. Sign in to Mahita"
                    body="Use Google to create or reopen your Mahita workspace. This login only authenticates you to Mahita."
                />
                <InfoCard
                    icon={<KeyRound className="h-4 w-4" />}
                    title="2. Use Schwab Developer Portal"
                    body="Log in at Schwab Developer Portal to create an app and get the Client ID and Client Secret for your Mahita connection."
                />
                <InfoCard
                    icon={<Wallet className="h-4 w-4" />}
                    title="3. Connect your real Schwab account"
                    body="After saving the keys in Settings, click Connect Schwab in Mahita. That opens Schwab OAuth, where you sign in with your actual brokerage account."
                />
                <InfoCard
                    icon={<LockKeyhole className="h-4 w-4" />}
                    title="4. Tokens are separate from keys"
                    body="Client ID and Client Secret identify your developer app. Access and refresh tokens are issued later by Schwab after the brokerage OAuth step."
                />
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <h3 className="text-sm font-semibold text-white">FAQ</h3>
                <div className="mt-3 space-y-3 text-sm leading-6 text-white/70">
                    <p>
                        <span className="font-medium text-white">Which login goes where?</span>{" "}
                        Google signs you into Mahita. Schwab Developer Portal is only for creating the API app. Your real Schwab brokerage login is only used in the OAuth connect step.
                    </p>
                    <p>
                        <span className="font-medium text-white">Which keys do I paste into Mahita?</span>{" "}
                        Paste the Schwab Developer app Client ID and Client Secret into Settings. Do not paste your Schwab website password anywhere in Mahita.
                    </p>
                    <p>
                        <span className="font-medium text-white">What is the redirect URI for Schwab Developer Portal?</span>{" "}
                        Use <span className="font-mono text-cyan-200">{callbackUrl || "your active Mahita callback URL"}</span>.
                    </p>
                    <p>
                        <span className="font-medium text-white">Why is Google different from Schwab?</span>{" "}
                        Google signs you into your Mahita workspace at <span className="font-mono text-cyan-200">mahita.ai</span>. Schwab uses a separate callback so Mahita can exchange your brokerage OAuth code for tokens after you authorize your Schwab account.
                    </p>
                    <p>
                        <span className="font-medium text-white">Why can every user share the same Schwab callback URL?</span>{" "}
                        The callback URL identifies Mahita, not the person. Your signed-in Mahita session and the pending OAuth state tell Mahita which user started the Schwab connect flow, so each user keeps their own credentials and tokens isolated.
                    </p>
                    <p>
                        <span className="font-medium text-white">Can one Mahita user connect multiple Schwab accounts right now?</span>{" "}
                        Not yet. Today each Mahita user supports one active Schwab brokerage connection. Reconnecting that same Mahita user will replace the prior Schwab authorization for that user.
                    </p>
                    <p>
                        <span className="font-medium text-white">Should another user or device ever see localhost?</span>{" "}
                        No. Real users should always return to <span className="font-mono text-cyan-200">mahita.ai</span>. <span className="font-mono text-cyan-200">localhost</span> is only for internal developer machines and should not appear in production setup instructions.
                    </p>
                </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
                <Link
                    href="https://developer.schwab.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-2xl border border-white/12 bg-white/6 px-4 py-2 text-white transition hover:border-white/24 hover:bg-white/10"
                >
                    Open Schwab Developer Portal
                    <ExternalLink className="h-4 w-4" />
                </Link>
                <Link
                    href="/settings"
                    className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-cyan-100 transition hover:bg-cyan-400/15"
                >
                    Open Mahita Settings
                </Link>
            </div>
        </div>
    )
}

function InfoCard({
    icon,
    title,
    body,
}: {
    icon: ReactNode
    title: string
    body: string
}) {
    return (
        <div className="rounded-2xl border border-white/8 bg-black/16 p-4">
            <div className="flex items-center gap-2 text-white">
                <span className="text-cyan-300">{icon}</span>
                <h3 className="text-sm font-semibold">{title}</h3>
            </div>
            <p className="mt-2 text-sm leading-6 text-white/60">{body}</p>
        </div>
    )
}
