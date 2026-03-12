'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  console.error('[GlobalError]', error)

  return (
    <html>
      <body className="min-h-screen bg-[#0d0e12] text-white">
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="w-full max-w-lg rounded-[28px] border border-rose-500/20 bg-[#151925]/95 p-8 text-center shadow-2xl shadow-black/40">
            <AlertTriangle className="mx-auto h-8 w-8 text-rose-300" />
            <h1 className="mt-4 text-2xl font-semibold">Mahita could not recover this session</h1>
            <p className="mt-3 text-sm text-white/55">
              A global application error interrupted the session. Go back to the landing page and retry sign-in.
            </p>
            <div className="mt-6 flex justify-center">
              <Link
                href="/"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black"
              >
                Return to landing
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  )
}
