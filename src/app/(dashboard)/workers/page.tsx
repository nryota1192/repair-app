import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { WorkersClient } from './workers-client'

export default async function WorkersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workers } = await supabase
    .from('workers')
    .select('*')
    .order('name')

  return <WorkersClient initialWorkers={workers ?? []} />
}
