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

export async function getAnalyticsOverview(): Promise<AnalyticsOverview> {
  const { data } = await api.get<AnalyticsOverview>('/v1/analytics/overview')
  return data
}

export async function getCallsOverTime(days = 30): Promise<CallsOverTimePoint[]> {
  const { data } = await api.get<CallsOverTimePoint[]>('/v1/analytics/calls-over-time', {
    params: { days },
  })
  return data
}

export async function getOutcomeBreakdown(): Promise<OutcomeSlice[]> {
  const { data } = await api.get<OutcomeSlice[]>('/v1/analytics/outcomes')
  return data
}

export async function getDurationBuckets(): Promise<DurationBucket[]> {
  const { data } = await api.get<DurationBucket[]>('/v1/analytics/durations')
  return data
}

export async function getAgentPerformance(): Promise<AgentPerformance[]> {
  const { data } = await api.get<AgentPerformance[]>('/v1/analytics/agents')
  return data
}

export async function getCampaignPerformance(): Promise<CampaignPerformance[]> {
  const { data } = await api.get<CampaignPerformance[]>('/v1/analytics/campaigns')
  return data
}

export async function getLeadFunnel(): Promise<FunnelStage[]> {
  const { data } = await api.get<FunnelStage[]>('/v1/analytics/lead-funnel')
  return data
}

export async function getUsage(): Promise<UsageSummary> {
  const { data } = await api.get<UsageSummary>('/v1/usage')
  return data
}
