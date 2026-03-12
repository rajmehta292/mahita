import Link from "next/link"
import { BookOpen, Home, Lock, ShieldCheck } from "lucide-react"

export function DocsShell({
  signedIn,
  children,
}: {
  signedIn: boolean
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[#0c0f16] text-white">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute left-[-12%] top-[-10%] h-[28rem] w-[28rem] rounded-full bg-cyan-500/8 blur-[140px]" />
        <div className="absolute bottom-[-14%] right-[-10%] h-[24rem] w-[24rem] rounded-full bg-emerald-500/8 blur-[140px]" />
      </div>

      <header className="sticky top-0 z-40 border-b border-white/8 bg-[#0f1320]/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-400/20">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-[0.24em] text-white/40">MAHITA DOCS</p>
              <p className="text-xs text-white/35">Senior project wiki, evidence, and runbooks</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <Link href="/" className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-white/80 transition hover:border-white/20 hover:text-white">
              <Home className="h-4 w-4" />
              Home
            </Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-cyan-200 transition hover:border-cyan-300/35 hover:bg-cyan-400/15">
              <BookOpen className="h-4 w-4" />
              Documentation
            </Link>
            <Link
              href={signedIn ? "/dashboard" : "/auth/signin"}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/6 px-4 py-2 text-white/80 transition hover:border-white/20 hover:text-white"
            >
              {signedIn ? <ShieldCheck className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              {signedIn ? "Open app" : "Sign in"}
            </Link>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-6 lg:px-8">{children}</main>
    </div>
  )
}
