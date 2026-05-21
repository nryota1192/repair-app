'use client'

import { useRouter } from 'next/navigation'
import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

interface HeaderProps {
  onMenuClick?: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header className="flex h-14 items-center border-b bg-background px-4">
      <Button variant="ghost" size="icon-xs" className="mr-3 md:hidden" onClick={onMenuClick}>
        <Menu className="size-5" />
      </Button>
      <span className="text-sm font-semibold md:hidden">修繕管理</span>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={handleLogout}>
        <LogOut className="size-4" />
        <span className="ml-1 hidden sm:inline">ログアウト</span>
      </Button>
    </header>
  )
}
