import { api } from './client'
import type { Agent, Business, PagedResponse } from './types'

export async function listBusinesses(): Promise<Business[]> {
  const { data } = await api.get<Business[]>('/v1/businesses')
  return data
}

export async function createBusiness(payload: Partial<Business>): Promise<Business> {
  const { data } = await api.post<Business>('/v1/businesses', payload)
  return data
}

export async function getBusiness(id: string): Promise<Business> {
  const { data } = await api.get<Business>(`/v1/businesses/${id}`)
  return data
}

export async function updateBusiness(id: string, payload: Partial<Business>): Promise<Business> {
  const { data } = await api.put<Business>(`/v1/businesses/${id}`, payload)
  return data
}

export async function deleteBusiness(id: string): Promise<void> {
  await api.delete(`/v1/businesses/${id}`)
}

export async function listBusinessAgents(id: string): Promise<PagedResponse<Agent> | Agent[]> {
  const { data } = await api.get<PagedResponse<Agent> | Agent[]>(`/v1/businesses/${id}/agents`)
  return data
}
