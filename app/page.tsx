import Link from 'next/link'

export default function Home() {
    return (
        <main className="flex min-h-screen flex-col items-center justify-center gap-8 relative overflow-hidden">

            {/* Background Decor */}
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[150px] opacity-20 pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-accent rounded-full blur-[150px] opacity-10 pointer-events-none"></div>

            <div className="z-10 flex flex-col items-center gap-4 text-center">
                <h1 className="text-6xl font-black tracking-tighter mix-blend-plus-lighter flex items-center justify-center gap-4">
                    <img src="/vectorized.svg" alt="Mahita" className="w-16 h-16 invert opacity-90" />
                    MAHITA <span className="text-accent relative">TERMINAL</span>
                </h1>
                <p className="text-xl text-gray-400 max-w-[600px] mt-2">
                    A high-performance algorithmic trading and backtesting engine running securely on your local machine.
                </p>

                <div className="mt-8 flex gap-4">
                    <Link href="/dashboard" className="px-8 py-4 bg-primary hover:bg-primary-hover text-white font-bold rounded shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
                        Access Terminal
                    </Link>

                    <Link href="/api/auth/signin?callbackUrl=/dashboard" className="px-8 py-4 glass-panel hover:bg-white/10 text-white font-bold rounded transition-all">
                        Login
                    </Link>
                </div>
            </div>

        </main>
    )
}
