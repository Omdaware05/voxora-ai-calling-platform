import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  getAgentPerformance,
  getCallsOverTime,
  getCampaignPerformance,
  getDurationBuckets,
  getLeadFunnel,
  getOutcomeBreakdown,
  getUsage,
} from '../api/analytics'
import { PageHeader } from '../components/layout/PageHeader'
import { StatCard } from '../components/common/StatCard'
import { StatusBadge } from '../components/common/StatusBadge'
import { ErrorState } from '../components/common/ErrorState'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Skeleton, TableSkeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { Select } from '../components/ui/select'
import { Label } from '../components/ui/label'
import { formatPercent, formatSeconds } from '../lib/utils'
import {
  CallsOverTimeChart,
  DurationBars,
  LeadFunnelChart,
  OutcomeDonut,
} from '../components/charts/DashboardCharts'

export function Analytics(): React.JSX.Element {
  const [days, setDays] = useState(30)

  const overTime = useQuery({ queryKey: ['analytics', 'calls-over-time', days], queryFn: () => getCallsOverTime(days) })
  const outcomes = useQuery({ queryKey: ['analytics', 'outcomes'], queryFn: getOutcomeBreakdown })
  const durations = useQuery({ queryKey: ['analytics', 'durations'], queryFn: getDurationBuckets })
  const agents = useQuery({ queryKey: ['analytics', 'agents'], queryFn: getAgentPerformance })
  const campaigns = useQuery({ queryKey: ['analytics', 'campaigns'], queryFn: getCampaignPerformance })
  const funnel = useQuery({ queryKey: ['analytics', 'funnel'], queryFn: getLeadFunnel })
  const usage = useQuery({ queryKey: ['usage'], queryFn: getUsage })

  const agentRows = Array.isArray(agents.data) ? agents.data : (agents.data ?? [])
  const campaignRows = Array.isArray(campaigns.data) ? campaigns.data : (campaigns.data ?? [])

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Deep dive into call performance, agents and campaigns."
        actions={
          <div className="flex items-center gap-2">
            <Label htmlFor="analytics-days" className="text-sm text-muted-foreground">Range</Label>
            <Select id="analytics-days" value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="w-32">
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </Select>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard title="AI usage" value={`${Math.round(usage.data?.ai_usage_minutes ?? 0)} min`} loading={usage.isLoading} description={usage.data?.period ?? undefined} />
        <StatCard title="Estimated cost" value={`$${(usage.data?.est_cost ?? 0).toFixed(2)}`} loading={usage.isLoading} />
        <StatCard title="Calls (period)" value={usage.data?.calls ?? 0} loading={usage.isLoading} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
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

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Per-agent performance</CardTitle></CardHeader>
        <CardContent>
          {agents.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : agents.isError ? (
            <ErrorState error={agents.error} onRetry={() => void agents.refetch()} />
          ) : agentRows.length === 0 ? (
            <EmptyState title="No agent data" description="Agent metrics will appear once calls are made." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agent</TableHead>
                  <TableHead className="text-right">Calls</TableHead>
                  <TableHead className="text-right">Answer rate</TableHead>
                  <TableHead className="text-right">Avg duration</TableHead>
                  <TableHead className="text-right">Interested</TableHead>
                  <TableHead className="text-right">Qualified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agentRows.map((a) => (
                  <TableRow key={a.agent_id}>
                    <TableCell>
                      <Link to={`/agents/${a.agent_id}`} className="font-medium text-primary hover:underline">{a.agent_name}</Link>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{a.calls}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPercent(a.answer_rate)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatSeconds(a.avg_duration_sec)}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.interested}</TableCell>
                    <TableCell className="text-right tabular-nums">{a.qualified}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader className="pb-2"><CardTitle className="text-base">Per-campaign performance</CardTitle></CardHeader>
        <CardContent>
          {campaigns.isLoading ? (
            <TableSkeleton rows={5} cols={6} />
          ) : campaigns.isError ? (
            <ErrorState error={campaigns.error} onRetry={() => void campaigns.refetch()} />
          ) : campaignRows.length === 0 ? (
            <EmptyState title="No campaign data" description="Campaign metrics will appear once campaigns run." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Attempted</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Interested</TableHead>
                  <TableHead className="text-right">Qualified</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaignRows.map((c) => (
                  <TableRow key={c.campaign_id}>
                    <TableCell>
                      <Link to={`/campaigns/${c.campaign_id}`} className="font-medium text-primary hover:underline">{c.campaign_name}</Link>
                    </TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-right tabular-nums">{c.total}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.attempted}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.answered}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.interested}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.qualified}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
