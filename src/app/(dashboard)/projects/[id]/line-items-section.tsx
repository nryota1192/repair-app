'use client'

import { useState } from 'react'
import { Plus, Trash2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, cn } from '@/lib/utils'
import { calcEstimatedSubtotal } from '@/lib/calculations'
import type { LineItem, LineItemCategory } from '@/types/database'

const CATEGORY_LABELS: Record<LineItemCategory, string> = {
  material: '材料費',
  labor: '作業費・人工',
  transport: '交通費',
  other: 'その他',
}

interface Props {
  category: LineItemCategory
  projectId: string
  userId: string
  defaultLaborUnitPrice: number | null
  lineItems: LineItem[]
  onItemsChange: (items: LineItem[]) => void
}

interface EditingRow {
  id: string | null // null = new row
  name: string
  quantity: string
  unit: string
  unit_price: string
  actual_amount: string
  notes: string
}

export function LineItemsSection({
  category,
  projectId,
  userId,
  defaultLaborUnitPrice,
  lineItems,
  onItemsChange,
}: Props) {
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [saving, setSaving] = useState(false)

  const estimatedSubtotal = lineItems.reduce((sum, i) => sum + calcEstimatedSubtotal(i), 0)
  const actualSubtotal = lineItems.reduce((sum, i) => sum + (i.actual_amount ?? 0), 0)
  const hasActual = lineItems.some((i) => i.actual_amount != null)

  function startNew() {
    setEditing({
      id: null,
      name: '',
      quantity: '',
      unit: category === 'labor' ? '時間' : category === 'transport' ? '回' : '個',
      unit_price: category === 'labor' && defaultLaborUnitPrice
        ? String(defaultLaborUnitPrice) : '',
      actual_amount: '',
      notes: '',
    })
  }

  function startEdit(item: LineItem) {
    if (editing) return
    setEditing({
      id: item.id,
      name: item.name,
      quantity: item.quantity?.toString() ?? '',
      unit: item.unit ?? '',
      unit_price: item.unit_price?.toString() ?? '',
      actual_amount: item.actual_amount?.toString() ?? '',
      notes: item.notes ?? '',
    })
  }

  async function saveRow() {
    if (!editing || !editing.name.trim()) {
      toast.error('項目名は必須です')
      return
    }
    setSaving(true)
    const supabase = createClient()

    const payload = {
      project_id: projectId,
      user_id: userId,
      category,
      name: editing.name,
      quantity: editing.quantity ? Number(editing.quantity) : null,
      unit: editing.unit || null,
      unit_price: editing.unit_price ? Number(editing.unit_price) : null,
      actual_amount: editing.actual_amount ? Number(editing.actual_amount) : null,
      notes: editing.notes || null,
      sort_order: editing.id ? undefined : lineItems.length,
    }

    if (editing.id) {
      const { data, error } = await supabase
        .from('line_items')
        .update(payload)
        .eq('id', editing.id)
        .select()
        .single()
      if (error) { toast.error('保存に失敗しました'); setSaving(false); return }
      onItemsChange(lineItems.map((i) => (i.id === editing.id ? (data as LineItem) : i)))
    } else {
      const { data, error } = await supabase
        .from('line_items')
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error('保存に失敗しました'); setSaving(false); return }
      onItemsChange([...lineItems, data as LineItem])
    }
    setSaving(false)
    setEditing(null)
  }

  async function deleteItem(id: string) {
    const supabase = createClient()
    const { error } = await supabase.from('line_items').delete().eq('id', id)
    if (error) { toast.error('削除に失敗しました'); return }
    onItemsChange(lineItems.filter((i) => i.id !== id))
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <h2 className="font-semibold">{CATEGORY_LABELS[category]}</h2>
        <Button variant="ghost" size="xs" onClick={startNew}>
          <Plus className="size-3.5" />
          行を追加
        </Button>
      </div>

      {/* ── Mobile card list ── */}
      <div className="md:hidden">
        {lineItems.map((item) =>
          editing?.id === item.id ? (
            <MobileEditForm
              key={item.id}
              editing={editing}
              onChange={setEditing}
              onSave={saveRow}
              onCancel={() => setEditing(null)}
              saving={saving}
            />
          ) : (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b px-4 py-3 last:border-0 active:bg-muted/20"
              onClick={() => startEdit(item)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.name}</p>
                {(item.quantity != null || item.unit) && (
                  <p className="text-xs text-muted-foreground">
                    {[item.quantity?.toLocaleString('ja-JP'), item.unit].filter(Boolean).join(' ')}
                    {item.unit_price != null && ` × ${formatCurrency(item.unit_price)}`}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-medium">{formatCurrency(calcEstimatedSubtotal(item))}</p>
                <p className={cn('text-xs', item.actual_amount == null ? 'text-muted-foreground/40' : 'text-muted-foreground')}>
                  {item.actual_amount != null ? `実: ${formatCurrency(item.actual_amount)}` : '実経費未入力'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
              >
                <Trash2 className="size-3.5 text-destructive" />
              </Button>
            </div>
          )
        )}

        {editing?.id === null && (
          <MobileEditForm
            editing={editing}
            onChange={setEditing}
            onSave={saveRow}
            onCancel={() => setEditing(null)}
            saving={saving}
          />
        )}

        {/* Mobile subtotal */}
        <div className="flex items-center justify-between border-t bg-muted/20 px-4 py-2 text-sm font-medium">
          <span className="text-muted-foreground">小計</span>
          <div className="text-right">
            <p>{formatCurrency(estimatedSubtotal)}</p>
            {hasActual && (
              <p className="text-xs text-muted-foreground">実: {formatCurrency(actualSubtotal)}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── Desktop table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/10 text-muted-foreground">
              <th className="py-2 pl-4 text-left font-medium">項目名</th>
              <th className="py-2 text-right font-medium">数量</th>
              <th className="py-2 text-left font-medium">単位</th>
              <th className="py-2 text-right font-medium">単価(税抜)</th>
              <th className="py-2 text-right font-medium">見積小計</th>
              <th className="py-2 text-right font-medium">実経費</th>
              <th className="py-2 pr-2 text-left font-medium">備考</th>
              <th className="py-2 pr-4 w-16" />
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item) => (
              editing?.id === item.id ? (
                <EditRow
                  key={item.id}
                  editing={editing}
                  onChange={setEditing}
                  onSave={saveRow}
                  onCancel={() => setEditing(null)}
                  saving={saving}
                />
              ) : (
                <tr
                  key={item.id}
                  className="border-b last:border-0 hover:bg-muted/20 cursor-pointer"
                  onClick={() => !editing && startEdit(item)}
                >
                  <td className="py-2 pl-4">{item.name}</td>
                  <td className="py-2 text-right">{item.quantity?.toLocaleString('ja-JP') ?? '—'}</td>
                  <td className="py-2 pl-1 text-muted-foreground">{item.unit ?? '—'}</td>
                  <td className="py-2 text-right">{item.unit_price != null ? formatCurrency(item.unit_price) : '—'}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(calcEstimatedSubtotal(item))}</td>
                  <td className={cn('py-2 text-right', item.actual_amount == null ? 'text-muted-foreground/50' : '')}>
                    {item.actual_amount != null ? formatCurrency(item.actual_amount) : '未入力'}
                  </td>
                  <td className="py-2 pr-2 text-muted-foreground text-xs">{item.notes ?? ''}</td>
                  <td className="py-2 pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={(e) => { e.stopPropagation(); deleteItem(item.id) }}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </td>
                </tr>
              )
            ))}

            {editing?.id === null && (
              <EditRow
                editing={editing}
                onChange={setEditing}
                onSave={saveRow}
                onCancel={() => setEditing(null)}
                saving={saving}
              />
            )}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/20 font-medium">
              <td colSpan={4} className="py-2 pl-4 text-right text-muted-foreground text-xs">
                小計
              </td>
              <td className="py-2 text-right">{formatCurrency(estimatedSubtotal)}</td>
              <td className={cn('py-2 text-right', !hasActual ? 'text-muted-foreground/50' : '')}>
                {hasActual ? formatCurrency(actualSubtotal) : '—'}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

function MobileEditForm({
  editing,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  editing: EditingRow
  onChange: (row: EditingRow) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  function set(field: keyof EditingRow, value: string) {
    onChange({ ...editing, [field]: value })
  }

  const previewSubtotal =
    editing.quantity && editing.unit_price
      ? Number(editing.quantity) * Number(editing.unit_price)
      : null

  return (
    <div className="border-b bg-primary/5 px-4 py-3 space-y-2">
      <Input
        className="h-9 text-sm"
        placeholder="項目名 *"
        value={editing.name}
        onChange={(e) => set('name', e.target.value)}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          className="h-9 text-sm"
          type="number"
          placeholder="数量"
          value={editing.quantity}
          onChange={(e) => set('quantity', e.target.value)}
        />
        <Input
          className="h-9 text-sm"
          placeholder="単位(個・時間…)"
          value={editing.unit}
          onChange={(e) => set('unit', e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Input
            className="h-9 text-sm"
            type="number"
            placeholder="見積単価(税抜)"
            value={editing.unit_price}
            onChange={(e) => set('unit_price', e.target.value)}
          />
          {previewSubtotal != null && (
            <p className="mt-0.5 text-xs text-muted-foreground text-right">
              小計: {formatCurrency(previewSubtotal)}
            </p>
          )}
        </div>
        <Input
          className="h-9 text-sm"
          type="number"
          placeholder="実経費"
          value={editing.actual_amount}
          onChange={(e) => set('actual_amount', e.target.value)}
        />
      </div>
      <Input
        className="h-9 text-sm"
        placeholder="備考"
        value={editing.notes}
        onChange={(e) => set('notes', e.target.value)}
      />
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onCancel}>
          <X className="size-3.5 mr-1" />
          キャンセル
        </Button>
        <Button size="sm" onClick={onSave} disabled={saving}>
          <Check className="size-3.5 mr-1" />
          保存
        </Button>
      </div>
    </div>
  )
}

function EditRow({
  editing,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  editing: EditingRow
  onChange: (row: EditingRow) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
}) {
  function set(field: keyof EditingRow, value: string) {
    onChange({ ...editing, [field]: value })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') { e.preventDefault(); onSave() }
    if (e.key === 'Escape') onCancel()
  }

  const previewSubtotal =
    editing.quantity && editing.unit_price
      ? Number(editing.quantity) * Number(editing.unit_price)
      : null

  return (
    <tr className="border-b bg-primary/5">
      <td className="py-1 pl-2">
        <Input
          className="h-7 text-sm"
          placeholder="項目名 *"
          value={editing.name}
          onChange={(e) => set('name', e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      </td>
      <td className="py-1 px-1">
        <Input
          className="h-7 text-sm text-right w-20"
          type="number"
          placeholder="0"
          value={editing.quantity}
          onChange={(e) => set('quantity', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="py-1 px-1">
        <Input
          className="h-7 text-sm w-14"
          placeholder="個"
          value={editing.unit}
          onChange={(e) => set('unit', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="py-1 px-1">
        <Input
          className="h-7 text-sm text-right w-24"
          type="number"
          placeholder="単価"
          value={editing.unit_price}
          onChange={(e) => set('unit_price', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="py-1 px-2 text-right text-muted-foreground text-xs">
        {previewSubtotal != null ? formatCurrency(previewSubtotal) : '—'}
      </td>
      <td className="py-1 px-1">
        <Input
          className="h-7 text-sm text-right w-24"
          type="number"
          placeholder="実経費"
          value={editing.actual_amount}
          onChange={(e) => set('actual_amount', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="py-1 px-1">
        <Input
          className="h-7 text-sm w-32"
          placeholder="備考"
          value={editing.notes}
          onChange={(e) => set('notes', e.target.value)}
          onKeyDown={handleKeyDown}
        />
      </td>
      <td className="py-1 pr-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon-xs" onClick={onSave} disabled={saving}>
            <Check className="size-3 text-green-600" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onCancel}>
            <X className="size-3" />
          </Button>
        </div>
      </td>
    </tr>
  )
}
