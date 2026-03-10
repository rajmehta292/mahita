'use client'

import { useState, useEffect } from 'react'
import {
    Brain,
    Target,
    Zap,
    AlertTriangle,
    TrendingUp,
    ArrowRight,
    Activity,
    ShieldAlert
} from 'lucide-react'

interface AlphaInsight {
    type: 'RISK' | 'OPPORTUNITY' | 'SECTOR' | 'EDUCATIONAL'
    title: string
    description: string
    confidence: number
    actionable?: string
}

interface PortfolioAssessment {
    score: number
    summary: string
    insights: AlphaInsight[]
}

export function AlphaInsightsWidget({ accountId }: { accountId: string }) {
    const [assessment, setAssessment] = useState<PortfolioAssessment | null>(null)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!accountId) return

        const fetchInsights = async () => {
            setLoading(true)
            try {
                const res = await fetch(`/api/ai/alpha-insights?accountId=${accountId}`)
                const data = await res.json()
                if (data.success) {
                    setAssessment(data)
                    setError(null)
                } else {
                    setError(data.error)
                }
            } catch (e) {
                setError('Failed to reach Alpha Engine')
            } finally {
                setLoading(false)
            }
        }

        fetchInsights()
    }, [accountId])

    if (loading) {
        return (
            <div className="bg-[#1E222D] border border-[#2A2E39] rounded-3xl p-8 animate-pulse">
                <div className="h-4 w-32 bg-[#2A2E39] rounded mb-6"></div>
                <div className="space-y-4">
                    <div className="h-20 bg-[#2A2E39] rounded-2xl"></div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-24 bg-[#2A2E39] rounded-2xl"></div>
                        <div className="h-24 bg-[#2A2E39] rounded-2xl"></div>
                    </div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="bg-rose-500/5 border border-rose-500/20 rounded-3xl p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4 opacity-50" />
                <div className="text-white font-bold mb-2">Alpha Engine Off-line</div>
                <div className="text-[10px] text-rose-500/60 uppercase font-black tracking-widest leading-relaxed">
                    {error}
                </div>
            </div>
        )
    }

    if (!assessment) return null

    return (
        <div className="bg-gradient-to-br from-indigo-600 to-blue-700 border border-white/10 rounded-3xl p-8 shadow-xl shadow-indigo-500/20 group hover:brightness-105 transition-all overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-10 scale-150 rotate-12 group-hover:rotate-0 transition-transform duration-700">
                <Brain className="w-24 h-24 text-white" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">Alpha Recommendation Engine</h3>
                    <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full border border-white/10">
                        <Activity className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-white font-black uppercase tracking-widest">Health: {assessment.score}%</span>
                    </div>
                </div>

                <p className="text-white font-bold text-base mb-8 leading-tight">
                    {assessment.summary}
                </p>

                <div className="space-y-4">
                    {assessment.insights.map((insight, i) => (
                        <div key={i} className="bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl p-4 transition-all">
                            <div className="flex items-center gap-3 mb-2">
                                {insight.type === 'RISK' && <ShieldAlert className="w-4 h-4 text-rose-400" />}
                                {insight.type === 'OPPORTUNITY' && <TrendingUp className="w-4 h-4 text-emerald-400" />}
                                {insight.type === 'SECTOR' && <Zap className="w-4 h-4 text-blue-400" />}
                                {insight.type === 'EDUCATIONAL' && <Target className="w-4 h-4 text-indigo-300" />}
                                <span className="text-[10px] text-white/90 font-black uppercase tracking-widest">{insight.title}</span>
                            </div>
                            <p className="text-[11px] text-white/70 leading-relaxed mb-3">
                                {insight.description}
                            </p>
                            {insight.actionable && (
                                <button className="flex items-center gap-2 text-white font-black text-[9px] uppercase tracking-widest bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all">
                                    {insight.actionable} <ArrowRight className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
