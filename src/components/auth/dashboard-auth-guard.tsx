'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { hasValidAccessToken, refreshAccessToken } from '@/lib/auth'

export function DashboardAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    // Login already issued a short-lived access token. Use it for this session
    // instead of immediately depending on a cross-site refresh cookie.
    if (hasValidAccessToken()) {
      queueMicrotask(() => { if (active) setReady(true) })
      return () => { active = false }
    }

    refreshAccessToken()
      .then(() => { if (active) setReady(true) })
      .catch(() => { if (active) router.replace('/auth/login') })
    return () => { active = false }
  }, [router])

  if (!ready) return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground" role="status">Checking your session…</main>
  return children
}
