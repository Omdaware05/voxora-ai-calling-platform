import { Badge } from '../ui/badge'

const STATUS_VARIANTS: Record<string, 'success' | 'warning' | 'destructive' | 'info' | 'secondary' | 'muted'> = {
  // calls
  completed: 'success',
  in_progress: 'info',
  ringing: 'info',
  queued: 'muted',
  failed: 'destructive',
  busy: 'warning',
  no_answer: 'warning',
  cancelled: 'muted',
  // agents / campaigns
  active: 'success',
  running: 'success',
  paused: 'warning',
  draft: 'muted',
  scheduled: 'info',
  stopped: 'destructive',
  // questionnaires / misc
  published: 'success',
  archived: 'muted',
  // leads
  new: 'info',
  contacted: 'info',
  interested: 'success',
  qualified: 'success',
  converted: 'success',
  lost: 'destructive',
  // follow-ups
  pending: 'warning',
  overdue: 'destructive',
  // generic
  enabled: 'success',
  disabled: 'muted',
  connected: 'success',
  error: 'destructive',
}

function prettify(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function StatusBadge({ status, className }: { status: string; className?: string }): React.JSX.Element {
  const variant = STATUS_VARIANTS[status.toLowerCase()] ?? 'secondary'
  return (
    <Badge variant={variant} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {prettify(status)}
    </Badge>
  )
}
