import { Badge } from '@/components/ui/badge'
import type { ProjectStatus } from '@/types/database'

const STATUS_MAP: Record<ProjectStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  estimating: { label: '見積中', variant: 'secondary' },
  won: { label: '受注', variant: 'default' },
  in_progress: { label: '施工中', variant: 'default' },
  completed: { label: '完工', variant: 'outline' },
  lost: { label: '失注', variant: 'destructive' },
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const { label, variant } = STATUS_MAP[status]
  return <Badge variant={variant}>{label}</Badge>
}
