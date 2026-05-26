import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { ProjectDetailClient } from './project-detail-client'

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: project },
    { data: lineItems },
    { data: customers },
    { data: workers },
    { data: workRecords },
  ] = await Promise.all([
    supabase.from('projects').select('*, customers(id, name)').eq('id', id).single(),
    supabase.from('line_items').select('*').eq('project_id', id).order('sort_order'),
    supabase.from('customers').select('id, name').order('name'),
    supabase.from('workers').select('*').order('name'),
    supabase.from('work_records').select('*, workers(id, name)').eq('project_id', id).order('work_date'),
  ])

  if (!project) notFound()

  return (
    <ProjectDetailClient
      project={project}
      initialLineItems={lineItems ?? []}
      customers={customers ?? []}
      workers={workers ?? []}
      initialWorkRecords={workRecords ?? []}
    />
  )
}
