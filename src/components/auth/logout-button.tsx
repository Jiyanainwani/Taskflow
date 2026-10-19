'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { logout } from '@/lib/auth'

export function LogoutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function handleLogout() {
    setPending(true)
    try {
      await logout()
    } finally {
      router.replace('/auth/login')
      router.refresh()
    }
  }

  return <Button variant="ghost" className="w-full justify-start" disabled={pending} onClick={handleLogout}><LogOut aria-hidden="true" />{pending ? 'Signing out…' : 'Sign out'}</Button>
}
