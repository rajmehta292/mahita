'use client'

import { useEffect } from 'react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.warn('[AdminError]', error)
  }, [error])

  return (
    <div className="flex-1 bg-[#0d0e12] text-white flex items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-rose-500/20 bg-rose-500/10 px-6 py-5 text-center">
        <h2 className="text-xl font-semibold">Admin control plane unavailable</h2>
        <p className="mt-3 text-sm text-rose-100/80">
          Mahita hit an admin-route error. Retry this screen once the runtime health check is green.
        </p>
        <button
          onClick={() => reset()}
          className="mt-5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
        >
          Retry admin
        </button>
      </div>
    </div>
  )
}
