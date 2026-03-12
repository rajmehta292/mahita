'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AppError]', error)
  }, [error])

  return (
    <div className="min-h-screen bg-[#0d0e12] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-[28px] border border-rose-500/20 bg-[#151925]/95 p-8 text-center shadow-2xl shadow-black/40">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-300" />
        <h1 className="mt-4 text-2xl font-semibold">Mahita hit an unexpected error</h1>
        <p className="mt-3 text-sm text-white/55">
          The current screen could not finish rendering. You can retry the route or return to the dashboard.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={() => reset()}
            className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
          >
            Retry
          </button>
          <Link
            href="/dashboard"
            className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/85"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
