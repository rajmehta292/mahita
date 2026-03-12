'use client'

import { useCallback, useEffect, useState } from 'react'
import { MainLayout } from '../components/Layout/MainLayout'
import { parseResponseError } from '@/lib/app-errors'
import {
    Settings as SettingsIcon,
    Key,
    Save,
    Trash2,
    Eye,
    EyeOff,
    CheckCircle,
    AlertCircle,
    ExternalLink,
    Activity
} from 'lucide-react'
import { SchwabSetupFAQ } from '@/app/components/Auth/SchwabSetupFAQ'

export default function SettingsPage() {
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [showClientSecret, setShowClientSecret] = useState(false)
    const [hasConfig, setHasConfig] = useState(false)
    const [callbackUrl, setCallbackUrl] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)
    const [runtimeHint, setRuntimeHint] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info', text: string } | null>(null)

    const maybeSetRuntimeHint = (error: unknown) => {
        const errorWithHint = error as { hint?: unknown }
        if (typeof errorWithHint.hint === 'string' && errorWithHint.hint.trim()) {
            setRuntimeHint(errorWithHint.hint)
        }
    }

    const fetchConfig = useCallback(async () => {
        try {
            const response = await fetch('/api/user/schwab-config')
            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not load your Schwab credentials.')
            }
            const data = await response.json()
            setCallbackUrl(data.callbackUrl || null)

            if (data.success && data.config) {
                setHasConfig(data.config.hasClientId && data.config.hasClientSecret)
            }
        } catch (error) {
            console.warn('Failed to fetch config:', error)
            const normalized = error instanceof Error ? error : new Error('Failed to fetch config')
            setMessage({ type: 'error', text: normalized.message })
            maybeSetRuntimeHint(error)
        }
    }, [])

    useEffect(() => {
        void fetchConfig()
    }, [fetchConfig])

    const handleSave = async () => {
        if (!clientId.trim() || !clientSecret.trim()) {
            setMessage({ type: 'error', text: 'Please enter both Client ID and Client Secret' })
            return
        }

        setSaving(true)
        setMessage(null)
        setRuntimeHint(null)

        try {
            const response = await fetch('/api/user/schwab-config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, clientSecret })
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not save your Schwab credentials.')
            }

            const data = await response.json()
            setCallbackUrl(data.callbackUrl || callbackUrl)

            if (data.success) {
                setMessage({ type: 'success', text: 'Schwab credentials saved successfully!' })
                setHasConfig(true)
                setClientId('')
                setClientSecret('')
                setTimeout(() => setMessage(null), 5000)
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to save credentials' })
            }
        } catch (error) {
            console.warn('Save error:', error)
            if (error instanceof Error) {
                setMessage({ type: 'error', text: error.message })
                maybeSetRuntimeHint(error)
                return
            }
            setMessage({ type: 'error', text: 'Failed to save credentials.' })
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete your Schwab credentials? This will disconnect your account.')) {
            return
        }

        setSaving(true)
        setMessage(null)
        setRuntimeHint(null)

        try {
            const response = await fetch('/api/user/schwab-config', {
                method: 'DELETE'
            })

            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not delete your Schwab credentials.')
            }

            const data = await response.json()

            if (data.success) {
                setMessage({ type: 'success', text: 'Schwab credentials deleted successfully' })
                setHasConfig(false)
                setTimeout(() => setMessage(null), 5000)
            } else {
                setMessage({ type: 'error', text: data.error || 'Failed to delete credentials' })
            }
        } catch (error) {
            if (error instanceof Error) {
                setMessage({ type: 'error', text: error.message })
                maybeSetRuntimeHint(error)
            } else {
                setMessage({ type: 'error', text: 'Failed to delete credentials' })
            }
        } finally {
            setSaving(false)
        }
    }

    const handleTestConnection = async () => {
        setTesting(true)
        setMessage({ type: 'info', text: 'Testing connection to Schwab...' })
        setRuntimeHint(null)

        try {
            const response = await fetch('/api/schwab/accounts')
            if (!response.ok) {
                throw await parseResponseError(response, 'Mahita could not test the Schwab connection.')
            }
            const data = await response.json()

            if (data.success) {
                setMessage({ type: 'success', text: `Connection successful! Found ${data.accounts?.length || 0} accounts.` })
            } else {
                const errorDetail = data.details ? `: ${JSON.stringify(data.details)}` : ''
                setMessage({ type: 'error', text: `Connection failed: ${data.error || 'Unknown error'}${errorDetail}. Please check your keys and re-authenticate.` })
            }
        } catch (error) {
            if (error instanceof Error) {
                setMessage({ type: 'error', text: error.message })
                maybeSetRuntimeHint(error)
            } else {
                setMessage({ type: 'error', text: 'Connection failed.' })
            }
        } finally {
            setTesting(false)
            setTimeout(() => {
                if (message?.type !== 'error') setMessage(null)
            }, 6000)
        }
    }

    return (
        <MainLayout>
            <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <SettingsIcon className="w-6 h-6 text-blue-500" />
                        <h1 className="text-white font-semibold text-lg">Settings</h1>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-3xl mx-auto">
                        {/* Schwab API Configuration */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg overflow-hidden">
                            <div className="p-6 border-b border-[#2A2E39]">
                                <div className="flex items-center gap-3 mb-2">
                                    <Key className="w-5 h-5 text-blue-500" />
                                    <h2 className="text-white font-semibold text-lg">Schwab API Credentials</h2>
                                </div>
                                <p className="text-gray-400 text-sm">
                                    Configure your Charles Schwab API credentials to enable live trading
                                </p>
                            </div>

                            <div className="p-6">
                                {/* Status */}
                                {hasConfig && (
                                    <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-start gap-3">
                                        <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-green-500 font-medium">Credentials Configured</p>
                                            <p className="text-sm text-gray-400 mt-1">
                                                Your Schwab API credentials are saved. You can now connect your account in Active Trader.
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Instructions */}
                                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-blue-500 font-medium mb-2">How to get your API credentials:</p>
                                            <ol className="text-sm text-gray-400 space-y-1 list-decimal list-inside">
                                                <li>Visit the <a href="https://beta-developer.schwab.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline inline-flex items-center gap-1">Schwab Developer Portal <ExternalLink className="w-3 h-3" /></a></li>
                                                <li>Create an application and request API access</li>
                                                <li>Once approved, copy your Client ID and Client Secret</li>
                                                <li>Use <span className="font-mono text-blue-300">{callbackUrl || 'https://mahita.ai/schwab/callback'}</span> as the redirect URI in the Schwab Developer Portal</li>
                                                <li>Paste the keys below and click Save</li>
                                            </ol>
                                            <p className="mt-3 text-xs leading-5 text-blue-100/70">
                                                Google sign-in is only for your Mahita workspace. Schwab Developer keys identify your app, and your real Schwab brokerage login happens later in the Connect Schwab OAuth step.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Form */}
                                <div className="space-y-4">
                                    {/* Client ID */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Client ID
                                        </label>
                                        <input
                                            type="text"
                                            value={clientId}
                                            onChange={(e) => setClientId(e.target.value)}
                                            placeholder={hasConfig ? "Enter new Client ID to update" : "Enter your Schwab Client ID"}
                                            className="w-full px-4 py-3 bg-[#131722] border border-[#2A2E39] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                                        />
                                    </div>

                                    {/* Client Secret */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                            Client Secret
                                        </label>
                                        <div className="relative">
                                            <input
                                                type={showClientSecret ? "text" : "password"}
                                                value={clientSecret}
                                                onChange={(e) => setClientSecret(e.target.value)}
                                                placeholder={hasConfig ? "Enter new Client Secret to update" : "Enter your Schwab Client Secret"}
                                                className="w-full px-4 py-3 bg-[#131722] border border-[#2A2E39] rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors pr-12"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowClientSecret(!showClientSecret)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 hover:bg-[#2A2E39] rounded transition-colors"
                                            >
                                                {showClientSecret ? (
                                                    <EyeOff className="w-4 h-4 text-gray-400" />
                                                ) : (
                                                    <Eye className="w-4 h-4 text-gray-400" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    {message && (
                                        <div className={`p-4 rounded-lg flex items-start gap-3 ${message.type === 'success'
                                            ? 'bg-green-500/10 border border-green-500/30'
                                            : message.type === 'info'
                                                ? 'bg-blue-500/10 border border-blue-500/30'
                                                : 'bg-red-500/10 border border-red-500/30'
                                            }`}>
                                            {message.type === 'success' ? (
                                                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                                            ) : message.type === 'info' ? (
                                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin flex-shrink-0 mt-0.5" />
                                            ) : (
                                                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            )}
                                            <p className={`text-sm ${message.type === 'success' ? 'text-green-500' : message.type === 'info' ? 'text-blue-500' : 'text-red-500'
                                                }`}>
                                    {message.text}
                                            </p>
                                        </div>
                                    )}

                                    {runtimeHint && (
                                        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                                            {runtimeHint}
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex flex-wrap items-center gap-3 pt-2">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving || (!clientId.trim() && !clientSecret.trim())}
                                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-4 h-4" />
                                            {saving ? 'Saving...' : hasConfig ? 'Update Credentials' : 'Save Credentials'}
                                        </button>

                                        {hasConfig && (
                                            <>
                                                <button
                                                    onClick={handleTestConnection}
                                                    disabled={testing || saving}
                                                    className="px-6 py-3 bg-[#2A2E39] hover:bg-[#323644] text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed border border-[#3A3E49]"
                                                >
                                                    <Activity className="w-4 h-4 text-blue-400" />
                                                    {testing ? 'Testing...' : 'Test Connection'}
                                                </button>

                                                <button
                                                    onClick={handleDelete}
                                                    disabled={saving || testing}
                                                    className="px-6 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Security Note */}
                                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                    <div className="flex items-start gap-3">
                                        <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <p className="text-yellow-500 font-medium mb-1">Security Notice</p>
                                            <p className="text-sm text-gray-400">
                                                Your credentials are stored securely in our database. We never share your API keys with third parties.
                                                You can delete them at any time.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6">
                            <SchwabSetupFAQ callbackUrl={callbackUrl} compact />
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    )
}
