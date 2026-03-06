'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { MainLayout } from '../components/Layout/MainLayout'
import { 
    Zap, 
    TrendingUp, 
    TrendingDown, 
    DollarSign, 
    Activity,
    Settings,
    Play,
    Pause,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    Link as LinkIcon,
    Unlink,
    Key
} from 'lucide-react'

interface Position {
    symbol: string
    quantity: number
    averagePrice: number
    currentPrice: number
    marketValue: number
    unrealizedPL: number
    unrealizedPLPercent: number
}

interface AccountBalance {
    cashBalance: number
    equity: number
    buyingPower: number
    dayTradingBuyingPower: number
}

interface LiveStrategy {
    id: string
    name: string
    symbol: string
    status: 'running' | 'stopped' | 'error'
    pnl: number
    trades: number
    winRate: number
}

export default function ActiveTraderPage() {
    const router = useRouter()
    const [hasCredentials, setHasCredentials] = useState(false)
    const [connected, setConnected] = useState(false)
    const [connecting, setConnecting] = useState(false)
    const [checkingConfig, setCheckingConfig] = useState(true)
    const [accountId, setAccountId] = useState<string>('')
    const [positions, setPositions] = useState<Position[]>([])
    const [balance, setBalance] = useState<AccountBalance | null>(null)
    const [liveStrategies, setLiveStrategies] = useState<LiveStrategy[]>([])

    useEffect(() => {
        checkSchwabConfig()
    }, [])

    const checkSchwabConfig = async () => {
        try {
            const response = await fetch('/api/user/schwab-config')
            const data = await response.json()
            
            if (data.success && data.config) {
                setHasCredentials(data.config.hasClientId && data.config.hasClientSecret)
                
                // Check if we have tokens
                if (data.config.hasAccessToken && data.config.hasRefreshToken) {
                    setConnected(true)
                    await fetchAccounts()
                }
            }
        } catch (error) {
            console.error('Failed to check config:', error)
        } finally {
            setCheckingConfig(false)
        }
    }

    // Connect to Schwab
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

                    // Step 4: Exchange code for tokens (tokens are saved server-side)
                    const tokenResponse = await fetch('/api/schwab/auth', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ code }),
                    })

                    const tokenData = await tokenResponse.json()
                    
                    if (tokenData.success) {
                        setConnected(true)
                        await fetchAccounts()
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

    const fetchAccounts = async () => {
        try {
            const response = await fetch('/api/schwab/accounts')
            const data = await response.json()
            
            if (data.success && data.accounts.length > 0) {
                setAccountId(data.accounts[0].securitiesAccount.accountId)
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error)
        }
    }

    const fetchPositions = async () => {
        if (!accountId) return

        try {
            const response = await fetch(`/api/schwab/positions?accountId=${accountId}`)
            const data = await response.json()
            
            if (data.success) {
                setPositions(data.positions)
                setBalance(data.balance)
            }
        } catch (error) {
            console.error('Failed to fetch positions:', error)
        }
    }

    useEffect(() => {
        if (connected && accountId) {
            fetchPositions()
            const interval = setInterval(fetchPositions, 5000) // Refresh every 5 seconds
            return () => clearInterval(interval)
        }
    }, [connected, accountId])

    const totalPL = positions.reduce((sum, pos) => sum + pos.unrealizedPL, 0)

    if (checkingConfig) {
        return (
            <MainLayout>
                <div className="flex-1 flex items-center justify-center bg-[#131722]">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-white text-lg">Loading...</p>
                    </div>
                </div>
            </MainLayout>
        )
    }

    if (!hasCredentials) {
        return (
            <MainLayout>
                <div className="flex-1 flex items-center justify-center bg-[#131722]">
                    <div className="text-center max-w-md">
                        <div className="w-20 h-20 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Key className="w-10 h-10 text-yellow-500" />
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-3">Schwab API Credentials Required</h2>
                        <p className="text-gray-400 mb-6">
                            Please configure your Schwab API credentials in Settings before using Active Trader
                        </p>
                        <button
                            onClick={() => router.push('/settings')}
                            className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto"
                        >
                            <Settings className="w-5 h-5" />
                            Go to Settings
                        </button>
                    </div>
                </div>
            </MainLayout>
        )
    }

    return (
        <MainLayout>
            <div className="flex-1 flex flex-col bg-[#131722] overflow-hidden">
                {/* Header */}
                <div className="h-14 bg-[#1E222D] border-b border-[#2A2E39] flex items-center justify-between px-6">
                    <div className="flex items-center gap-3">
                        <Zap className="w-6 h-6 text-blue-500" />
                        <h1 className="text-white font-semibold text-lg">Active Trader</h1>
                        <span className="text-xs text-gray-400">Live Trading with Schwab API</span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        {connected ? (
                            <>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 rounded-lg border border-green-500/30">
                                    <CheckCircle className="w-4 h-4 text-green-500" />
                                    <span className="text-sm text-green-500">Connected</span>
                                </div>
                                <button
                                    onClick={() => {
                                        setConnected(false)
                                        setAccountId('')
                                        setPositions([])
                                        setBalance(null)
                                    }}
                                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-500 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Unlink className="w-4 h-4" />
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <LinkIcon className="w-4 h-4" />
                                {connecting ? 'Connecting...' : 'Connect Schwab'}
                            </button>
                        )}
                    </div>
                </div>

                {!connected ? (
                    /* Connection Required State */
                    <div className="flex-1 flex items-center justify-center">
                        <div className="text-center max-w-md">
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Zap className="w-10 h-10 text-blue-500" />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-3">Connect Your Schwab Account</h2>
                            <p className="text-gray-400 mb-6">
                                Link your Charles Schwab brokerage account to start live trading with automated strategies
                            </p>
                            <button
                                onClick={handleConnect}
                                disabled={connecting}
                                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors flex items-center gap-2 mx-auto disabled:opacity-50"
                            >
                                <LinkIcon className="w-5 h-5" />
                                {connecting ? 'Connecting...' : 'Connect Schwab Account'}
                            </button>
                            
                            <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                                    <div className="text-left">
                                        <p className="text-sm text-yellow-500 font-medium mb-1">Important</p>
                                        <p className="text-xs text-gray-400">
                                            Live trading involves real money. Make sure you understand the risks and have proper risk management in place.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Connected State */
                    <div className="flex-1 overflow-auto p-6">
                        {/* Account Overview */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Account Value</span>
                                    <DollarSign className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    ${balance?.equity.toLocaleString() || '0'}
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Buying Power</span>
                                    <Activity className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    ${balance?.buyingPower.toLocaleString() || '0'}
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Total P&L</span>
                                    {totalPL >= 0 ? (
                                        <TrendingUp className="w-4 h-4 text-green-500" />
                                    ) : (
                                        <TrendingDown className="w-4 h-4 text-red-500" />
                                    )}
                                </div>
                                <div className={`text-2xl font-bold ${totalPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    ${totalPL.toFixed(2)}
                                </div>
                            </div>

                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Positions</span>
                                    <Activity className="w-4 h-4 text-gray-400" />
                                </div>
                                <div className="text-2xl font-bold text-white">
                                    {positions.length}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Current Positions */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Current Positions</h3>
                                    <button
                                        onClick={fetchPositions}
                                        className="p-2 hover:bg-[#2A2E39] rounded transition-colors"
                                    >
                                        <RefreshCw className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>
                                <div className="p-4">
                                    {positions.length === 0 ? (
                                        <div className="text-center py-8 text-gray-400">
                                            No open positions
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {positions.map((position, index) => (
                                                <div
                                                    key={index}
                                                    className="p-3 bg-[#131722] rounded-lg border border-[#2A2E39]"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-white font-medium">{position.symbol}</span>
                                                        <span className={`text-sm ${position.unrealizedPL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            ${position.unrealizedPL.toFixed(2)} ({position.unrealizedPLPercent.toFixed(2)}%)
                                                        </span>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-gray-400">Qty:</span>
                                                            <span className="text-white ml-1">{position.quantity}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">Avg:</span>
                                                            <span className="text-white ml-1">${position.averagePrice.toFixed(2)}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">Current:</span>
                                                            <span className="text-white ml-1">${position.currentPrice.toFixed(2)}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Live Strategies */}
                            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-lg">
                                <div className="p-4 border-b border-[#2A2E39] flex items-center justify-between">
                                    <h3 className="text-white font-semibold">Live Strategies</h3>
                                    <button className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded transition-colors">
                                        + New Strategy
                                    </button>
                                </div>
                                <div className="p-4">
                                    {liveStrategies.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-gray-400 mb-4">No active strategies</p>
                                            <p className="text-sm text-gray-500">
                                                Deploy your backtested strategies to trade live
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {liveStrategies.map((strategy) => (
                                                <div
                                                    key={strategy.id}
                                                    className="p-3 bg-[#131722] rounded-lg border border-[#2A2E39]"
                                                >
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="text-white font-medium">{strategy.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            {strategy.status === 'running' ? (
                                                                <button className="p-1 hover:bg-[#2A2E39] rounded">
                                                                    <Pause className="w-4 h-4 text-yellow-500" />
                                                                </button>
                                                            ) : (
                                                                <button className="p-1 hover:bg-[#2A2E39] rounded">
                                                                    <Play className="w-4 h-4 text-green-500" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="grid grid-cols-3 gap-2 text-xs">
                                                        <div>
                                                            <span className="text-gray-400">Symbol:</span>
                                                            <span className="text-white ml-1">{strategy.symbol}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">Trades:</span>
                                                            <span className="text-white ml-1">{strategy.trades}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-gray-400">P&L:</span>
                                                            <span className={`ml-1 ${strategy.pnl >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                                ${strategy.pnl.toFixed(2)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </MainLayout>
    )
}
