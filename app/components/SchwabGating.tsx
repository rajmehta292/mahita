'use client'

import { useState, useEffect, ReactNode, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Link as LinkIcon, AlertCircle, Key, Settings } from 'lucide-react'
import { normalizeUnknownError } from '@/lib/app-errors'

interface SchwabGatingProps {
    children: ReactNode
    requiredConfig?: boolean // If true, requires client id/secret to be set before showing connect prompt
    onStateChange?: (connected: boolean) => void
}

export function SchwabGating({ children, requiredConfig = true, onStateChange }: SchwabGatingProps) {
    const router = useRouter()
    const [hasCredentials, setHasCredentials] = useState(false)
    const [connected, setConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [connectionPhase, setConnectionPhase] = useState<'idle' | 'opening' | 'finalizing'>('idle')
    const [loading, setLoading] = useState(true)
    const [connectError, setConnectError] = useState<string | null>(null)

    const checkSchwabConfig = useCallback(async () => {
        try {
            const response = await fetch('/api/user/schwab-config')
            const data = await response.json()

            if (data.success && data.config) {
                setHasCredentials(data.config.hasClientId && data.config.hasClientSecret)
                // Check if we have valid tokens
                const isConnected = !!(data.config.hasAccessToken && data.config.hasRefreshToken)
                setConnected(isConnected)
                if (isConnected) {
                    setConnectError(null)
                }
                onStateChange?.(isConnected)
            }
        } catch (error) {
            console.warn('Failed to check config:', error)
        } finally {
            setLoading(false)
        }
    }, [onStateChange])

    useEffect(() => {
        checkSchwabConfig()
    }, [checkSchwabConfig])

    const handleConnect = async () => {
        setConnecting(true)
        setConnectionPhase('opening')
        setConnectError(null)
        try {
            // Step 1: Get authorization URL
            const authResponse = await fetch('/api/schwab/auth?action=authorize')
            const authData = await authResponse.json()

            if (!authResponse.ok) {
                setConnectError(authData.error || 'Failed to get authorization URL')
                setConnecting(false)
                setConnectionPhase('idle')
                return
            }

            const { authUrl } = authData

            // Step 2: Open authorization window
            const connectWindowUrl = `/schwab/connect?authUrl=${encodeURIComponent(authUrl)}`
            const authWindow = window.open(connectWindowUrl, 'Schwab Authorization', 'width=600,height=700')
            if (!authWindow) {
                setConnectError('Mahita could not open the Schwab authorization window. Check your popup blocker and retry.')
                setConnecting(false)
                setConnectionPhase('idle')
                return
            }

            let finalized = false
            let finalizeDeadline: number | null = null
            let pollTimer = 0
            let lastStatusError: string | null = null

            const cleanup = () => {
                window.removeEventListener('message', handleCallback)
                if (pollTimer) {
                    window.clearTimeout(pollTimer)
                }
                setConnecting(false)
                setConnectionPhase('idle')
            }

            const finishWithSuccess = async () => {
                if (finalized) {
                    return
                }
                finalized = true
                setConnectionPhase('finalizing')
                await checkSchwabConfig()
                router.refresh()
                cleanup()
            }

            const finishWithError = (message: string) => {
                if (finalized) {
                    return
                }
                finalized = true
                setConnectError(message)
                cleanup()
            }

            // Step 3: Listen for callback
            const handleCallback = async (event: MessageEvent) => {
                if (event.origin !== window.location.origin) {
                    return
                }

                if (event.data?.type === 'schwab-auth-stage') {
                    if (event.data.stage === 'redirecting') {
                        setConnectionPhase('opening')
                        setConnectError(null)
                    }

                    if (event.data.stage === 'processing') {
                        setConnectionPhase('finalizing')
                        setConnectError(null)
                    }

                    if (event.data.stage === 'error') {
                        finishWithError(event.data.error || 'Mahita could not continue the Schwab authorization flow.')
                    }

                    return
                }

                if (event.data?.type !== 'schwab-auth-complete') {
                    return
                }

                authWindow.close()

                if (event.data.success) {
                    setConnectionPhase('finalizing')
                    await finishWithSuccess()
                    return
                }

                finishWithError(event.data.error || 'Failed to authenticate with Schwab.')
            }

            window.addEventListener('message', handleCallback)

            const runStatusCheck = async () => {
                if (finalized) {
                    return
                }

                try {
                    const statusResponse = await fetch('/api/schwab/auth?action=status')
                    const statusData = await statusResponse.json()

                    if (statusResponse.ok && statusData?.isConnected) {
                        await finishWithSuccess()
                        return
                    }

                    if (!statusResponse.ok) {
                        lastStatusError = statusData?.error || 'Mahita could not verify the Schwab connection status.'
                        if (!authWindow.closed) {
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        if (!finalizeDeadline) {
                            finalizeDeadline = Date.now() + 60_000
                            setConnectionPhase('finalizing')
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        if (Date.now() < finalizeDeadline) {
                            setConnectionPhase('finalizing')
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        finishWithError(lastStatusError || 'Mahita could not verify the Schwab connection status.')
                        return
                    }

                    if (authWindow.closed) {
                        if (!finalizeDeadline) {
                            finalizeDeadline = Date.now() + 60_000
                            setConnectionPhase('finalizing')
                            setConnectError(null)
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        if (statusData?.isPendingAuthorization && Date.now() < finalizeDeadline) {
                            setConnectionPhase('finalizing')
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        if (Date.now() < finalizeDeadline) {
                            setConnectionPhase('finalizing')
                            pollTimer = window.setTimeout(runStatusCheck, 1000)
                            return
                        }

                        finishWithError(lastStatusError || 'Schwab authorization window closed before Mahita received a confirmed connection. Please retry.')
                        return
                    }

                    pollTimer = window.setTimeout(runStatusCheck, 1000)
                } catch (statusError) {
                    const normalized = normalizeUnknownError(statusError, 'Mahita could not verify the Schwab connection after the authorization window closed.')
                    lastStatusError = normalized.message
                    if (!authWindow.closed) {
                        pollTimer = window.setTimeout(runStatusCheck, 1000)
                        return
                    }

                    if (!finalizeDeadline) {
                        finalizeDeadline = Date.now() + 60_000
                        setConnectionPhase('finalizing')
                        pollTimer = window.setTimeout(runStatusCheck, 1000)
                        return
                    }

                    if (Date.now() < finalizeDeadline) {
                        pollTimer = window.setTimeout(runStatusCheck, 1000)
                        return
                    }

                    finishWithError(normalized.message)
                }
            }

            pollTimer = window.setTimeout(runStatusCheck, 1000)
        } catch (error) {
            console.warn('Connection error:', error)
            const normalized = normalizeUnknownError(error, 'Failed to connect to Schwab.')
            setConnectError(normalized.message)
            setConnecting(false)
            setConnectionPhase('idle')
        }
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#131722] min-h-[400px]">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-mono text-xs uppercase tracking-widest">Verifying Connection Status...</p>
                </div>
            </div>
        )
    }

    if (!hasCredentials && requiredConfig) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#131722] min-h-[400px]">
                <div className="text-center max-w-md p-8 bg-[#1E222D] rounded-3xl border border-[#2A2E39] shadow-2xl">
                    <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-yellow-500/20">
                        <Key className="w-10 h-10 text-yellow-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">API Credentials Required</h2>
                    <p className="text-gray-400 mb-8 text-sm">
                        Save your Schwab Developer Portal Client ID and Client Secret in Settings first. After that, Mahita will guide you through the separate brokerage OAuth connect step.
                    </p>
                    <button
                        onClick={() => router.push('/settings')}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98]"
                    >
                        <Settings className="w-5 h-5" />
                        Go to Settings
                    </button>
                </div>
            </div>
        )
    }

    if (!connected) {
        return (
            <div className="flex-1 flex items-center justify-center bg-[#131722] min-h-[400px] p-6">
                <div className="text-center max-w-md bg-[#1E222D] p-10 rounded-3xl border border-[#2A2E39] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
                    <div className="w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-blue-500/20">
                        <Zap className="w-10 h-10 text-blue-500" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-3">Connect Schwab Account</h2>
                    <p className="text-gray-400 mb-8 text-sm leading-7">
                        Your developer keys are saved. This next step opens Schwab OAuth, where you sign in with your actual Schwab brokerage account to authorize Mahita.
                    </p>
                    {connectError && (
                        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-left text-sm text-red-200">
                            {connectError}
                        </div>
                    )}
                    {connecting && connectionPhase === 'finalizing' && !connectError && (
                        <div className="mb-6 rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-left text-sm text-blue-100">
                            Finishing Schwab authorization in the background. Mahita will confirm the connection and close the popup automatically.
                        </div>
                    )}
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                        <LinkIcon className="w-5 h-5" />
                        {connecting
                            ? connectionPhase === 'finalizing'
                                ? 'Finishing Authorization...'
                                : 'Waiting for Schwab Authorization...'
                            : 'Connect Schwab Portal'}
                    </button>

                    <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                        <div className="flex items-start gap-3 text-left">
                            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium uppercase tracking-wider">
                                Secure OAuth2 handshake. Mahita never asks for or stores your Schwab website password.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
