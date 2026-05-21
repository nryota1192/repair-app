'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { ProjectDialog } from './project-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatDate, formatCurrency } from '@/lib/utils'
import type { Project, ProjectStatus } from '@/types/database'

type ProjectWithCustomer = Project & { customers: { id: string; name: string } }

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'すべて' },
  { value: 'estimating', label: '見積中' },
  { value: 'won', label: '受注' },
  { value: 'in_progress', label: '施工中' },
  { value: 'completed', label: '完工' },
  { value: 'lost', label: '失注' },
]

export function ProjectsClient({
  initialProjects,
  customers,
}: {
  initialProjects: ProjectWithCustomer[]
  customers: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [projects, setProjects] = useState(initialProjects)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProjectWithCustomer | null>(null)

  const filtered = projects.filter((p) => {
    const matchSearch =
      !search || p.title.includes(search) || p.customers?.name?.includes(search)
    const matchStatus = !statusFilter || p.status === statusFilter
    return matchSearch && matchStatus
  })

  async function handleDelete() {
    if (!deleteTarget) return
    const supabase = createClient()
    const { error } = await supabase.from('projects').delete().eq('id', deleteTarget.id)
    if (error) { toast.error('削除に失敗しました'); return }
    setProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
    toast.success('案件を削除しました')
    setDeleteTarget(null)
  }

  function handleCreated(project: ProjectWithCustomer) {
    setProjects((prev) => [project, ...prev])
    setDialogOpen(false)
    toast.success('案件を登録しました')
    router.push(`/projects/${project.id}`)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">案件管理</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" />
          新規案件
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="案件名・顧客名で検索..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>案件名</TableHead>
              <TableHead>顧客名</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead>見積日</TableHead>
              <TableHead>受注金額</TableHead>
              <TableHead className="w-20 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                  案件が見つかりません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <Link href={`/projects/${p.id}`} className="hover:underline flex items-center gap-1">
                    {p.title}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>
                  {p.customers ? (
                    <Link href={`/customers/${p.customers.id}`} className="hover:underline">
                      {p.customers.name}
                    </Link>
                  ) : '—'}
                </TableCell>
                <TableCell><ProjectStatusBadge status={p.status as ProjectStatus} /></TableCell>
                <TableCell>{formatDate(p.estimated_at)}</TableCell>
                <TableCell>{formatCurrency(p.received_amount)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customers={customers}
        onCreated={handleCreated}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="案件の削除"
        description={`「${deleteTarget?.title}」を削除しますか？関連する明細も全て削除されます。`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
