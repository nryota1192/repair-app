'use client'

import { useState } from 'react'
import { Plus, Search, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { WorkerDialog } from './worker-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Worker } from '@/types/database'

interface DeleteInfo {
  worker: Worker
  workRecordsCount: number
}

export function WorkersClient({ initialWorkers }: { initialWorkers: Worker[] }) {
  const [workers, setWorkers] = useState(initialWorkers)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Worker | null>(null)
  const [deleteInfo, setDeleteInfo] = useState<DeleteInfo | null>(null)

  const filtered = workers.filter((w) => w.name.includes(search))

  function openNew() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(w: Worker) {
    setEditTarget(w)
    setDialogOpen(true)
  }

  async function openDelete(w: Worker) {
    const supabase = createClient()
    const { count } = await supabase
      .from('work_records')
      .select('id', { count: 'exact', head: true })
      .eq('worker_id', w.id)
    setDeleteInfo({ worker: w, workRecordsCount: count ?? 0 })
  }

  async function handleDelete() {
    if (!deleteInfo) return
    const supabase = createClient()
    const { error } = await supabase.from('workers').delete().eq('id', deleteInfo.worker.id)
    if (error) { toast.error('削除に失敗しました'); return }
    setWorkers((prev) => prev.filter((w) => w.id !== deleteInfo.worker.id))
    toast.success('作業員を削除しました')
    setDeleteInfo(null)
  }

  function handleSaved(w: Worker) {
    setWorkers((prev) => {
      const idx = prev.findIndex((x) => x.id === w.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = w; return next
      }
      return [...prev, w]
    })
    setDialogOpen(false)
    toast.success(editTarget ? '作業員情報を更新しました' : '作業員を追加しました')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">作業員</h1>
        <Button size="sm" onClick={openNew}>
          <Plus className="size-4" />
          作業員を追加
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="名前で検索"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名前</TableHead>
              <TableHead className="text-right">既定日給</TableHead>
              <TableHead className="hidden sm:table-cell">備考</TableHead>
              <TableHead className="hidden sm:table-cell">登録日</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  {search ? '該当する作業員が見つかりません' : '作業員がいません。追加してください。'}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((w) => (
              <TableRow key={w.id}>
                <TableCell className="font-medium">{w.name}</TableCell>
                <TableCell className="text-right">{formatCurrency(w.default_daily_wage)}</TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                  {w.notes ?? '—'}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">
                  {formatDate(w.created_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-xs" onClick={() => openEdit(w)}>
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => openDelete(w)}>
                      <Trash2 className="size-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <WorkerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        worker={editTarget}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={deleteInfo !== null}
        onOpenChange={(open) => { if (!open) setDeleteInfo(null) }}
        title={`「${deleteInfo?.worker.name}」を削除しますか？`}
        description={
          (deleteInfo?.workRecordsCount ?? 0) > 0
            ? `${deleteInfo!.workRecordsCount}件の出勤記録があります。削除すると記録は「削除済み作業員」として残ります。`
            : 'この操作は元に戻せません。'
        }
        onConfirm={handleDelete}
      />
    </div>
  )
}
