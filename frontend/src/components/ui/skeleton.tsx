import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} aria-hidden="true" />
}

export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }): React.JSX.Element {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-10 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function CardSkeleton(): React.JSX.Element {
  return (
    <div className="rounded-lg border bg-card p-6 shadow-sm">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="mt-3 h-9 w-20" />
      <Skeleton className="mt-2 h-4 w-48" />
    </div>
  )
}
