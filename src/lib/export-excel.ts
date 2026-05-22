import * as XLSX from 'xlsx'
import type { LineItem, Project } from '@/types/database'
import { calcEstimatedSubtotal, calcProjectSummary } from './calculations'
import type { RoundingMode } from '@/types/database'

const CATEGORY_LABELS: Record<string, string> = {
  material: '材料費',
  labor: '作業費・人工',
  transport: '交通費',
  other: 'その他',
}

type ProjectWithCustomer = Project & { customers?: { id: string; name: string } | null }

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('ja-JP', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  })
}

export function exportEstimateToExcel(
  project: ProjectWithCustomer,
  lineItems: LineItem[],
) {
  const summary = calcProjectSummary(
    lineItems,
    project.tax_rate,
    project.rounding_mode as RoundingMode,
    project.received_amount,
  )

  const rows: (string | number)[][] = []

  // ── ヘッダー情報 ──
  rows.push(['見積書'])
  rows.push([])
  rows.push(['案件名', project.title])
  rows.push(['顧客名', project.customers?.name ?? ''])
  rows.push(['施工先', project.property_address ?? ''])
  rows.push(['見積日', formatDate(project.estimated_at)])
  if (project.start_date) rows.push(['着工予定', formatDate(project.start_date)])
  if (project.end_date) rows.push(['完工予定', formatDate(project.end_date)])
  rows.push([])

  // ── 明細ヘッダー ──
  rows.push(['カテゴリ', '項目名', '数量', '単位', '見積単価(税抜)', '見積小計'])

  // ── 明細行（カテゴリ別） ──
  const categories = ['material', 'labor', 'transport', 'other'] as const
  for (const cat of categories) {
    const items = lineItems.filter((i) => i.category === cat)
    if (items.length === 0) continue

    for (const item of items) {
      rows.push([
        CATEGORY_LABELS[cat],
        item.name,
        item.quantity ?? '',
        item.unit ?? '',
        item.unit_price ?? '',
        calcEstimatedSubtotal(item),
      ])
    }

    // カテゴリ小計
    rows.push([
      '',
      `【${CATEGORY_LABELS[cat]} 小計】`,
      '',
      '',
      '',
      summary[cat].estimatedSubtotal,
    ])
    rows.push([])
  }

  // ── 合計 ──
  rows.push(['', '', '', '', '合計(税抜)', summary.estimatedTotal])
  rows.push(['', '', '', '', `消費税(${Math.round(project.tax_rate * 100)}%)`, summary.taxAmount])
  rows.push(['', '', '', '', '合計(税込)', summary.estimatedTotalWithTax])
  if (project.received_amount != null) {
    rows.push(['', '', '', '', '受注金額(税込)', project.received_amount])
  }

  // ── ワークブック作成 ──
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // 列幅設定
  ws['!cols'] = [
    { wch: 14 }, // カテゴリ
    { wch: 30 }, // 項目名
    { wch: 8 },  // 数量
    { wch: 8 },  // 単位
    { wch: 16 }, // 見積単価
    { wch: 16 }, // 見積小計
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, '見積書')

  const filename = `見積書_${project.title}_${formatDate(project.estimated_at) || formatDate(new Date().toISOString())}.xlsx`
  XLSX.writeFile(wb, filename)
}
