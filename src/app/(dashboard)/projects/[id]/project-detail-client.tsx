'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, FileSpreadsheet, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { ProjectStatusBadge } from '@/components/projects/project-status-badge'
import { LineItemsSection } from './line-items-section'
import { WorkRecordsSection } from './work-records-section'
import { SummaryPanel } from './summary-panel'
import { ProjectEditDialog } from './project-edit-dialog'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'
import { exportEstimateToExcel } from '@/lib/export-excel'
import type { LineItem, Project, Worker, WorkRecord } from '@/types/database'

type ProjectWithCustomer = Project & { customers: { id: string; name: string } }

interface Props {
  project: ProjectWithCustomer
  initialLineItems: LineItem[]
  customers: { id: string; name: string }[]
  workers: Worker[]
  initialWorkRecords: WorkRecord[]
}

export function ProjectDetailClient({
  project: initialProject,
  initialLineItems,
  customers,
  workers,
  initialWorkRecords,
}: Props) {
  const [project, setProject] = useState(initialProject)
  const [lineItems, setLineItems] = useState(initialLineItems)
  const [workRecords, setWorkRecords] = useState(initialWorkRecords)
  const [editOpen, setEditOpen] = useState(false)

  const workRecordsTotal = workRecords.reduce((sum, r) => sum + r.daily_wage, 0)

  async function handleReceivedAmountChange(value: number | null) {
    const supabase = createClient()
    const { data, error } = await supabase
      .from('projects')
      .update({ received_amount: value })
      .eq('id', project.id)
      .select('*, customers(id, name)')
      .single()
    if (!error && data) {
      setProject(data as ProjectWithCustomer)
      toast.success('受注金額を更新しました')
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start gap-3">
        <Link href="/projects" className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })}>
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold truncate">{project.title}</h1>
            <ProjectStatusBadge status={project.status} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span>
              顧客:{' '}
              <Link href={`/customers/${project.customers?.id}`} className="hover:underline">
                {project.customers?.name ?? '—'}
              </Link>
            </span>
            {project.property_address && <span>施工先: {project.property_address}</span>}
            {project.estimated_at && <span>見積日: {formatDate(project.estimated_at)}</span>}
            {project.start_date && <span>着工: {formatDate(project.start_date)}</span>}
            {project.end_date && <span>完工: {formatDate(project.end_date)}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportEstimateToExcel(project, lineItems)}
          >
            <FileSpreadsheet className="size-4" />
            <span className="hidden sm:inline">Excel</span>出力
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open(`/projects/${project.id}/print`, '_blank')}
          >
            <Printer className="size-4" />
            <span className="hidden sm:inline">見積PDF</span>出力
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Settings className="size-4" />
            <span className="hidden sm:inline">案件編集</span>
          </Button>
        </div>
      </div>

      {/* Line items by category */}
      <div className="space-y-4">
        {/* 材料費 */}
        <LineItemsSection
          category="material"
          projectId={project.id}
          userId={project.user_id}
          defaultLaborUnitPrice={project.default_labor_unit_price}
          lineItems={lineItems.filter((i) => i.category === 'material')}
          onItemsChange={(updated) =>
            setLineItems((prev) => [...prev.filter((i) => i.category !== 'material'), ...updated])
          }
        />

        {/* 作業費・人工（実経費列なし） */}
        <LineItemsSection
          category="labor"
          projectId={project.id}
          userId={project.user_id}
          defaultLaborUnitPrice={project.default_labor_unit_price}
          lineItems={lineItems.filter((i) => i.category === 'labor')}
          onItemsChange={(updated) =>
            setLineItems((prev) => [...prev.filter((i) => i.category !== 'labor'), ...updated])
          }
        />

        {/* 出勤記録セクション（作業費の直下） */}
        <WorkRecordsSection
          projectId={project.id}
          userId={project.user_id}
          workers={workers}
          workRecords={workRecords}
          onRecordsChange={setWorkRecords}
        />

        {/* 交通費 */}
        <LineItemsSection
          category="transport"
          projectId={project.id}
          userId={project.user_id}
          defaultLaborUnitPrice={project.default_labor_unit_price}
          lineItems={lineItems.filter((i) => i.category === 'transport')}
          onItemsChange={(updated) =>
            setLineItems((prev) => [...prev.filter((i) => i.category !== 'transport'), ...updated])
          }
        />

        {/* その他 */}
        <LineItemsSection
          category="other"
          projectId={project.id}
          userId={project.user_id}
          defaultLaborUnitPrice={project.default_labor_unit_price}
          lineItems={lineItems.filter((i) => i.category === 'other')}
          onItemsChange={(updated) =>
            setLineItems((prev) => [...prev.filter((i) => i.category !== 'other'), ...updated])
          }
        />
      </div>

      {/* Summary panel */}
      <SummaryPanel
        lineItems={lineItems}
        taxRate={project.tax_rate}
        roundingMode={project.rounding_mode}
        receivedAmount={project.received_amount}
        workRecordsTotal={workRecordsTotal}
        onReceivedAmountChange={handleReceivedAmountChange}
      />

      <ProjectEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        customers={customers}
        onSaved={(p) => {
          setProject(p as ProjectWithCustomer)
          setEditOpen(false)
          toast.success('案件情報を更新しました')
        }}
      />
    </div>
  )
}
