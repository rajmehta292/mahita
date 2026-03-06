'use client'

import { signIn } from "next-auth/react"
import { Globe, ShieldCheck, Zap } from "lucide-react"

export default function SignIn() {
    return (
        <div className="min-h-screen bg-[#0d0e12] flex items-center justify-center p-6 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
            </div>

            <div className="w-full max-w-md animate-in fade-in zoom-in duration-700">
                <div className="glass-panel p-8 md:p-12 flex flex-col items-center text-center relative z-10">
                    <div className="mb-8">
                        <img src="/vectorized.svg" alt="Mahita" className="w-16 h-16 invert opacity-90 mx-auto mb-4" />
                        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">MAHITA <span className="text-accent">TERMINAL</span></h1>
                        <p className="text-white/40 text-sm">Institutional Grade Strategy Intelligence</p>
                    </div>

                    <div className="space-y-6 w-full">
                        <button
                            onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                            className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center space-x-3 hover:bg-white/90 transition-all active:scale-[0.98]"
                        >
                            <svg className="w-5 h-5" viewBox="0 0 24 24">
                                <path
                                    fill="currentColor"
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                                />
                                <path
                                    fill="currentColor"
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                />
                            </svg>
                            <span>Sign in with Google</span>
                        </button>

                        <div className="grid grid-cols-3 gap-4 pt-6">
                            <FeatureIcon icon={<Globe className="w-4 h-4" />} label="Global Data" />
                            <FeatureIcon icon={<Zap className="w-4 h-4" />} label="Backtesting" />
                            <FeatureIcon icon={<ShieldCheck className="w-4 h-4" />} label="Execution" />
                        </div>
                    </div>

                    <div className="mt-12 text-[10px] text-white/20 uppercase tracking-widest font-medium">
                        Access Restricted to Authorized Accounts
                    </div>
                </div>
            </div>
        </div>
    )
}

function FeatureIcon({ icon, label }: { icon: React.ReactNode, label: string }) {
    return (
        <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-white/40">
                {icon}
            </div>
            <span className="text-[10px] text-white/30 font-bold uppercase">{label}</span>
        </div>
    )
}
