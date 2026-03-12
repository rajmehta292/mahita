'use client'

import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { AUTH_POST_SIGNIN_PATH, resolveClientCallbackUrl } from '@/lib/auth-redirect'
import { useAuthHealth } from '@/app/hooks/use-auth-health'

export function AuthEntryCta({
  className = '',
  fullWidth = false,
}: {
  className?: string
  fullWidth?: boolean
}) {
  const authHealth = useAuthHealth()
  const googleEnabled = authHealth?.googleSignInEnabled ?? false
  const publicAppOrigin = authHealth?.publicAppOrigin || 'https://mahita.ai'
  const postSignInUrl = resolveClientCallbackUrl(AUTH_POST_SIGNIN_PATH)

  const buttonClasses = [
    'px-6 py-3 rounded-lg transition-colors font-medium',
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  if (authHealth === null) {
    return (
      <Link
        href="/auth/signin"
        className={buttonClasses || 'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors'}
      >
        Continue to sign in
      </Link>
    )
  }

  if (googleEnabled) {
    return (
      <button
        onClick={() => signIn('google', { callbackUrl: postSignInUrl })}
        className={buttonClasses || 'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors'}
      >
        Sign in with Google
      </button>
    )
  }

  return (
    <Link
      href={`${publicAppOrigin}/auth/signin`}
      className={buttonClasses || 'px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors'}
    >
      Continue on mahita.ai
    </Link>
  )
}
