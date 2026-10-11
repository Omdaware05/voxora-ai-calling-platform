import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  Coins,
  HeartHandshake,
  Percent,
  PhoneCall,
  PhoneOutgoing,
  Radio,
  Star,
  Timer,
} from 'lucide-react'
import {
  getAgentPerformance,
  getAnalyticsOverview,
  getCallsOverTime,
  getCampaignPerformance,
  getDurationBuckets,
  getLeadFunnel,
  getOutcomeBreakdown,
} from '../api/analytics'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { EmptyState } from '../components/ui/empty-state'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { formatPercent, formatSeconds } from '../lib/utils'
import {
  CallsOverTimeChart,
  DurationBars,
  LeadFunnelChart,
  OutcomeDonut,
} from '../components/charts/DashboardCharts'

function normPaged<T>(data: { items: T[] } | T[] | undefined): T[] {
  if (!data) return []
  return Array.isArray(data) ? data : (data.items ?? [])
}

export function Dashboard(): React.JSX.Element {
  const overview = useQuery({ queryKey: ['analytics', 'overview'], queryFn: getAnalyticsOverview })
  const overTime = useQuery({ queryKey: ['analytics', 'calls-over-time'], queryFn: () => getCallsOverTime(30) })
  const outcomes = useQuery({ queryKey: ['analytics', 'outcomes'], queryFn: getOutcomeBreakdown })
  const durations = useQuery({ queryKey: ['analytics', 'durations'], queryFn: getDurationBuckets })
  const agents = useQuery({ queryKey: ['analytics', 'agents'], queryFn: getAgentPerformance })
  const campaigns = useQuery({ queryKey: ['analytics', 'campaigns'], queryFn: getCampaignPerformance })
  const funnel = useQuery({ queryKey: ['analytics', 'funnel'], queryFn: getLeadFunnel })

  const o = overview.data
  const loading = overview.isLoading
  const navigate = useNavigate()

  const statCards = [
    { title: 'Calls today', value: o?.calls_today ?? 0, icon: PhoneCall },
    { title: 'Completed', value: o?.completed_calls ?? 0, icon: CheckCircle2 },
    { title: 'Active calls', value: o?.active_calls ?? 0, icon: Radio },
    { title: 'Answer rate', value: formatPercent(o?.answer_rate), icon: Percent },
    { title: 'Avg duration', value: formatSeconds(o?.avg_duration_sec), icon: Timer },
    { title: 'Interested leads', value: o?.interested_leads ?? 0, icon: HeartHandshake },
    { title: 'Qualified leads', value: o?.qualified_leads ?? 0, icon: Star },
    { title: 'Follow-ups due', value: o?.followups_due ?? 0, icon: CalendarClock },
    { title: 'AI usage', value: `${Math.round(o?.ai_usage_minutes ?? 0)} min`, icon: Clock3 },
    {
      title: 'Est. cost',
      value: `$${(o?.est_cost ?? 0).toFixed(2)}`,
      icon: Coins,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your AI voice calling operations."
      />

      {overview.isError ? (
        <ErrorState error={overview.error} onRetry={() => void overview.refetch()} title="Failed to load dashboard" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {statCards.map((s) => (
              <StatCard key={s.title} title={s.title} value={s.value} icon={s.icon} loading={loading} />
            ))}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {overTime.isLoading ? (
              <Card className="col-span-2"><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            ) : overTime.isError ? (
              <ErrorState className="col-span-2" error={overTime.error} onRetry={() => void overTime.refetch()} />
            ) : (
              <CallsOverTimeChart data={overTime.data ?? []} />
            )}
            {outcomes.isLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            ) : outcomes.isError ? (
              <ErrorState error={outcomes.error} onRetry={() => void outcomes.refetch()} />
            ) : (
              <OutcomeDonut data={outcomes.data ?? []} />
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {durations.isLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            ) : durations.isError ? (
              <ErrorState error={durations.error} onRetry={() => void durations.refetch()} />
            ) : (
              <DurationBars data={durations.data ?? []} />
            )}
            {funnel.isLoading ? (
              <Card><CardContent className="p-6"><Skeleton className="h-64 w-full" /></CardContent></Card>
            ) : funnel.isError ? (
              <ErrorState error={funnel.error} onRetry={() => void funnel.refetch()} />
            ) : (
              <LeadFunnelChart data={funnel.data ?? []} />
            )}
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Agent performance</CardTitle>
              </CardHeader>
              <CardContent>
                {agents.isLoading ? (
                  <TableSkeleton rows={4} cols={4} />
                ) : agents.isError ? (
                  <ErrorState error={agents.error} onRetry={() => void agents.refetch()} />
                ) : normPaged(agents.data).length === 0 ? (
                  <EmptyState title="No agent data yet" description="Create an agent and start calling." actionLabel="Go to Agents" onAction={() => navigate('/agents')} />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Agent</TableHead>
                        <TableHead className="text-right">Calls</TableHead>
                        <TableHead className="text-right">Answer rate</TableHead>
                        <TableHead className="text-right">Interested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normPaged(agents.data).slice(0, 6).map((a) => (
                        <TableRow key={a.agent_id}>
                          <TableCell>
                            <Link to={`/agents/${a.agent_id}`} className="font-medium text-primary hover:underline">
                              {a.agent_name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{a.calls}</TableCell>
                          <TableCell className="text-right tabular-nums">{formatPercent(a.answer_rate)}</TableCell>
                          <TableCell className="text-right tabular-nums">{a.interested}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                {campaigns.isLoading ? (
                  <TableSkeleton rows={4} cols={4} />
                ) : campaigns.isError ? (
                  <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
                ) : normPaged(campaigns.data).length === 0 ? (
                  <EmptyState
                    icon={PhoneOutgoing}
                    title="No campaigns yet"
                    description="Launch your first outbound campaign to reach customers at scale."
                  />
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Progress</TableHead>
                        <TableHead className="text-right">Interested</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {normPaged(campaigns.data).slice(0, 6).map((c) => (
                        <TableRow key={c.campaign_id}>
                          <TableCell>
                            <Link to={`/campaigns/${c.campaign_id}`} className="font-medium text-primary hover:underline">
                              {c.campaign_name}
                            </Link>
                          </TableCell>
                          <TableCell><StatusBadge status={c.status} /></TableCell>
                          <TableCell className="text-right tabular-nums">
                            {c.attempted}/{c.total}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{c.interested}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
