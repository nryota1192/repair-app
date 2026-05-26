'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import type { Worker, WorkRecord } from '@/types/database'

interface Props {
  projectId: string
  userId: string
  workers: Worker[]
  workRecords: WorkRecord[]
  onRecordsChange: (records: WorkRecord[]) => void
}

interface EditingRecord {
  id: string | null // null = new
  work_date: string
  worker_id: string
  daily_wage: string
  notes: string
}

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

// スタイルを Input に揃えたネイティブ select
const selectCls =
  'flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50'

export function WorkRecordsSection({
  projectId,
  userId,
  workers,
  workRecords,
  onRecordsChange,
}: Props) {
  const [editing, setEditing] = useState<EditingRecord | null>(null)
  const [saving, setSaving] = useState(false)

  const total = workRecords.reduce((sum, r) => sum + r.daily_wage, 0)

  const sorted = [...workRecords].sort((a, b) => a.work_date.localeCompare(b.work_date))

  function startNew() {
    setEditing({ id: null, work_date: todayIso(), worker_id: '', daily_wage: '', notes: '' })
  }

  function startEdit(r: WorkRecord) {
    if (editing) return
    setEditing({
      id: r.id,
      work_date: r.work_date,
      worker_id: r.worker_id ?? '',
      daily_wage: String(r.daily_wage),
      notes: r.notes ?? '',
    })
  }

  function handleWorkerChange(workerId: string) {
    const w = workers.find((w) => w.id === workerId)
    setEditing((prev) =>
      prev
        ? { ...prev, worker_id: workerId, daily_wage: w ? String(w.default_daily_wage) : prev.daily_wage }
        : null,
    )
  }

  async function saveRecord() {
    if (!editing) return
    if (!editing.work_date) { toast.error('日付は必須です'); return }
    if (!editing.daily_wage || Number(editing.daily_wage) < 0) {
      toast.error('日給を入力してください')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      project_id: projectId,
      user_id: userId,
      worker_id: editing.worker_id || null,
      work_date: editing.work_date,
      daily_wage: Number(editing.daily_wage),
      notes: editing.notes || null,
    }

    if (editing.id) {
      const { data, error } = await supabase
        .from('work_records')
        .update(payload)
        .eq('id', editing.id)
        .select('*, workers(id, name)')
        .single()
      if (error) {
        toast.error(error.code === '23505' ? '同じ日に同じ作業員の記録がすでにあります' : '保存に失敗しました')
        setSaving(false); return
      }
      onRecordsChange(workRecords.map((r) => (r.id === editing.id ? (data as WorkRecord) : r)))
    } else {
      const { data, error } = await supabase
        .from('work_records')
        .insert(payload)
        .select('*, workers(id, name)')
        .single()
      if (error) {
        toast.error(error.code === '23505' ? '同じ日に同じ作業員の記録がすでにあります' : '保存に失敗しました')
        setSaving(false); return
      }
      onRecordsChange([...workRecords, data as WorkRecord])
    }
    setSaving(false)
    setEditing(null)
  }

  async function deleteRecord(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('work_records').delete().eq('id', id)
    if (error) { toast.error('削除に失敗しました'); return }
    onRecordsChange(workRecords.filter((r) => r.id !== id))
    toast.success('出勤記録を削除しました')
  }

  function workerName(r: WorkRecord) {
    return r.workers?.name ?? (r.worker_id ? '(不明)' : '削除済み作業員')
  }

  // ─── Inline edit form (shared mobile/desktop) ───────────────────────
  function EditForm({ onKeyDown }: { onKeyDown?: (e: React.KeyboardEvent) => void }) {
    if (!editing) return null
    return (
      <>
        <Input
          type="date"
          className="h-9 text-sm"
          value={editing.work_date}
          onChange={(e) => setEditing((p) => p && { ...p, work_date: e.target.value })}
          onKeyDown={onKeyDown}
        />
        <select
          className={selectCls}
          value={editing.worker_id}
          onChange={(e) => handleWorkerChange(e.target.value)}
        >
          <option value="">-- 作業員を選択 --</option>
          {workers.map((w) => (
            <option key={w.id} value={w.id}>{w.name}</option>
          ))}
        </select>
        <Input
          type="number"
          className="h-9 text-sm"
          placeholder="日給"
          value={editing.daily_wage}
          onChange={(e) => setEditing((p) => p && { ...p, daily_wage: e.target.value })}
          onKeyDown={onKeyDown}
        />
        <Input
          className="h-9 text-sm"
          placeholder="備考"
          value={editing.notes}
          onChange={(e) => setEditing((p) => p && { ...p, notes: e.target.value })}
          onKeyDown={onKeyDown}
        />
      </>
    )
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <h2 className="font-semibold">出勤記録</h2>
        <Button variant="ghost" size="xs" onClick={startNew} disabled={!!editing}>
          <Plus className="size-3.5" />
          出勤記録を追加
        </Button>
      </div>

      {workers.length === 0 && (
        <p className="px-4 py-6 text-sm text-muted-foreground text-center">
          作業員マスタが未登録です。
          <a href="/workers" className="text-primary underline ml-1">作業員を追加</a>
          してから出勤記録を登録してください。
        </p>
      )}

      {/* ── Mobile: card list ── */}
      <div className="md:hidden">
        {sorted.map((r) =>
          editing?.id === r.id ? (
            <div key={r.id} className="border-b bg-primary/5 px-4 py-3 space-y-2">
              <EditForm
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setEditing(null)
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                  <X className="size-3.5 mr-1" />キャンセル
                </Button>
                <Button size="sm" onClick={saveRecord} disabled={saving}>
                  <Check className="size-3.5 mr-1" />保存
                </Button>
              </div>
            </div>
          ) : (
            <div
              key={r.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-0 active:bg-muted/20"
              onClick={() => startEdit(r)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{workerName(r)}</p>
                <p className="text-xs text-muted-foreground">
                  {r.work_date.replace(/-/g, '/')}
                  {r.notes && ` · ${r.notes}`}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{formatCurrency(r.daily_wage)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => { e.stopPropagation(); deleteRecord(r.id) }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          ),
        )}

        {/* Mobile: new record form */}
        {editing?.id === null && (
          <div className="border-b bg-primary/5 px-4 py-3 space-y-2">
            <EditForm />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditing(null)}>
                <X className="size-3.5 mr-1" />キャンセル
              </Button>
              <Button size="sm" onClick={saveRecord} disabled={saving}>
                <Check className="size-3.5 mr-1" />保存
              </Button>
            </div>
          </div>
        )}

        {/* Mobile total */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-sm font-medium">
          <span className="text-muted-foreground">出勤記録合計</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/10 text-muted-foreground">
              <th className="py-2 pl-4 text-left font-medium w-32">日付</th>
              <th className="py-2 text-left font-medium">作業員</th>
              <th className="py-2 text-right font-medium w-28">日給</th>
              <th className="py-2 px-2 text-left font-medium">備考</th>
              <th className="py-2 pr-4 w-16" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) =>
              editing?.id === r.id ? (
                <tr key={r.id} className="border-b bg-primary/5">
                  <td className="py-1 pl-2 pr-1">
                    <Input
                      type="date"
                      className="h-7 text-sm"
                      value={editing.work_date}
                      onChange={(e) => setEditing((p) => p && { ...p, work_date: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                    />
                  </td>
                  <td className="py-1 px-1">
                    <select
                      className={cn(selectCls, 'h-7 py-0')}
                      value={editing.worker_id}
                      onChange={(e) => handleWorkerChange(e.target.value)}
                    >
                      <option value="">-- 選択 --</option>
                      {workers.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-1 px-1">
                    <Input
                      type="number"
                      className="h-7 text-sm text-right w-24"
                      placeholder="日給"
                      value={editing.daily_wage}
                      onChange={(e) => setEditing((p) => p && { ...p, daily_wage: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                    />
                  </td>
                  <td className="py-1 px-1">
                    <Input
                      className="h-7 text-sm w-32"
                      placeholder="備考"
                      value={editing.notes}
                      onChange={(e) => setEditing((p) => p && { ...p, notes: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                    />
                  </td>
                  <td className="py-1 pr-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-xs" onClick={saveRecord} disabled={saving}>
                        <Check className="size-3 text-green-600" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => setEditing(null)}>
                        <X className="size-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr
                  key={r.id}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => startEdit(r)}
                >
                  <td className="py-2 pl-4">{r.work_date.replace(/-/g, '/')}</td>
                  <td className="py-2">{workerName(r)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(r.daily_wage)}</td>
                  <td className="py-2 px-2 text-muted-foreground text-xs">{r.notes ?? ''}</td>
                  <td className="py-2 pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); deleteRecord(r.id) }}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ),
            )}

            {/* New record row */}
            {editing?.id === null && (
              <tr className="border-b bg-primary/5">
                <td className="py-1 pl-2 pr-1">
                  <Input
                    type="date"
                    className="h-7 text-sm"
                    value={editing.work_date}
                    onChange={(e) => setEditing((p) => p && { ...p, work_date: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                    autoFocus
                  />
                </td>
                <td className="py-1 px-1">
                  <select
                    className={cn(selectCls, 'h-7 py-0')}
                    value={editing.worker_id}
                    onChange={(e) => handleWorkerChange(e.target.value)}
                  >
                    <option value="">-- 選択 --</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </td>
                <td className="py-1 px-1">
                  <Input
                    type="number"
                    className="h-7 text-sm text-right w-24"
                    placeholder="日給"
                    value={editing.daily_wage}
                    onChange={(e) => setEditing((p) => p && { ...p, daily_wage: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                  />
                </td>
                <td className="py-1 px-1">
                  <Input
                    className="h-7 text-sm w-32"
                    placeholder="備考"
                    value={editing.notes}
                    onChange={(e) => setEditing((p) => p && { ...p, notes: e.target.value })}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecord() } if (e.key === 'Escape') setEditing(null) }}
                  />
                </td>
                <td className="py-1 pr-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="icon-xs" onClick={saveRecord} disabled={saving}>
                      <Check className="size-3 text-green-600" />
                    </Button>
                    <Button variant="ghost" size="icon-xs" onClick={() => setEditing(null)}>
                      <X className="size-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20 font-medium">
              <td colSpan={2} className="py-2 pl-4 text-right text-muted-foreground text-xs">
                出勤記録合計
              </td>
              <td className="py-2 text-right">{formatCurrency(total)}</td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
