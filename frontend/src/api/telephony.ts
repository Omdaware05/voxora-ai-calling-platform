import { api } from './client'
import type { TelephonyConfig, TelephonyOverview } from './types'

export async function getTelephony(): Promise<TelephonyOverview> {
  const { data } = await api.get<TelephonyOverview>('/v1/telephony')
  return data
}

export async function saveVobizConfig(payload: {
  auth_id: string
  auth_token?: string
  from_number: string
}): Promise<TelephonyConfig> {
  const { data } = await api.put<TelephonyConfig>('/v1/telephony/vobiz', payload)
  return data
}

export async function testVobizConfig(): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.post<{ ok: boolean; message?: string }>('/v1/telephony/vobiz/test')
  return data
}

export async function setDefaultProvider(provider: string): Promise<TelephonyOverview> {
  const { data } = await api.post<TelephonyOverview>('/v1/telephony/set-default', { provider })
  return data
}
