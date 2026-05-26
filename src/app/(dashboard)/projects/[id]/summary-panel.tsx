'use client'

import { useState, useEffect } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { calcProjectSummary } from '@/lib/calculations'
import { Input } from '@/components/ui/input'
import type { LineItem, RoundingMode } from '@/types/database'

interface Props {
  lineItems: LineItem[]
  taxRate: number
  roundingMode: RoundingMode
  receivedAmount: number | null
  workRecordsTotal: number
  onReceivedAmountChange: (value: number | null) => void
}

const CATEGORY_LABELS = {
  material: '材料費',
  labor: '作業費(人工)',
  transport: '交通費',
  other: 'その他',
} as const

export function SummaryPanel({
  lineItems,
  taxRate,
  roundingMode,
  receivedAmount,
  workRecordsTotal,
  onReceivedAmountChange,
}: Props) {
  const [receivedInput, setReceivedInput] = useState(
    receivedAmount != null ? String(receivedAmount) : '',
  )
  // Mobile: collapsed by default so line-item input area stays large
  const [mobileExpanded, setMobileExpanded] = useState(false)

  useEffect(() => {
    setReceivedInput(receivedAmount != null ? String(receivedAmount) : '')
  }, [receivedAmount])

  const summary = calcProjectSummary(lineItems, taxRate, roundingMode, receivedAmount, workRecordsTotal)

  function handleReceivedBlur() {
    const num = receivedInput ? Number(receivedInput) : null
    if (num !== receivedAmount) {
      onReceivedAmountChange(num)
    }
  }

  return (
    <div className="sticky bottom-0 rounded-xl border bg-background shadow-lg">

      {/* ── Mobile: compact bar (always visible) ── */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 md:hidden"
        onClick={() => setMobileExpanded((v) => !v)}
      >
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">合計(税込)</span>
          <span className="font-semibold">{formatCurrency(summary.estimatedTotalWithTax)}</span>
          {summary.plannedProfit != null && (
            <>
              <span className="text-muted-foreground">予定利益</span>
              <ProfitAmount value={summary.plannedProfit} />
            </>
          )}
        </div>
        {mobileExpanded
          ? <ChevronDown className="size-4 text-muted-foreground shrink-0" />
          : <ChevronUp className="size-4 text-muted-foreground shrink-0" />
        }
      </button>

      {/* ── Mobile: expanded detail ── */}
      {mobileExpanded && (
        <div className="border-t md:hidden px-4 py-3 space-y-3">
          {/* Category subtotals */}
          <div className="space-y-1 text-sm">
            {(['material', 'labor', 'transport', 'other'] as const).map((cat) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-muted-foreground">{CATEGORY_LABELS[cat]}</span>
                <div className="text-right">
                  <span className="font-medium">{formatCurrency(summary[cat].estimatedSubtotal)}</span>
                  {cat === 'labor' ? (
                    workRecordsTotal > 0 && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        実 {formatCurrency(workRecordsTotal)}
                      </span>
                    )
                  ) : (
                    lineItems.filter((i) => i.category === cat).some((i) => i.actual_amount != null) && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        実 {formatCurrency(summary[cat].actualSubtotal)}
                      </span>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t pt-3 space-y-1.5 text-sm">
            <div className="flex justify-between font-semibold">
              <span>合計(税抜)</span>
              <div className="text-right">
                <span>{formatCurrency(summary.estimatedTotal)}</span>
                {summary.actualTotal > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    実 {formatCurrency(summary.actualTotal)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>消費税({Math.round(taxRate * 100)}%)</span>
              <span>{formatCurrency(summary.taxAmount)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>合計(税込)</span>
              <span>{formatCurrency(summary.estimatedTotalWithTax)}</span>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm">受注金額(税込)</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-sm text-muted-foreground">¥</span>
                <Input
                  className="h-8 w-32 text-right text-sm"
                  type="number"
                  placeholder="未入力"
                  value={receivedInput}
                  onChange={(e) => setReceivedInput(e.target.value)}
                  onBlur={handleReceivedBlur}
                  onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">予定利益</span>
              <ProfitAmount value={summary.plannedProfit} />
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold">実利益</span>
              <ProfitAmount value={summary.actualProfit} />
            </div>
          </div>
        </div>
      )}

      {/* ── Desktop: full table (unchanged) ── */}
      <div className="hidden md:block">
        <div className="border-b px-4 py-2">
          <h2 className="font-semibold">集計サマリー</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 pl-4 text-left font-medium">項目</th>
                <th className="py-2 pr-4 text-right font-medium">見積</th>
                <th className="py-2 pr-4 text-right font-medium">実経費</th>
              </tr>
            </thead>
            <tbody>
              {(['material', 'labor', 'transport', 'other'] as const).map((cat) => (
                <tr key={cat} className="border-b last:border-0">
                  <td className="py-1.5 pl-4 text-muted-foreground">{CATEGORY_LABELS[cat]}</td>
                  <td className="py-1.5 pr-4 text-right">{formatCurrency(summary[cat].estimatedSubtotal)}</td>
                  <td className="py-1.5 pr-4 text-right">
                    {cat === 'labor'
                      ? workRecordsTotal > 0
                        ? formatCurrency(workRecordsTotal)
                        : <span className="text-muted-foreground/50">—</span>
                      : lineItems.filter((i) => i.category === cat).some((i) => i.actual_amount != null)
                        ? formatCurrency(summary[cat].actualSubtotal)
                        : <span className="text-muted-foreground/50">—</span>
                    }
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/20 font-semibold">
                <td className="py-2 pl-4">合計(税抜)</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(summary.estimatedTotal)}</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(summary.actualTotal)}</td>
              </tr>
              <tr className="border-b text-muted-foreground">
                <td className="py-1.5 pl-4">消費税({Math.round(taxRate * 100)}%)</td>
                <td className="py-1.5 pr-4 text-right">{formatCurrency(summary.taxAmount)}</td>
                <td className="py-1.5 pr-4 text-right text-muted-foreground/50">—</td>
              </tr>
              <tr className="border-b font-semibold">
                <td className="py-2 pl-4">合計(税込)</td>
                <td className="py-2 pr-4 text-right">{formatCurrency(summary.estimatedTotalWithTax)}</td>
                <td className="py-2 pr-4 text-right text-muted-foreground/50">—</td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pl-4">受注金額(税込)</td>
                <td className="py-2 pr-4 text-right" colSpan={2}>
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-muted-foreground">¥</span>
                    <Input
                      className="h-7 w-36 text-right text-sm"
                      type="number"
                      placeholder="未入力"
                      value={receivedInput}
                      onChange={(e) => setReceivedInput(e.target.value)}
                      onBlur={handleReceivedBlur}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                    />
                  </div>
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 pl-4 font-semibold">
                  予定利益
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    = 受注金額(税抜) − 見積合計(税抜)
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-semibold" colSpan={2}>
                  <ProfitAmount value={summary.plannedProfit} />
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 font-semibold">
                  実利益
                  <span className="ml-1 text-xs font-normal text-muted-foreground">
                    = 受注金額(税抜) − 実経費合計
                  </span>
                </td>
                <td className="py-2 pr-4 text-right font-semibold" colSpan={2}>
                  <ProfitAmount value={summary.actualProfit} />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}

function ProfitAmount({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn('font-semibold', value >= 0 ? 'text-green-600' : 'text-destructive')}>
      {formatCurrency(value)}
    </span>
  )
}
