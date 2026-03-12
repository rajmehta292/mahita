'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { ChevronDown, ShieldAlert } from 'lucide-react'
import { AUTH_POST_SIGNIN_PATH, resolveClientCallbackUrl } from '@/lib/auth-redirect'
import { useAuthHealth } from '@/app/hooks/use-auth-health'

export function LandingSignInMenu() {
    const authHealth = useAuthHealth()
    const [open, setOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideClick)
        return () => document.removeEventListener('mousedown', handleOutsideClick)
    }, [])

    const authNeedsAttention = authHealth ? !authHealth.ok : false
    const googleEnabled = authHealth?.googleSignInEnabled ?? false
    const isDevelopmentBypassMode = (authHealth?.devBypassEnabled ?? false) && !googleEnabled
    const publicAppOrigin = authHealth?.publicAppOrigin || 'https://mahita.ai'
    const postSignInUrl = resolveClientCallbackUrl(AUTH_POST_SIGNIN_PATH)

    return (
        <div className="relative" ref={menuRef}>
            <button
                data-landing-auth-trigger
                onClick={() => setOpen((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10"
            >
                <span>Sign in</span>
                <ChevronDown className={`h-4 w-4 transition ${open ? 'rotate-180' : ''}`} />
            </button>

            {open && (
                <div className="absolute right-0 top-[calc(100%+12px)] z-50 w-[320px] rounded-3xl border border-white/12 bg-[#151925]/96 p-4 shadow-2xl shadow-black/50 backdrop-blur-xl">
                    <div className="mb-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/32">Secure Access</p>
                        <h2 className="mt-2 text-lg font-semibold text-white">Continue into Mahita</h2>
                        <p className="mt-1 text-sm text-white/48">
                            Use Google to create or reopen your Mahita workspace. First-time users continue into the setup guide automatically.
                        </p>
                    </div>

                    {authNeedsAttention && (
                        <div className="mb-3 rounded-2xl border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-xs text-amber-100/80">
                            <div className="flex items-start gap-2">
                                <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-300" />
                                <span>Auth health needs attention. Verify the app origin and callback before signing in.</span>
                            </div>
                        </div>
                    )}

                    {authHealth === null ? (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/55">
                            Checking sign-in availability…
                        </div>
                    ) : googleEnabled ? (
                        <button
                            onClick={() => signIn('google', { callbackUrl: postSignInUrl })}
                            className="w-full rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/90"
                        >
                            Sign in with Google
                        </button>
                    ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left">
                            <p className="text-sm font-medium text-white">
                                {isDevelopmentBypassMode ? 'Google sign-in is disabled on localhost' : 'Google sign-in is temporarily unavailable'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/55">
                                Real users should authenticate on <span className="font-mono text-cyan-200">{publicAppOrigin}</span>.
                            </p>
                        </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-xs text-white/45">
                        <Link href="/signup" className="transition hover:text-white">Open setup guide</Link>
                        <Link href="/api/health/auth" className="transition hover:text-white">View auth health</Link>
                    </div>
                </div>
            )}
        </div>
    )
}
