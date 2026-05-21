'use client'

import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

export function Header() {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center justify-end border-b bg-background px-4">
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="size-4" />
        ログアウト
      </Button>
    </header>
  )
}
