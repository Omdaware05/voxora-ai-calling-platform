import { api } from './client'
import type { Lead, PagedResponse } from './types'

export async function listLeads(params: {
  status?: string
  search?: string
  page?: number
  page_size?: number
} = {}): Promise<PagedResponse<Lead> | Lead[]> {
  const { data } = await api.get<PagedResponse<Lead> | Lead[]>('/v1/leads', { params })
  return data
}

export async function createLead(payload: Partial<Lead>): Promise<Lead> {
  const { data } = await api.post<Lead>('/v1/leads', payload)
  return data
}

export async function getLead(id: string): Promise<Lead> {
  const { data } = await api.get<Lead>(`/v1/leads/${id}`)
  return data
}

export async function updateLead(id: string, payload: Partial<Lead>): Promise<Lead> {
  const { data } = await api.patch<Lead>(`/v1/leads/${id}`, payload)
  return data
}

export async function deleteLead(id: string): Promise<void> {
  await api.delete(`/v1/leads/${id}`)
}
