'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArrowRight, Loader2, TriangleAlert } from 'lucide-react'
import { normalizeUnknownError } from '@/lib/app-errors'

function postStage(stage: 'redirecting' | 'processing' | 'error', error?: string) {
    if (!window.opener) {
        return
    }

    try {
        window.opener.postMessage(
            {
                type: 'schwab-auth-stage',
                stage,
                error,
            },
            window.location.origin
        )
    } catch (postMessageError) {
        console.warn('Failed to post Schwab connect stage to opener:', postMessageError)
    }
}

function SchwabConnectContent() {
    const searchParams = useSearchParams()
    const [message, setMessage] = useState('Preparing your secure Schwab authorization window…')
    const [error, setError] = useState<string | null>(null)

    const authUrl = useMemo(() => searchParams.get('authUrl'), [searchParams])

    useEffect(() => {
        if (!authUrl) {
            const nextError = 'Mahita could not prepare the Schwab authorization URL. Return to the app and retry.'
            setError(nextError)
            setMessage(nextError)
            postStage('error', nextError)
            return
        }

        postStage('redirecting')
        const timer = window.setTimeout(() => {
            try {
                window.location.assign(authUrl)
            } catch (redirectError) {
                const normalized = normalizeUnknownError(
                    redirectError,
                    'Mahita could not open the Schwab authorization page.'
                )
                setError(normalized.message)
                setMessage(normalized.message)
                postStage('error', normalized.message)
            }
        }, 180)

        return () => {
            window.clearTimeout(timer)
        }
    }, [authUrl])

    return (
        <div className="min-h-screen bg-[#131722] text-white">
            <div className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-6 py-16">
                <div className="w-full rounded-3xl border border-white/10 bg-[#1E222D] px-8 py-10 shadow-2xl shadow-black/40">
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-blue-500/20 bg-blue-500/10">
                            {error ? (
                                <TriangleAlert className="h-10 w-10 text-red-300" />
                            ) : (
                                <Loader2 className="h-10 w-10 animate-spin text-blue-400" />
                            )}
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Schwab OAuth</p>
                        <h1 className="mt-3 text-3xl font-semibold text-white">
                            {error ? 'Unable to continue' : 'Redirecting to Schwab'}
                        </h1>
                        <p className="mt-4 max-w-lg text-sm leading-7 text-white/65">{message}</p>

                        {!error && (
                            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm text-blue-100/90">
                                <ArrowRight className="h-4 w-4" />
                                You’ll see Mahita’s completion screen again as soon as Schwab finishes.
                            </div>
                        )}

                        {error && (
                            <div className="mt-8 flex gap-3">
                                <button
                                    onClick={() => window.close()}
                                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                                >
                                    Close window
                                </button>
                                <a
                                    href="/active-trader"
                                    className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400"
                                >
                                    Return to Active Trader
                                </a>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default function SchwabConnectPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-[#131722] text-white" />
            }
        >
            <SchwabConnectContent />
        </Suspense>
    )
}
