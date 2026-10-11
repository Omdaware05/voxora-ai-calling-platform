import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { EmptyState } from '../ui/empty-state'
import type {
  CallsOverTimePoint,
  DurationBucket,
  FunnelStage,
  OutcomeSlice,
} from '../../api/types'

const CHART_COLORS = ['#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#38bdf8', '#ec4899', '#94a3b8']

function ChartCard({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}): React.JSX.Element {
  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function CallsOverTimeChart({ data }: { data: CallsOverTimePoint[] }): React.JSX.Element {
  const hasData = data.some((d) => (d.calls ?? 0) > 0)
  return (
    <ChartCard title="Calls over time" className="col-span-2">
      {!hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No calls yet"
          description="Start a campaign to see call activity here."
        />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="calls"
                name="Calls"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="completed"
                name="Completed"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function OutcomeDonut({ data }: { data: OutcomeSlice[] }): React.JSX.Element {
  const total = data.reduce((sum, d) => sum + (d.value ?? 0), 0)
  return (
    <ChartCard title="Call outcomes">
      {total === 0 ? (
        <EmptyState title="No outcomes yet" description="Completed calls will appear here." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                label={({ name, percent }: { name?: string; percent?: number }) =>
                  `${name ?? ''} ${(((percent ?? 0) * 100) | 0)}%`
                }
                labelLine={false}
              >
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function DurationBars({ data }: { data: DurationBucket[] }): React.JSX.Element {
  const total = data.reduce((sum, d) => sum + (d.calls ?? 0), 0)
  return (
    <ChartCard title="Call durations">
      {total === 0 ? (
        <EmptyState title="No duration data" description="Durations will appear once calls complete." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="calls" name="Calls" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}

export function LeadFunnelChart({ data }: { data: FunnelStage[] }): React.JSX.Element {
  const total = data.reduce((sum, d) => sum + (d.count ?? 0), 0)
  return (
    <ChartCard title="Lead funnel">
      {total === 0 ? (
        <EmptyState title="No leads yet" description="Qualified leads will flow through this funnel." />
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 40, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" allowDecimals={false} />
              <YAxis type="category" dataKey="stage" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={90} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--card)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="count" name="Leads" radius={[0, 4, 4, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
