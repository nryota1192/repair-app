import type { LineItem, RoundingMode } from '@/types/database'

export interface CategorySummary {
  estimatedSubtotal: number
  actualSubtotal: number
}

export interface ProjectSummary {
  material: CategorySummary
  labor: CategorySummary
  transport: CategorySummary
  other: CategorySummary
  estimatedTotal: number
  actualTotal: number
  taxAmount: number
  estimatedTotalWithTax: number
  receivedAmountExTax: number | null
  plannedProfit: number | null
  actualProfit: number | null
}

function applyRounding(value: number, mode: RoundingMode): number {
  switch (mode) {
    case 'floor': return Math.floor(value)
    case 'ceil':  return Math.ceil(value)
    case 'round': return Math.round(value)
  }
}

export function calcEstimatedSubtotal(item: LineItem): number {
  const qty   = item.quantity   ?? 0
  const price = item.unit_price ?? 0
  return qty * price
}

/**
 * @param laborWorkRecordsTotal - work_records から算出した作業費実経費合計。
 *   指定した場合 labor.actualSubtotal として使用（line_items.actual_amount を無視）。
 */
export function calcProjectSummary(
  items: LineItem[],
  taxRate: number,
  roundingMode: RoundingMode,
  receivedAmount: number | null,
  laborWorkRecordsTotal?: number,
): ProjectSummary {
  const categories = ['material', 'labor', 'transport', 'other'] as const

  const summary = Object.fromEntries(
    categories.map((cat) => {
      const catItems = items.filter((i) => i.category === cat)
      const estimatedSubtotal = catItems.reduce((sum, i) => sum + calcEstimatedSubtotal(i), 0)
      // labor は work_records 合計で上書きする（指定されている場合）
      const actualSubtotal =
        cat === 'labor' && laborWorkRecordsTotal !== undefined
          ? laborWorkRecordsTotal
          : catItems.reduce((sum, i) => sum + (i.actual_amount ?? 0), 0)
      return [cat, { estimatedSubtotal, actualSubtotal }]
    }),
  ) as Record<(typeof categories)[number], CategorySummary>

  const estimatedTotal        = categories.reduce((sum, cat) => sum + summary[cat].estimatedSubtotal, 0)
  const actualTotal           = categories.reduce((sum, cat) => sum + summary[cat].actualSubtotal, 0)
  const taxAmount             = applyRounding(estimatedTotal * taxRate, roundingMode)
  const estimatedTotalWithTax = estimatedTotal + taxAmount

  let receivedAmountExTax: number | null = null
  let plannedProfit: number | null = null
  let actualProfit:  number | null = null

  if (receivedAmount !== null) {
    receivedAmountExTax = receivedAmount / (1 + taxRate)
    plannedProfit       = receivedAmountExTax - estimatedTotal
    actualProfit        = receivedAmountExTax - actualTotal
  } else {
    receivedAmountExTax = estimatedTotal
    plannedProfit       = 0
    actualProfit        = estimatedTotal - actualTotal
  }

  return {
    ...summary,
    estimatedTotal,
    actualTotal,
    taxAmount,
    estimatedTotalWithTax,
    receivedAmountExTax,
    plannedProfit,
    actualProfit,
  }
}
