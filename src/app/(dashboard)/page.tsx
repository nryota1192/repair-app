import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { formatDate, formatCurrency, cn } from '@/lib/utils'
import { calcProjectSummary } from '@/lib/calculations'
import type { ProjectStatus, RoundingMode } from '@/types/database'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString()

  const [
    { count: estimatingCount },
    { count: inProgressCount },
    { count: completedCount },
    { data: recentProjects },
    { data: thisMonthProjects },
  ] = await Promise.all([
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'estimating'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'in_progress'),
    supabase.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase
      .from('projects')
      .select('*, customers(id, name)')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('projects')
      .select('*, customers(id, name)')
      .eq('status', 'completed')
      .gte('updated_at', monthStart)
      .lte('updated_at', monthEnd),
  ])

  const monthProjectIds = (thisMonthProjects ?? []).map((p) => p.id)
  const { data: allLineItems } = monthProjectIds.length > 0
    ? await supabase.from('line_items').select('*').in('project_id', monthProjectIds)
    : { data: [] }

  // Calculate this month totals
  let thisMonthRevenue = 0
  let thisMonthProfit = 0
  for (const p of (thisMonthProjects ?? [])) {
    const items = (allLineItems ?? []).filter((i) => i.project_id === p.id)
    const s = calcProjectSummary(items, p.tax_rate, p.rounding_mode as RoundingMode, p.received_amount)
    thisMonthRevenue += p.received_amount ?? s.estimatedTotalWithTax
    if (s.actualProfit != null) thisMonthProfit += s.actualProfit
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="見積中" value={estimatingCount ?? 0} unit="件" />
        <StatCard label="施工中" value={inProgressCount ?? 0} unit="件" />
        <StatCard label="今月完工" value={completedCount ?? 0} unit="件" />
        <StatCard label="今月受注額" value={formatCurrency(thisMonthRevenue)} />
      </div>

      {/* Today profit */}
      <Card>
        <CardHeader><CardTitle className="text-base">今月の実利益(完工済み)</CardTitle></CardHeader>
        <CardContent>
          <p className={cn(
            'text-3xl font-bold',
            thisMonthProfit >= 0 ? 'text-green-600' : 'text-destructive',
          )}>
            {formatCurrency(thisMonthProfit)}
          </p>
        </CardContent>
      </Card>

      {/* Recent projects */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">直近の案件</h2>
          <Link href="/projects" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            すべて表示
          </Link>
        </div>

        {/* Mobile card list */}
        <div className="rounded-xl border md:hidden">
          {(recentProjects ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">案件がありません</p>
          )}
          {(recentProjects ?? []).map((p, idx) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={cn('flex items-center justify-between px-4 py-3 hover:bg-muted/20', idx > 0 && 'border-t')}
            >
              <div className="min-w-0">
                <p className="font-medium truncate">{p.title}</p>
                <p className="text-xs text-muted-foreground">
                  {(p as any).customers?.name ?? '—'}
                  {p.estimated_at ? ` · ${formatDate(p.estimated_at)}` : ''}
                </p>
              </div>
              <div className="ml-4 shrink-0 text-right">
                <ProjectStatusBadge status={p.status as ProjectStatus} />
                {p.received_amount != null && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatCurrency(p.received_amount)}</p>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>案件名</TableHead>
                <TableHead>顧客</TableHead>
                <TableHead>ステータス</TableHead>
                <TableHead>見積日</TableHead>
                <TableHead>受注金額</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(recentProjects ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    案件がありません
                  </TableCell>
                </TableRow>
              )}
              {(recentProjects ?? []).map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/projects/${p.id}`} className="hover:underline">
                      {p.title}
                    </Link>
                  </TableCell>
                  <TableCell>{(p as any).customers?.name ?? '—'}</TableCell>
                  <TableCell>
                    <ProjectStatusBadge status={p.status as ProjectStatus} />
                  </TableCell>
                  <TableCell>{formatDate(p.estimated_at)}</TableCell>
                  <TableCell>{formatCurrency(p.received_amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Card size="sm">
      <CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">
          {value}
          {unit && <span className="ml-1 text-sm font-normal text-muted-foreground">{unit}</span>}
        </p>
      </CardContent>
    </Card>
  )
}
