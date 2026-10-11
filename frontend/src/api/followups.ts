import { api } from './client'
import type { FollowUp, PagedResponse } from './types'

export async function listFollowUps(params: {
  status?: string
  page?: number
  page_size?: number
} = {}): Promise<PagedResponse<FollowUp> | FollowUp[]> {
  const { data } = await api.get<PagedResponse<FollowUp> | FollowUp[]>('/v1/followups', {
    params,
  })
  return data
}

export async function createFollowUp(payload: Partial<FollowUp>): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>('/v1/followups', payload)
  return data
}

export async function getFollowUp(id: string): Promise<FollowUp> {
  const { data } = await api.get<FollowUp>(`/v1/followups/${id}`)
  return data
}

export async function updateFollowUp(id: string, payload: Partial<FollowUp>): Promise<FollowUp> {
  const { data } = await api.put<FollowUp>(`/v1/followups/${id}`, payload)
  return data
}

export async function deleteFollowUp(id: string): Promise<void> {
  await api.delete(`/v1/followups/${id}`)
}

export async function completeFollowUp(id: string): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>(`/v1/followups/${id}/complete`)
  return data
}

export async function cancelFollowUp(id: string): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>(`/v1/followups/${id}/cancel`)
  return data
}

export async function rescheduleFollowUp(id: string, scheduled_at: string): Promise<FollowUp> {
  const { data } = await api.post<FollowUp>(`/v1/followups/${id}/reschedule`, { scheduled_at })
  return data
}
