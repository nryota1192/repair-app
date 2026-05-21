import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { formatDate, formatCurrency } from '@/lib/utils'

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: customer } = await supabase
    .from('customers')
    .select('*')
    .eq('id', id)
    .single()

  if (!customer) notFound()

  const { data: projects } = await supabase
    .from('projects')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/customers" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-2xl font-bold">{customer.name}</h1>
      </div>

      <Card>
        <CardHeader><CardTitle>顧客情報</CardTitle></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ['担当者名', customer.contact_name],
              ['電話番号', customer.phone],
              ['メール', customer.email],
              ['郵便番号', customer.postal_code],
              ['住所', customer.address],
              ['備考', customer.notes],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="mt-0.5">{value ?? '—'}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">過去の案件</h2>
        <div className="rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>案件名</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>見積日</TableHead>
                <TableHead>受注金額</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(projects ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    案件がありません
                  </TableCell>
                </TableRow>
              )}
              {(projects ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.title}</TableCell>
                  <TableCell><ProjectStatusBadge status={p.status} /></TableCell>
                  <TableCell>{formatDate(p.estimated_at)}</TableCell>
                  <TableCell>{formatCurrency(p.received_amount)}</TableCell>
                  <TableCell>
                    <Link href={`/projects/${p.id}`} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
