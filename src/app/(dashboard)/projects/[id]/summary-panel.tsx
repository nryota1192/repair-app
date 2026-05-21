'use client'

import { useState, useEffect } from 'react'
import { cn, formatCurrency } from '@/lib/utils'
import { calcProjectSummary } from '@/lib/calculations'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { LineItem, RoundingMode } from '@/types/database'

interface Props {
  lineItems: LineItem[]
  taxRate: number
  roundingMode: RoundingMode
  receivedAmount: number | null
  onReceivedAmountChange: (value: number | null) => void
}

export function SummaryPanel({
  lineItems,
  taxRate,
  roundingMode,
  receivedAmount,
  onReceivedAmountChange,
}: Props) {
  const [receivedInput, setReceivedInput] = useState(
    receivedAmount != null ? String(receivedAmount) : '',
  )

  useEffect(() => {
    setReceivedInput(receivedAmount != null ? String(receivedAmount) : '')
  }, [receivedAmount])

  const summary = calcProjectSummary(lineItems, taxRate, roundingMode, receivedAmount)

  function handleReceivedBlur() {
    const num = receivedInput ? Number(receivedInput) : null
    if (num !== receivedAmount) {
      onReceivedAmountChange(num)
    }
  }

  const CATEGORY_LABELS = {
    material: '材料費',
    labor: '作業費(人工)',
    transport: '交通費',
    other: 'その他',
  } as const

  return (
    <div className="sticky bottom-0 rounded-xl border bg-background shadow-lg">
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
                  {lineItems.filter((i) => i.category === cat).some((i) => i.actual_amount != null)
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
  )
}

function ProfitAmount({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>
  return (
    <span className={cn(value >= 0 ? 'text-green-600' : 'text-destructive')}>
      {formatCurrency(value)}
    </span>
  )
}
