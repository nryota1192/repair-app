import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { calcEstimatedSubtotal, calcProjectSummary } from '@/lib/calculations'
import type { LineItem, RoundingMode } from '@/types/database'
import { PrintTrigger } from './print-trigger'

const CATEGORY_LABELS: Record<string, string> = {
  material: '材料費',
  labor: '作業費',
  transport: '交通費',
  other: 'その他',
}

function fmtYen(v: number | null | undefined) {
  if (v == null) return '—'
  return v.toLocaleString('ja-JP', { style: 'currency', currency: 'JPY' })
}

function fmtDate(dateStr: string | null | undefined) {
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
  // PDF には実経費を表示しないため laborWorkRecordsTotal は渡さない
  const summary = calcProjectSummary(items, project.tax_rate, project.rounding_mode as RoundingMode, project.received_amount)
  const categories = ['material', 'labor', 'transport', 'other'] as const
  const customer = (project as any).customers

  // 見積番号: project.id の先頭8文字を大文字化
  const estimateNumber = project.id.replace(/-/g, '').slice(0, 8).toUpperCase()

  return (
    <>
      <PrintTrigger />

      <div className="print-estimate-view">
        <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: "'Hiragino Kaku Gothic ProN', 'Noto Sans JP', sans-serif" }}>
          <div className="mx-auto max-w-[210mm] px-10 py-10 text-sm">

            {/* ── タイトル ── */}
            <h1 className="text-center text-3xl font-bold mb-6 tracking-[0.3em]">見　積　書</h1>

            {/* ── 御見積金額（最上部に大きく表示） ── */}
            <div className="border-2 border-gray-800 rounded-sm px-6 py-4 mb-8 text-center">
              <p className="text-xs text-gray-500 mb-1">御見積金額（消費税込）</p>
              <p className="text-4xl font-bold tracking-tight">
                {fmtYen(summary.estimatedTotalWithTax)}
              </p>
            </div>

            {/* ── 見積番号・見積日 ── */}
            <div className="flex justify-between items-start mb-6 text-sm">
              <div />
              <div className="text-right space-y-0.5 text-gray-700">
                <p>見積番号: {estimateNumber}</p>
                {project.estimated_at && <p>見積日: {fmtDate(project.estimated_at)}</p>}
              </div>
            </div>

            {/* ── 顧客情報 ── */}
            <div className="mb-6">
              {customer?.name && (
                <p className="text-xl font-semibold border-b border-gray-800 pb-1 inline-block pr-8">
                  {customer.name} 御中
                </p>
              )}
            </div>

            {/* ── 案件情報 ── */}
            <div className="mb-6 space-y-1 text-sm">
              <div className="flex gap-3">
                <span className="text-gray-500 w-16 shrink-0">件　名</span>
                <span className="font-medium">{project.title}</span>
              </div>
              {project.property_address && (
                <div className="flex gap-3">
                  <span className="text-gray-500 w-16 shrink-0">物件住所</span>
                  <span>{project.property_address}</span>
                </div>
              )}
              {(project.start_date || project.end_date) && (
                <div className="flex gap-3">
                  <span className="text-gray-500 w-16 shrink-0">工　期</span>
                  <span>
                    {fmtDate(project.start_date)}
                    {project.start_date && project.end_date && ' 〜 '}
                    {fmtDate(project.end_date)}
                  </span>
                </div>
              )}
            </div>

            {/* ── 明細（カテゴリ別） ── */}
            <div className="mb-6">
              <div className="border-t-2 border-gray-800 mb-2" />
              {categories.map((cat) => {
                const catItems = items.filter((i) => i.category === cat)
                if (catItems.length === 0) return null
                const subtotal = summary[cat].estimatedSubtotal

                return (
                  <div key={cat} className="mb-4">
                    <h2 className="font-semibold bg-gray-100 px-3 py-1 text-sm border border-gray-300">
                      【{CATEGORY_LABELS[cat]}】
                    </h2>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-gray-300 text-gray-600 text-xs">
                          <th className="text-left py-1 px-2 font-medium w-1/2">項目名</th>
                          <th className="text-right py-1 px-1 font-medium w-14">数量</th>
                          <th className="text-left py-1 px-1 font-medium w-10">単位</th>
                          <th className="text-right py-1 px-2 font-medium w-24">単価(税抜)</th>
                          <th className="text-right py-1 px-2 font-medium w-24">金額</th>
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((item) => (
                          <tr key={item.id} className="border-b border-gray-100">
                            <td className="py-1.5 px-2">{item.name}</td>
                            <td className="py-1.5 px-1 text-right">
                              {item.quantity?.toLocaleString('ja-JP') ?? '—'}
                            </td>
                            <td className="py-1.5 px-1 text-gray-500 text-xs">{item.unit ?? ''}</td>
                            <td className="py-1.5 px-2 text-right">
                              {item.unit_price != null ? fmtYen(item.unit_price) : '—'}
                            </td>
                            <td className="py-1.5 px-2 text-right font-medium">
                              {fmtYen(calcEstimatedSubtotal(item))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-300 bg-gray-50">
                          <td colSpan={4} className="py-1.5 px-2 text-right text-gray-500 text-xs">
                            小計
                          </td>
                          <td className="py-1.5 px-2 text-right font-semibold">
                            {fmtYen(subtotal)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )
              })}
              <div className="border-t border-gray-300 mt-2" />
            </div>

            {/* ── 合計 ── */}
            <div className="flex justify-end mb-8">
              <table className="w-72 border-collapse text-sm">
                <tbody>
                  <tr className="border-t border-gray-300">
                    <td className="py-1.5 pr-4 text-gray-600">小計（税抜）</td>
                    <td className="py-1.5 text-right">{fmtYen(summary.estimatedTotal)}</td>
                  </tr>
                  <tr className="border-t border-gray-300">
                    <td className="py-1.5 pr-4 text-gray-600">
                      消費税（{Math.round(project.tax_rate * 100)}%）
                    </td>
                    <td className="py-1.5 text-right">{fmtYen(summary.taxAmount)}</td>
                  </tr>
                  <tr className="border-t-2 border-gray-800 bg-gray-50">
                    <td className="py-2 pr-4 font-bold text-base">合計（税込）</td>
                    <td className="py-2 text-right font-bold text-base">
                      {fmtYen(summary.estimatedTotalWithTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* ── 備考 ── */}
            {project.description && (
              <div className="border-t border-gray-200 pt-4">
                <p className="font-semibold mb-1 text-sm">備考</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{project.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
