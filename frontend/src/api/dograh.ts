import { api } from './client'
import type { DograhHealth, DograhWorkflow } from './types'

export async function getDograhHealth(): Promise<DograhHealth> {
  const { data } = await api.get<DograhHealth>('/v1/integrations/dograh/health')
  return data
}

export async function syncDograh(): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.post<{ ok: boolean; message?: string }>('/v1/integrations/dograh/sync')
  return data
}

export async function listDograhWorkflows(): Promise<DograhWorkflow[]> {
  const { data } = await api.get<DograhWorkflow[]>('/v1/integrations/dograh/workflows')
  return data
}

export async function createDograhWorkflow(payload: {
  name: string
  definition?: Record<string, unknown>
}): Promise<DograhWorkflow> {
  const { data } = await api.post<DograhWorkflow>('/v1/integrations/dograh/workflows', payload)
  return data
}

export async function publishDograhWorkflow(id: string): Promise<DograhWorkflow> {
  const { data } = await api.post<DograhWorkflow>(
    `/v1/integrations/dograh/workflows/${id}/publish`,
  )
  return data
}
