'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { Project } from '@/types/database'

const schema = z.object({
  title: z.string().min(1, '案件名は必須です'),
  customer_id: z.string().min(1, '顧客を選択してください'),
  property_address: z.string().optional(),
  status: z.enum(['estimating', 'won', 'in_progress', 'completed', 'lost']),
  estimated_at: z.string().optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  description: z.string().optional(),
  default_labor_unit_price: z.string().optional(),
  rounding_mode: z.enum(['floor', 'round', 'ceil']),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  customers: { id: string; name: string }[]
  onSaved: (project: any) => void
}

export function ProjectEditDialog({ open, onOpenChange, project, customers, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        title: project.title,
        customer_id: project.customer_id,
        property_address: project.property_address ?? '',
        status: project.status,
        estimated_at: project.estimated_at ?? '',
        start_date: project.start_date ?? '',
        end_date: project.end_date ?? '',
        description: project.description ?? '',
        default_labor_unit_price: project.default_labor_unit_price?.toString() ?? '',
        rounding_mode: project.rounding_mode,
        notes: project.notes ?? '',
      })
    }
  }, [open, project, reset])

  if (!open) return null

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const payload = {
      title: data.title,
      customer_id: data.customer_id,
      property_address: data.property_address || null,
      status: data.status,
      estimated_at: data.estimated_at || null,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      description: data.description || null,
      default_labor_unit_price: data.default_labor_unit_price
        ? Number(data.default_labor_unit_price) : null,
      rounding_mode: data.rounding_mode,
      notes: data.notes || null,
    }
    const { data: updated, error } = await supabase
      .from('projects')
      .update(payload)
      .eq('id', project.id)
      .select('*, customers(id, name)')
      .single()
    if (!error && updated) onSaved(updated)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-lg rounded-xl bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold">案件情報の編集</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>案件名 *</Label>
            <Input {...register('title')} />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>顧客 *</Label>
            <select
              {...register('customer_id')}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label>施工物件住所</Label>
            <Input {...register('property_address')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>ステータス</Label>
              <select
                {...register('status')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="estimating">見積中</option>
                <option value="won">受注</option>
                <option value="in_progress">施工中</option>
                <option value="completed">完工</option>
                <option value="lost">失注</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>端数処理</Label>
              <select
                {...register('rounding_mode')}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="floor">切り捨て</option>
                <option value="round">四捨五入</option>
                <option value="ceil">切り上げ</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>見積日</Label>
              <Input {...register('estimated_at')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>着工予定</Label>
              <Input {...register('start_date')} type="date" />
            </div>
            <div className="space-y-1">
              <Label>完工予定</Label>
              <Input {...register('end_date')} type="date" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>人工単価(既定値・円/時)</Label>
            <Input {...register('default_labor_unit_price')} type="number" />
          </div>
          <div className="space-y-1">
            <Label>案件概要</Label>
            <Textarea {...register('description')} rows={2} />
          </div>
          <div className="space-y-1">
            <Label>備考(社内用)</Label>
            <Textarea {...register('notes')} rows={2} />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '更新中...' : '更新する'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
