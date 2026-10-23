
'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { saveAccessToken } from '@/lib/auth'

export default function AuthCallbackPage() {
  const router = useRouter()
  const processed = useRef(false)

  useEffect(() => {
    // Prevent duplicate processing in React Strict Mode
    if (processed.current) return
    processed.current = true

    const params = new URLSearchParams(
      window.location.hash.substring(1),
    )
    const accessToken = params.get('accessToken')

    // Remove the token from the browser URL
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search,
    )

    if (!accessToken) {
      router.replace('/auth/login?error=missing_token')
      return
    }

    saveAccessToken(accessToken)
    router.replace('/dashboard')
  }, [router])

  return <p className="p-6">Signing you in...</p>
}
