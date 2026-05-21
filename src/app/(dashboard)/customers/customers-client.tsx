'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Plus, Search, Pencil, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog } from '@/components/ui/alert-dialog'
import { CustomerDialog } from './customer-dialog'
import { createClient } from '@/lib/supabase/client'
import type { Customer } from '@/types/database'

export function CustomersClient({ initialCustomers }: { initialCustomers: Customer[] }) {
  const router = useRouter()
  const [customers, setCustomers] = useState(initialCustomers)
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Customer | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null)

  const filtered = customers.filter((c) =>
    [c.name, c.phone, c.address].some((v) => v?.includes(search)),
  )

  function openNew() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(c: Customer) {
    setEditTarget(c)
    setDialogOpen(true)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const supabase = createClient()

    const { count } = await supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', deleteTarget.id)

    if ((count ?? 0) > 0) {
      toast.error('この顧客には関連する案件があるため削除できません')
      setDeleteTarget(null)
      return
    }

    const { error } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
    if (error) { toast.error('削除に失敗しました'); return }
    setCustomers((prev) => prev.filter((c) => c.id !== deleteTarget.id))
    toast.success('顧客を削除しました')
    setDeleteTarget(null)
  }

  function handleSaved(customer: Customer) {
    if (editTarget) {
      setCustomers((prev) => prev.map((c) => (c.id === customer.id ? customer : c)))
    } else {
      setCustomers((prev) => [customer, ...prev])
    }
    setDialogOpen(false)
    toast.success(editTarget ? '顧客情報を更新しました' : '顧客を登録しました')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">顧客管理</h1>
        <Button onClick={openNew}>
          <Plus className="size-4" />
          新規顧客
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="名前・電話番号・住所で検索..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>顧客名</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>住所</TableHead>
              <TableHead className="w-28 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  顧客が見つかりません
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link href={`/customers/${c.id}`} className="hover:underline flex items-center gap-1">
                    {c.name}
                    <ExternalLink className="size-3 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>{c.contact_name ?? '—'}</TableCell>
                <TableCell>{c.phone ?? '—'}</TableCell>
                <TableCell className="max-w-xs truncate">{c.address ?? '—'}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon-sm" onClick={() => openEdit(c)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => setDeleteTarget(c)}>
                    <Trash2 className="size-3.5 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CustomerDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        customer={editTarget}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="顧客の削除"
        description={`「${deleteTarget?.name}」を削除しますか？この操作は取り消せません。`}
        onConfirm={handleDelete}
      />
    </div>
  )
}
