import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calcEstimatedSubtotal, calcProjectSummary } from '@/lib/calculations'
import type { LineItem, RoundingMode } from '@/types/database'
import { PrintTrigger } from './print-trigger'

const CATEGORY_LABELS: Record<string, string> = {
  material: '材料費',
  labor: '作業費・人工',
  transport: '交通費',
  other: 'その他',
}

function formatCurrency(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })
}

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: project }, { data: lineItems }] = await Promise.all([
    supabase.from('projects').select('*, customers(id, name)').eq('id', id).single(),
    supabase.from('line_items').select('*').eq('project_id', id).order('sort_order'),
  ])
  if (!project) notFound()

  const items: LineItem[] = lineItems ?? []
  const summary = calcProjectSummary(
    items,
    project.tax_rate,
    project.rounding_mode as RoundingMode,
    project.received_amount,
  )
  const categories = ['material', 'labor', 'transport', 'other'] as const
  const customer = (project as any).customers

  return (
    <>
      <PrintTrigger />

      {/*
        この div は印刷時のみ表示。
        globals.css の @media print で sidebar/header/ナビを非表示にする。
      */}
      <div className="print-estimate-view">
        <div className="min-h-screen bg-white p-8 text-sm text-gray-900">
          <div className="mx-auto max-w-3xl">

            {/* タイトル */}
            <h1 className="mb-8 text-center text-2xl font-bold tracking-widest">見　積　書</h1>

            {/* 宛先 + 発行情報 */}
            <div className="mb-6 flex justify-between items-start">
              <div>
                {customer?.name && (
                  <p className="text-lg font-semibold">{customer.name} 御中</p>
                )}
                {project.property_address && (
                  <p className="mt-1 text-gray-600">施工先: {project.property_address}</p>
                )}
              </div>
              <div className="text-right text-gray-700 space-y-0.5 text-sm">
                {project.estimated_at && <p>見積日: {formatDate(project.estimated_at)}</p>}
                {project.start_date && <p>着工予定: {formatDate(project.start_date)}</p>}
                {project.end_date && <p>完工予定: {formatDate(project.end_date)}</p>}
              </div>
            </div>

            {/* 案件名 */}
            <div className="mb-6 rounded border border-gray-300 px-4 py-2">
              <p className="text-base font-semibold">{project.title}</p>
              {project.description && (
                <p className="mt-1 text-gray-600">{project.description}</p>
              )}
            </div>

            {/* 明細テーブル（カテゴリ別） */}
            {categories.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              if (catItems.length === 0) return null

              return (
                <div key={cat} className="mb-5">
                  <h2 className="border border-gray-300 bg-gray-100 px-3 py-1 text-sm font-semibold">
                    {CATEGORY_LABELS[cat]}
                  </h2>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-gray-300 text-gray-600">
                        <th className="w-1/2 py-1.5 px-2 text-left font-medium">項目名</th>
                        <th className="w-16 py-1.5 px-2 text-right font-medium">数量</th>
                        <th className="w-12 py-1.5 px-1 text-left font-medium">単位</th>
                        <th className="w-24 py-1.5 px-2 text-right font-medium">単価(税抜)</th>
                        <th className="w-24 py-1.5 px-2 text-right font-medium">小計</th>
                      </tr>
                    </thead>
                    <tbody>
                      {catItems.map((item) => (
                        <tr key={item.id} className="border-b border-gray-200">
                          <td className="py-1.5 px-2">{item.name}</td>
                          <td className="py-1.5 px-2 text-right">
                            {item.quantity?.toLocaleString('ja-JP') ?? '—'}
                          </td>
                          <td className="py-1.5 px-1 text-gray-500">{item.unit ?? ''}</td>
                          <td className="py-1.5 px-2 text-right">
                            {item.unit_price != null ? formatCurrency(item.unit_price) : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-right font-medium">
                            {formatCurrency(calcEstimatedSubtotal(item))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-gray-300 bg-gray-50">
                        <td colSpan={4} className="py-1.5 px-2 text-right text-gray-500">
                          {CATEGORY_LABELS[cat]} 小計
                        </td>
                        <td className="py-1.5 px-2 text-right font-semibold">
                          {formatCurrency(summary[cat].estimatedSubtotal)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )
            })}

            {/* 合計サマリー */}
            <div className="mt-6 flex justify-end">
              <table className="w-72 border-collapse text-sm">
                <tbody>
                  <tr className="border-t-2 border-gray-900">
                    <td className="py-1.5 pr-4 text-gray-600">合計(税抜)</td>
                    <td className="py-1.5 text-right font-semibold">
                      {formatCurrency(summary.estimatedTotal)}
                    </td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td className="py-1.5 pr-4 text-gray-600">
                      消費税({Math.round(project.tax_rate * 100)}%)
                    </td>
                    <td className="py-1.5 text-right">{formatCurrency(summary.taxAmount)}</td>
                  </tr>
                  <tr className="border-t-2 border-gray-900 bg-gray-50">
                    <td className="py-2 pr-4 text-base font-bold">合計(税込)</td>
                    <td className="py-2 text-right text-base font-bold">
                      {formatCurrency(summary.estimatedTotalWithTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* 備考 */}
            {project.notes && (
              <div className="mt-8 border-t border-gray-200 pt-4">
                <p className="mb-1 font-semibold">備考</p>
                <p className="whitespace-pre-wrap text-gray-700">{project.notes}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
