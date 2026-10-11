import { api } from './client'
import type {
  AgentPerformance,
  AnalyticsOverview,
  CallsOverTimePoint,
  CampaignPerformance,
  DurationBucket,
  FunnelStage,
  OutcomeSlice,
  UsageSummary,
} from './types'

/* Raw backend envelopes (see backend/app/api/routes/analytics.py). */

interface SeriesPoint {
  date: string
  total: number
  completed: number
}
interface OutcomeRow {
  status: string
  count: number
}
interface DurationRow {
  bucket: string
  count: number
}
interface AgentRow {
  agent_id: number
  agent_name: string
  calls: number
  completed: number
  avg_duration_sec: number
  answer_rate: number
  interested: number
  qualified: number
}
interface CampaignRow {
  campaign_id: number
  campaign_name: string
  status: string
  total: number
  attempted: number
  answered: number
  interested: number
  qualified: number
}
interface FunnelRow {
  stage: string
  count: number
}

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const { data } = await api.get<AnalyticsOverview>('/v1/analytics/overview')
  return data
}

export async function getCallsOverTime(days = 30): Promise<CallsOverTimePoint[]> {
  const { data } = await api.get<{ days: number; series: SeriesPoint[] }>(
    '/v1/analytics/calls-over-time',
    { params: { days } },
  )
  return (data.series ?? []).map((p) => ({
    date: p.date,
    calls: p.total ?? 0,
    completed: p.completed ?? 0,
  }))
}

export async function getOutcomeBreakdown(): Promise<OutcomeSlice[]> {
  const { data } = await api.get<{ outcomes: OutcomeRow[] }>('/v1/analytics/outcomes')
  return (data.outcomes ?? []).map((o) => ({ name: o.status, value: o.count ?? 0 }))
}

export async function getDurationBuckets(): Promise<DurationBucket[]> {
  const { data } = await api.get<{ buckets: DurationRow[] }>('/v1/analytics/durations')
  return (data.buckets ?? []).map((b) => ({ range: b.bucket, calls: b.count ?? 0 }))
}

export async function getAgentPerformance(): Promise<AgentPerformance[]> {
  const { data } = await api.get<{ agents: AgentRow[] }>('/v1/analytics/agents')
  return (data.agents ?? []).map((a) => ({
    agent_id: String(a.agent_id),
    agent_name: a.agent_name,
    calls: a.calls ?? 0,
    answer_rate: a.answer_rate ?? 0,
    avg_duration_sec: a.avg_duration_sec ?? 0,
    interested: a.interested ?? 0,
    qualified: a.qualified ?? 0,
  }))
}

export async function getCampaignPerformance(): Promise<CampaignPerformance[]> {
  const { data } = await api.get<{ campaigns: CampaignRow[] }>('/v1/analytics/campaigns')
  return (data.campaigns ?? []).map((c) => ({
    campaign_id: String(c.campaign_id),
    campaign_name: c.campaign_name,
    status: c.status,
    total: c.total ?? 0,
    attempted: c.attempted ?? 0,
    answered: c.answered ?? 0,
    interested: c.interested ?? 0,
    qualified: c.qualified ?? 0,
  }))
}

export async function getLeadFunnel(): Promise<FunnelStage[]> {
  const { data } = await api.get<{ funnel: FunnelRow[] }>('/v1/analytics/lead-funnel')
  return (data.funnel ?? []).map((f) => ({ stage: f.stage, count: f.count ?? 0 }))
}

export async function getUsage(): Promise<UsageSummary> {
  const { data } = await api.get<UsageSummary>('/v1/usage')
  return data
}
