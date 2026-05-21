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
import type { Customer } from '@/types/database'

const schema = z.object({
  name: z.string().min(1, '顧客名は必須です'),
  contact_name: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('メール形式が正しくありません').or(z.literal('')).optional(),
  postal_code: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: Customer | null
  onSaved: (customer: Customer) => void
}

export function CustomerDialog({ open, onOpenChange, customer, onSaved }: Props) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  useEffect(() => {
    if (open) {
      reset({
        name: customer?.name ?? '',
        contact_name: customer?.contact_name ?? '',
        phone: customer?.phone ?? '',
        email: customer?.email ?? '',
        postal_code: customer?.postal_code ?? '',
        address: customer?.address ?? '',
        notes: customer?.notes ?? '',
      })
    }
  }, [open, customer, reset])

  if (!open) return null

  async function onSubmit(data: FormData) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      name: data.name,
      contact_name: data.contact_name || null,
      phone: data.phone || null,
      email: data.email || null,
      postal_code: data.postal_code || null,
      address: data.address || null,
      notes: data.notes || null,
      user_id: user.id,
    }

    if (customer) {
      const { data: updated, error } = await supabase
        .from('customers')
        .update(payload)
        .eq('id', customer.id)
        .select()
        .single()
      if (!error && updated) onSaved(updated as Customer)
    } else {
      const { data: created, error } = await supabase
        .from('customers')
        .insert(payload)
        .select()
        .single()
      if (!error && created) onSaved(created as Customer)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => onOpenChange(false)} />
      <div className="relative z-50 w-full max-w-lg rounded-xl bg-background p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <h2 className="mb-4 text-lg font-semibold">
          {customer ? '顧客情報の編集' : '新規顧客登録'}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="space-y-1">
            <Label>顧客名 *</Label>
            <Input {...register('name')} placeholder="山田建設 株式会社" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>担当者名</Label>
              <Input {...register('contact_name')} placeholder="山田 太郎" />
            </div>
            <div className="space-y-1">
              <Label>電話番号</Label>
              <Input {...register('phone')} placeholder="03-1234-5678" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>メールアドレス</Label>
            <Input {...register('email')} type="email" placeholder="yamada@example.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>郵便番号</Label>
              <Input {...register('postal_code')} placeholder="123-4567" />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>住所</Label>
              <Input {...register('address')} placeholder="東京都渋谷区..." />
            </div>
          </div>
          <div className="space-y-1">
            <Label>備考</Label>
            <Textarea {...register('notes')} rows={2} />
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
