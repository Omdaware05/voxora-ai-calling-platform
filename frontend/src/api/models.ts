import { api } from './client'
import type {
  ModelConfigResponse,
  ModelSlotConfig,
  ModelSlotType,
  ModelTestResult,
} from './types'

export async function getModelConfig(): Promise<ModelConfigResponse> {
  const { data } = await api.get<ModelConfigResponse>('/v1/model-config')
  return data
}

export async function updateModelSlot(
  type: ModelSlotType,
  payload: Partial<ModelSlotConfig> & { api_key?: string },
): Promise<ModelSlotConfig> {
  const { data } = await api.put<ModelSlotConfig>(`/v1/model-config/${type}`, payload)
  return data
}

export async function testModelSlot(type: ModelSlotType): Promise<ModelTestResult> {
  const { data } = await api.post<ModelTestResult>(`/v1/model-config/${type}/test`)
  return data
}

export async function resetModelConfig(): Promise<ModelConfigResponse> {
  const { data } = await api.post<ModelConfigResponse>('/v1/model-config/reset')
  return data
}
