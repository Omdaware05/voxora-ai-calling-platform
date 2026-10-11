import { api } from './client'
import type {
  Agent,
  AgentQueryParams,
  AgentVersion,
  AgentWorkspace,
  PagedResponse,
} from './types'

export async function listAgents(params: AgentQueryParams = {}): Promise<PagedResponse<Agent>> {
  const { data } = await api.get<PagedResponse<Agent>>('/v1/agents', { params })
  return data
}

export async function createAgent(payload: Partial<Agent>): Promise<Agent> {
  const { data } = await api.post<Agent>('/v1/agents', payload)
  return data
}

export async function getAgent(id: string): Promise<Agent> {
  const { data } = await api.get<Agent>(`/v1/agents/${id}`)
  return data
}

export async function updateAgent(id: string, payload: Partial<Agent>): Promise<Agent> {
  const { data } = await api.put<Agent>(`/v1/agents/${id}`, payload)
  return data
}

export async function deleteAgent(id: string): Promise<void> {
  await api.delete(`/v1/agents/${id}`)
}

export async function duplicateAgent(id: string): Promise<Agent> {
  const { data } = await api.post<Agent>(`/v1/agents/${id}/duplicate`)
  return data
}

export async function toggleAgent(id: string): Promise<Agent> {
  const { data } = await api.post<Agent>(`/v1/agents/${id}/toggle`)
  return data
}

export async function getAgentWorkspace(id: string): Promise<AgentWorkspace> {
  const { data } = await api.get<AgentWorkspace>(`/v1/agents/${id}/workspace`)
  return data
}

export async function listAgentVersions(id: string): Promise<AgentVersion[]> {
  const { data } = await api.get<AgentVersion[]>(`/v1/agents/${id}/versions`)
  return data
}

export async function restoreAgentVersion(id: string, versionId: string): Promise<Agent> {
  const { data } = await api.post<Agent>(`/v1/agents/${id}/versions/${versionId}/restore`)
  return data
}
