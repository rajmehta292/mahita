'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { 
    TrendingUp, 
    BarChart3, 
    Activity, 
    Zap, 
    Users, 
    Globe, 
    Shield,
    ChevronRight,
    ArrowRight,
    Menu,
    X
} from 'lucide-react'

export default function HomePage() {
    const { data: session } = useSession()
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

    return (
        <div className="min-h-screen bg-[#0d0e12]">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#131722]/95 backdrop-blur-sm border-b border-[#2A2E39]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo */}
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-8 h-8 text-blue-500" />
                            <span className="text-white font-bold text-xl">Mahita</span>
                        </div>

                        {/* Desktop Navigation */}
                        <nav className="hidden md:flex items-center gap-8">
                            <Link href="/chart" className="text-gray-300 hover:text-white transition-colors">
                                Chart
                            </Link>
                            <Link href="/screener" className="text-gray-300 hover:text-white transition-colors">
                                Screener
                            </Link>
                            <Link href="/backtest" className="text-gray-300 hover:text-white transition-colors">
                                Backtest
                            </Link>
                            <div className="relative group">
                                <button className="text-gray-300 hover:text-white transition-colors flex items-center gap-1">
                                    Products
                                    <ChevronRight className="w-4 h-4 rotate-90" />
                                </button>
                                <div className="absolute top-full left-0 mt-2 w-48 bg-[#1E222D] border border-[#2A2E39] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                                    <Link href="/active-trader" className="block px-4 py-3 text-gray-300 hover:bg-[#2A2E39] hover:text-white transition-colors">
                                        Active Trader
                                    </Link>
                                    <Link href="/orders" className="block px-4 py-3 text-gray-300 hover:bg-[#2A2E39] hover:text-white transition-colors">
                                        Orders
                                    </Link>
                                    <Link href="/history" className="block px-4 py-3 text-gray-300 hover:bg-[#2A2E39] hover:text-white transition-colors">
                                        History
                                    </Link>
                                    <Link href="/watchlist" className="block px-4 py-3 text-gray-300 hover:bg-[#2A2E39] hover:text-white transition-colors">
                                        Watchlist
                                    </Link>
                                </div>
                            </div>
                        </nav>

                        {/* CTA Buttons */}
                        <div className="hidden md:flex items-center gap-4">
                            {session ? (
                                <Link
                                    href="/dashboard"
                                    className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                                >
                                    Go to Terminal
                                </Link>
                            ) : (
                                <>
                                    <button
                                        onClick={() => signIn('google')}
                                        className="text-gray-300 hover:text-white transition-colors"
                                    >
                                        Sign in
                                    </button>
                                    <button
                                        onClick={() => signIn('google')}
                                        className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors"
                                    >
                                        Get started
                                    </button>
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-gray-300 hover:text-white"
                        >
                            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Menu */}
                {mobileMenuOpen && (
                    <div className="md:hidden bg-[#1E222D] border-t border-[#2A2E39]">
                        <div className="px-4 py-4 space-y-3">
                            <Link href="/chart" className="block text-gray-300 hover:text-white py-2">
                                Chart
                            </Link>
                            <Link href="/screener" className="block text-gray-300 hover:text-white py-2">
                                Screener
                            </Link>
                            <Link href="/backtest" className="block text-gray-300 hover:text-white py-2">
                                Backtest
                            </Link>
                            <Link href="/active-trader" className="block text-gray-300 hover:text-white py-2">
                                Active Trader
                            </Link>
                            <Link href="/orders" className="block text-gray-300 hover:text-white py-2">
                                Orders
                            </Link>
                            <div className="pt-4 border-t border-[#2A2E39]">
                                {session ? (
                                    <Link
                                        href="/dashboard"
                                        className="block w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium text-center"
                                    >
                                        Go to Terminal
                                    </Link>
                                ) : (
                                    <button
                                        onClick={() => signIn('google')}
                                        className="block w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
                                    >
                                        Get Started
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </header>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto text-center">
                    <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
                        Where the world
                        <br />
                        <span className="text-blue-500">charts, chats & trades</span>
                    </h1>
                    <p className="text-xl text-gray-400 mb-8 max-w-3xl mx-auto">
                        Professional charting platform with powerful backtesting, real-time data, and algorithmic trading tools
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        {session ? (
                            <Link
                                href="/dashboard"
                                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors flex items-center gap-2"
                            >
                                Open Terminal
                                <ArrowRight className="w-5 h-5" />
                            </Link>
                        ) : (
                            <button
                                onClick={() => signIn('google')}
                                className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
                            >
                                Get Started
                            </button>
                        )}
                        <Link
                            href="/chart"
                            className="px-8 py-4 bg-[#1E222D] hover:bg-[#2A2E39] text-white rounded-lg font-semibold text-lg transition-colors border border-[#2A2E39]"
                        >
                            View Demo
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 px-4 sm:px-6 lg:px-8 border-y border-[#2A2E39]">
                <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-white mb-2">50M+</div>
                        <div className="text-gray-400">Active traders</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-white mb-2">100+</div>
                        <div className="text-gray-400">Exchanges</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-white mb-2">1000+</div>
                        <div className="text-gray-400">Indicators</div>
                    </div>
                    <div className="text-center">
                        <div className="text-3xl md:text-4xl font-bold text-white mb-2">24/7</div>
                        <div className="text-gray-400">Market data</div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
                            Everything you need to trade
                        </h2>
                        <p className="text-xl text-gray-400">
                            Professional tools for serious traders
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center mb-4">
                                <BarChart3 className="w-6 h-6 text-blue-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Advanced Charting</h3>
                            <p className="text-gray-400">
                                Professional charts with 100+ indicators, drawing tools, and multiple timeframes
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Zap className="w-6 h-6 text-green-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Algorithmic Trading</h3>
                            <p className="text-gray-400">
                                Build and backtest strategies with Pine Script. Automate your trading with webhooks
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Activity className="w-6 h-6 text-purple-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Market Screener</h3>
                            <p className="text-gray-400">
                                Filter thousands of stocks by technical and fundamental criteria in real-time
                            </p>
                        </div>

                        {/* Feature 4 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Users className="w-6 h-6 text-yellow-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Social Trading</h3>
                            <p className="text-gray-400">
                                Share ideas, follow top traders, and learn from the community
                            </p>
                        </div>

                        {/* Feature 5 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Globe className="w-6 h-6 text-red-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Global Markets</h3>
                            <p className="text-gray-400">
                                Access stocks, crypto, forex, and commodities from 100+ exchanges worldwide
                            </p>
                        </div>

                        {/* Feature 6 */}
                        <div className="bg-[#1E222D] border border-[#2A2E39] rounded-xl p-8 hover:border-blue-500 transition-colors">
                            <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mb-4">
                                <Shield className="w-6 h-6 text-cyan-500" />
                            </div>
                            <h3 className="text-xl font-semibold text-white mb-3">Paper Trading</h3>
                            <p className="text-gray-400">
                                Practice with virtual money before risking real capital. Perfect for learning
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-transparent to-blue-500/10">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
                        Ready to start trading?
                    </h2>
                    <p className="text-xl text-gray-400 mb-8">
                        Join millions of traders using Mahita Terminal
                    </p>
                    {session ? (
                        <Link
                            href="/dashboard"
                            className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
                        >
                            Open Terminal
                            <ArrowRight className="w-5 h-5" />
                        </Link>
                    ) : (
                        <button
                            onClick={() => signIn('google')}
                            className="px-8 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-lg transition-colors"
                        >
                            Get Started
                        </button>
                    )}
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-[#2A2E39] py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-7xl mx-auto">
                    <div className="grid md:grid-cols-4 gap-8 mb-8">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <TrendingUp className="w-6 h-6 text-blue-500" />
                                <span className="text-white font-bold text-lg">Mahita</span>
                            </div>
                            <p className="text-gray-400 text-sm">
                                Professional trading platform for the modern trader
                            </p>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Products</h4>
                            <ul className="space-y-2">
                                <li><Link href="/chart" className="text-gray-400 hover:text-white text-sm">Chart</Link></li>
                                <li><Link href="/screener" className="text-gray-400 hover:text-white text-sm">Screener</Link></li>
                                <li><Link href="/backtest" className="text-gray-400 hover:text-white text-sm">Backtest</Link></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Company</h4>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">About</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Blog</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Careers</a></li>
                            </ul>
                        </div>
                        <div>
                            <h4 className="text-white font-semibold mb-4">Support</h4>
                            <ul className="space-y-2">
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Help Center</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Contact</a></li>
                                <li><a href="#" className="text-gray-400 hover:text-white text-sm">Status</a></li>
                            </ul>
                        </div>
                    </div>
                    <div className="border-t border-[#2A2E39] pt-8 flex flex-col md:flex-row justify-between items-center">
                        <p className="text-gray-400 text-sm">
                            © 2026 Mahita Terminal. All rights reserved.
                        </p>
                        <div className="flex gap-6 mt-4 md:mt-0">
                            <a href="#" className="text-gray-400 hover:text-white text-sm">Privacy</a>
                            <a href="#" className="text-gray-400 hover:text-white text-sm">Terms</a>
                            <a href="#" className="text-gray-400 hover:text-white text-sm">Cookies</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    )
}
