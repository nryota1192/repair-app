import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CustomersClient } from './customers-client'

export default async function CustomersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .order('created_at', { ascending: false })

  return <CustomersClient initialCustomers={customers ?? []} />
}
