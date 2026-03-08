'use client'

import { useState, useEffect, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Zap, Link as LinkIcon, AlertCircle, Key, Settings } from 'lucide-react'

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
    const [loading, setLoading] = useState(true)

    const checkSchwabConfig = async () => {
        try {
            const response = await fetch('/api/user/schwab-config')
            const data = await response.json()

            if (data.success && data.config) {
                setHasCredentials(data.config.hasClientId && data.config.hasClientSecret)
                // Check if we have valid tokens
                const isConnected = !!(data.config.hasAccessToken && data.config.hasRefreshToken)
                setConnected(isConnected)
                onStateChange?.(isConnected)
            }
        } catch (error) {
            console.error('Failed to check config:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        checkSchwabConfig()
    }, [])

    const handleConnect = async () => {
        setConnecting(true)
        try {
            // Step 1: Get authorization URL
            const authResponse = await fetch('/api/schwab/auth?action=authorize')
            const authData = await authResponse.json()

            if (!authResponse.ok) {
                alert(authData.error || 'Failed to get authorization URL')
                setConnecting(false)
                return
            }

            const { authUrl } = authData

            // Step 2: Open authorization window
            const authWindow = window.open(authUrl, 'Schwab Authorization', 'width=600,height=700')

            // Step 3: Listen for callback
            const handleCallback = async (event: MessageEvent) => {
                if (event.data.type === 'schwab-callback') {
                    const code = event.data.code
                    authWindow?.close()

                    // Step 4: Exchange code for tokens
                    const tokenResponse = await fetch('/api/schwab/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code }),
                    })

                    const tokenData = await tokenResponse.json()

                    if (tokenData.success) {
                        setConnected(true)
                        onStateChange?.(true)
                        // Trigger a page refresh to ensure all components refetch data
                        window.location.reload()
                    } else {
                        alert(tokenData.error || 'Failed to authenticate')
                    }

                    window.removeEventListener('message', handleCallback)
                    setConnecting(false)
                }
            }

            window.addEventListener('message', handleCallback)
        } catch (error) {
            console.error('Connection error:', error)
            alert('Failed to connect to Schwab')
            setConnecting(false)
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
                        Please configure your Charles Schwab API credentials in Settings before accessing Terminal features.
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
                    <p className="text-gray-400 mb-8 lowercase font-medium tracking-tight">
                        Link your Schwab brokerage account to unlock real-time market data and automated execution strategies.
                    </p>
                    <button
                        onClick={handleConnect}
                        disabled={connecting}
                        className="w-full py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl transition-all font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50"
                    >
                        <LinkIcon className="w-5 h-5" />
                        {connecting ? 'Establishing Tunnel...' : 'Connect Schwab Portal'}
                    </button>

                    <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                        <div className="flex items-start gap-3 text-left">
                            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                            <p className="text-[10px] text-gray-400 leading-relaxed font-medium uppercase tracking-wider">
                                Secure OAuth2 Handshake. Mahita does not store your account password.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return <>{children}</>
}
