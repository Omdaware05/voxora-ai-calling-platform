import { api } from './client'
import type { Campaign, CampaignStats, PagedResponse } from './types'

export async function listCampaigns(): Promise<PagedResponse<Campaign> | Campaign[]> {
  const { data } = await api.get<PagedResponse<Campaign> | Campaign[]>('/v1/campaigns')
  return data
}

export async function createCampaign(payload: Partial<Campaign>): Promise<Campaign> {
  const { data } = await api.post<Campaign>('/v1/campaigns', payload)
  return data
}

export async function getCampaign(id: string): Promise<Campaign> {
  const { data } = await api.get<Campaign>(`/v1/campaigns/${id}`)
  return data
}

export async function updateCampaign(id: string, payload: Partial<Campaign>): Promise<Campaign> {
  const { data } = await api.put<Campaign>(`/v1/campaigns/${id}`, payload)
  return data
}

export async function deleteCampaign(id: string): Promise<void> {
  await api.delete(`/v1/campaigns/${id}`)
}

export async function startCampaign(id: string): Promise<Campaign> {
  const { data } = await api.post<Campaign>(`/v1/campaigns/${id}/start`)
  return data
}

export async function pauseCampaign(id: string): Promise<Campaign> {
  const { data } = await api.post<Campaign>(`/v1/campaigns/${id}/pause`)
  return data
}

export async function resumeCampaign(id: string): Promise<Campaign> {
  const { data } = await api.post<Campaign>(`/v1/campaigns/${id}/resume`)
  return data
}

export async function stopCampaign(id: string): Promise<Campaign> {
  const { data } = await api.post<Campaign>(`/v1/campaigns/${id}/stop`)
  return data
}

export async function getCampaignStats(id: string): Promise<CampaignStats> {
  const { data } = await api.get<CampaignStats>(`/v1/campaigns/${id}/stats`)
  return data
}

export async function addContactsToCampaign(
  id: string,
  contact_ids: string[],
): Promise<{ added: number }> {
  const { data } = await api.post<{ added: number }>(`/v1/campaigns/${id}/contacts`, {
    contact_ids,
  })
  return data
}
