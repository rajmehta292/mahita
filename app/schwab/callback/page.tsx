'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function SchwabCallbackContent() {
    const searchParams = useSearchParams()

    useEffect(() => {
        const code = searchParams.get('code')

        if (code && window.opener) {
            // Send the authorization code back to the parent window
            window.opener.postMessage({
                type: 'schwab-callback',
                code: code
            }, window.location.origin)

            // Close this window after a short delay
            setTimeout(() => {
                window.close()
            }, 1000)
        }
    }, [searchParams])

    return (
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white text-lg">Completing authorization...</p>
            <p className="text-gray-400 text-sm mt-2">This window will close automatically</p>
        </div>
    )
}

export default function SchwabCallbackPage() {
    return (
        <div className="min-h-screen bg-[#131722] flex items-center justify-center">
            <Suspense fallback={
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-white text-lg">Loading...</p>
                </div>
            }>
                <SchwabCallbackContent />
            </Suspense>
        </div>
    )
}
