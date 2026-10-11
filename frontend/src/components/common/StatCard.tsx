import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '../ui/card'
import { Skeleton } from '../ui/skeleton'

interface StatCardProps {
  title: string
  value: string | number
  icon?: LucideIcon
  description?: string
  loading?: boolean
}

export function StatCard({ title, value, icon: Icon, description, loading }: StatCardProps): React.JSX.Element {
  return (
    <Card>
      <CardContent className="p-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">{title}</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
              {description && <p className="mt-1 text-xs text-muted-foreground">{description}</p>}
            </div>
            {Icon && (
              <div className="flex size-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
