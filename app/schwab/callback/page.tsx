'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { normalizeUnknownError, parseResponseError } from '@/lib/app-errors'

type CallbackStatus = 'processing' | 'success' | 'error'

interface CallbackState {
    status: CallbackStatus
    message: string
}

const CALLBACK_TIMEOUT_MS = 15000

function postResultToOpener(payload: { success: boolean, error?: string }) {
    if (!window.opener) {
        return
    }

    try {
        window.opener.postMessage(
            {
                type: 'schwab-auth-complete',
                ...payload,
            },
            window.location.origin
        )
    } catch (postMessageError) {
        console.warn('Failed to notify opener about Schwab auth result:', postMessageError)
    }
}

function postProcessingToOpener() {
    if (!window.opener) {
        return
    }

    try {
        window.opener.postMessage(
            {
                type: 'schwab-auth-stage',
                stage: 'processing',
            },
            window.location.origin
        )
    } catch (postMessageError) {
        console.warn('Failed to notify opener that Schwab auth is processing:', postMessageError)
    }
}

function SchwabCallbackContent() {
    const searchParams = useSearchParams()
    const [state, setState] = useState<CallbackState>({
        status: 'processing',
        message: 'Completing Schwab authorization and securing tokens…',
    })
    const [attemptKey, setAttemptKey] = useState(0)

    const callbackResult = useMemo(() => {
        const code = searchParams.get('code')
        const state = searchParams.get('state')
        const error = searchParams.get('error')
        const errorDescription = searchParams.get('error_description')

        return {
            code,
            state,
            error,
            errorDescription,
        }
    }, [searchParams])

    const completeAuthorization = useCallback(async () => {
        let active = true
        const abortController = new AbortController()
        const timeoutId = window.setTimeout(() => {
            abortController.abort(new DOMException('Schwab callback timed out', 'AbortError'))
        }, CALLBACK_TIMEOUT_MS)

        const checkConnectionStatus = async () => {
            const statusResponse = await fetch('/api/schwab/auth?action=status', {
                cache: 'no-store',
            })
            const statusPayload = await statusResponse.json().catch(() => null)

            if (!statusResponse.ok) {
                throw new Error(statusPayload?.error || 'Mahita could not verify the Schwab connection status.')
            }

            return Boolean(statusPayload?.isConnected)
        }

        const markError = (message: string) => {
            if (!active) {
                return
            }

            setState({
                status: 'error',
                message,
            })
            postResultToOpener({ success: false, error: message })
        }

        const markSuccess = (message: string) => {
            if (!active) {
                return
            }

            setState({
                status: 'success',
                message,
            })
            postResultToOpener({ success: true })

            if (window.opener) {
                window.setTimeout(() => {
                    window.close()
                }, 450)
            } else {
                window.setTimeout(() => {
                    window.location.assign('/active-trader?schwab=connected')
                }, 450)
            }
        }

        try {
            postProcessingToOpener()

            if (callbackResult.error) {
                const message =
                    callbackResult.errorDescription ||
                    callbackResult.error ||
                    'Schwab denied the authorization request.'

                markError(message)
                return
            }

            if (!callbackResult.code) {
                const message = 'Mahita did not receive an authorization code from Schwab.'

                markError(message)
                return
            }

            const response = await fetch('/api/schwab/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: callbackResult.code,
                    state: callbackResult.state,
                }),
                signal: abortController.signal,
            })

            const errorResponse = response.clone()
            const payload = await response.json().catch(() => null)
            if (!response.ok || !payload?.success) {
                if (!response.ok) {
                    throw await parseResponseError(errorResponse, 'Failed to complete Schwab authorization.')
                }

                throw new Error(payload?.error || 'Failed to complete Schwab authorization.')
            }

            if (!active) {
                return
            }

            markSuccess('Schwab authorization complete. You can close this window and return to Mahita.')
        } catch (error) {
            const normalized = normalizeUnknownError(error, 'Failed to complete Schwab authorization.')

            const isMissingStateError =
                normalized.code === 'BAD_REQUEST' &&
                normalized.message.toLowerCase().includes('authorization state is missing')

            if (isMissingStateError) {
                try {
                    const isConnected = await checkConnectionStatus()
                    if (isConnected) {
                        if (!active) {
                            return
                        }

                        markSuccess('Schwab authorization already completed. You can close this window and return to Mahita.')
                        return
                    }
                } catch (statusError) {
                    const statusNormalized = normalizeUnknownError(
                        statusError,
                        'Mahita could not verify whether Schwab authorization already completed.'
                    )
                    markError(statusNormalized.message)
                    return
                }

                markError(
                    normalized.hint ||
                    'This Schwab authorization window is no longer active. Return to Mahita and click Connect Schwab Portal again.'
                )
                return
            }

            if (normalized.message.includes('aborted') || normalized.message.includes('timed out')) {
                try {
                    const isConnected = await checkConnectionStatus()
                    if (isConnected) {
                        if (!active) {
                            return
                        }

                        markSuccess('Schwab authorization finished on the server. You can close this window and return to Mahita.')
                        return
                    }
                } catch (statusError) {
                    const statusNormalized = normalizeUnknownError(
                        statusError,
                        'Mahita could not verify whether Schwab authorization completed.'
                    )
                    markError(statusNormalized.message)
                    return
                }

                markError(
                    'Schwab authorization is taking longer than expected. Return to Mahita and retry the connection if it does not appear as connected.'
                )
                return
            }

            markError(normalized.message)
        } finally {
            active = false
            window.clearTimeout(timeoutId)
        }
    }, [callbackResult])

    useEffect(() => {
        let cancelled = false

        if (!cancelled) {
            void completeAuthorization()
        }

        return () => {
            cancelled = true
        }
    }, [attemptKey, completeAuthorization])

    const isProcessing = state.status === 'processing'
    const isSuccess = state.status === 'success'
    const Icon = isProcessing ? Loader2 : isSuccess ? CheckCircle2 : XCircle
    const iconClassName = isProcessing
        ? 'text-blue-400 animate-spin'
        : isSuccess
            ? 'text-emerald-400'
            : 'text-red-400'

    return (
        <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#161b26] px-8 py-10 shadow-2xl shadow-black/40">
            <div className="flex flex-col items-center text-center">
                <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                    <Icon className={`h-8 w-8 ${iconClassName}`} />
                </div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">Schwab OAuth</p>
                <h1 className="mt-3 text-2xl font-semibold text-white">
                    {isProcessing
                        ? 'Completing authorization'
                        : isSuccess
                            ? 'Authorization complete'
                            : 'Authorization failed'}
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/65">{state.message}</p>

                {!isSuccess && (
                    <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-left text-xs text-amber-100/80">
                        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
                        <span>
                            If this window was opened from Mahita, you can keep it open while retrying or close it and return to the app manually.
                        </span>
                    </div>
                )}

                <div className="mt-8 flex gap-3">
                    {state.status === 'error' && callbackResult.code && (
                        <button
                            onClick={() => {
                                setState({
                                    status: 'processing',
                                    message: 'Retrying Schwab authorization completion…',
                                })
                                setAttemptKey((current) => current + 1)
                            }}
                            className="rounded-2xl border border-blue-400/20 bg-blue-400/10 px-4 py-3 text-sm font-medium text-blue-100 transition hover:bg-blue-400/15"
                        >
                            Retry completion
                        </button>
                    )}
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
            </div>
        </div>
    )
}

export default function SchwabCallbackPage() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-[#131722] p-6">
            <Suspense
                fallback={
                    <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-[#161b26] px-8 py-10 shadow-2xl shadow-black/40">
                        <div className="flex flex-col items-center text-center">
                            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
                                <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
                            </div>
                            <h1 className="text-2xl font-semibold text-white">Loading callback</h1>
                            <p className="mt-3 text-sm text-white/65">Preparing the Schwab authorization response…</p>
                        </div>
                    </div>
                }
            >
                <SchwabCallbackContent />
            </Suspense>
        </div>
    )
}
