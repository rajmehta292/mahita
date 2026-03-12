'use client'

import { useEffect } from 'react'

export default function BacktestError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.warn('[BacktestError]', error)
  }, [error])

  return (
    <div className="flex-1 bg-[#0d0e12] text-white flex items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-amber-500/20 bg-amber-500/10 px-6 py-5 text-center">
        <h2 className="text-xl font-semibold">Backtest workspace unavailable</h2>
        <p className="mt-3 text-sm text-amber-100/80">
          Mahita could not finish booting the backtest workspace. Retry once the editor and runtime health checks are green.
        </p>
        <button
          onClick={() => reset()}
          className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
        >
          Retry backtester
        </button>
      </div>
    </div>
  )
}
