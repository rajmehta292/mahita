import Link from "next/link"
import { AlertTriangle, ArrowLeft, ShieldAlert } from "lucide-react"

const ERROR_COPY: Record<string, { title: string; description: string }> = {
    Configuration: {
        title: "Authentication configuration issue",
        description:
            "Mahita could not complete sign-in because the auth provider configuration is invalid for this environment.",
    },
    AccessDenied: {
        title: "Access denied",
        description:
            "Your account is not authorized to complete this sign-in flow.",
    },
    Callback: {
        title: "Callback validation failed",
        description:
            "The authentication callback did not match the active app origin or provider settings.",
    },
    OAuthSignin: {
        title: "Unable to start Google sign-in",
        description:
            "Mahita could not initialize the Google OAuth handshake. Check the auth health endpoint and provider settings.",
    },
    OAuthCallback: {
        title: "Google sign-in callback failed",
        description:
            "Google returned an error during the callback step. Retry sign-in after confirming the configured callback URL.",
    },
    Default: {
        title: "Authentication failed",
        description:
            "Mahita could not complete sign-in. Retry after checking auth health and environment configuration.",
    },
}

interface AuthErrorPageProps {
    searchParams: Promise<{
        error?: string | string[]
    }>
}

export default async function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
    const params = await searchParams
    const errorCode = Array.isArray(params.error) ? params.error[0] : params.error ?? "Default"
    const copy = ERROR_COPY[errorCode] ?? ERROR_COPY.Default

    return (
        <div className="min-h-screen bg-[#0d0e12] text-white flex items-center justify-center p-6">
            <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#171a22]/90 p-8 shadow-2xl shadow-black/40">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3">
                        <ShieldAlert className="h-6 w-6 text-amber-300" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/70">
                            Auth Recovery
                        </p>
                        <h1 className="text-2xl font-semibold tracking-tight">{copy.title}</h1>
                        <p className="text-sm leading-6 text-white/65">{copy.description}</p>
                    </div>
                </div>

                <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                        <AlertTriangle className="h-4 w-4 text-amber-300" />
                        <span>Error code: <span className="font-mono text-white">{errorCode}</span></span>
                    </div>
                    <p className="mt-3 text-sm text-white/55">
                        If this is a local run, confirm that NextAuth is using a localhost origin and not the production domain.
                    </p>
                </div>

                <div className="mt-8 flex flex-wrap gap-3">
                    <Link
                        href="/auth/signin"
                        className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to sign in
                    </Link>
                    <Link
                        href="/api/health/auth"
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/80 transition hover:border-white/30 hover:text-white"
                    >
                        View auth health
                    </Link>
                </div>
            </div>
        </div>
    )
}
