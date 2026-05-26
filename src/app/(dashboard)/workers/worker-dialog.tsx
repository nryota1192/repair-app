'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/lib/supabase/client'
import type { Worker } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, '名前は必須です'),
  default_daily_wage: z.string().min(1, '日給は必須です'),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  worker: Worker | null
  onSaved: (worker: Worker) => void
}

export function WorkerDialog({ open, onOpenChange, worker, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        name: worker?.name ?? '',
        default_daily_wage: worker?.default_daily_wage?.toString() ?? '',
        notes: worker?.notes ?? '',
      })
    }
  }, [open, worker, reset])

  if (!open) return null

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error('ログインが必要です'); return }

    const payload = {
      name: data.name,
      default_daily_wage: Number(data.default_daily_wage),
      notes: data.notes || null,
      user_id: user.id,
    }

    if (worker) {
      const { data: updated, error } = await supabase
        .from('workers')
        .update(payload)
        .eq('id', worker.id)
        .select()
        .single()
      if (error) { toast.error(`保存に失敗しました: ${error.message}`); return }
      onSaved(updated as Worker)
    } else {
      const { data: created, error } = await supabase
        .from('workers')
        .insert(payload)
        .select()
        .single()
      if (error) { toast.error(`保存に失敗しました: ${error.message}`); return }
      onSaved(created as Worker)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-md rounded-xl bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {worker ? '作業員情報の編集' : '作業員を追加'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>名前 *</Label>
            <Input {...register('name')} placeholder="田中 一郎" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label>既定日給 (円) *</Label>
            <Input
              {...register('default_daily_wage')}
              type="number"
              min="0"
              placeholder="20000"
            />
            {errors.default_daily_wage && (
              <p className="text-xs text-destructive">{errors.default_daily_wage.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Label>備考</Label>
            <Textarea {...register('notes')} rows={2} placeholder="特記事項など" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              キャンセル
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '保存中...' : '保存'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
