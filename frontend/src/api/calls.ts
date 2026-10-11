import { api } from './client'
import type {
  CallDetail,
  CallEvent,
  CallQueryParams,
  CallSummary,
  CallTranscript,
  CreateCallPayload,
  PagedResponse,
} from './types'

export async function listCalls(params: CallQueryParams = {}): Promise<PagedResponse<CallSummary>> {
  const { data } = await api.get<PagedResponse<CallSummary>>('/v1/calls', { params })
  return data
}

export async function createCall(payload: CreateCallPayload): Promise<CallSummary> {
  const { data } = await api.post<CallSummary>('/v1/calls', payload)
  return data
}

export async function listLiveCalls(): Promise<CallSummary[]> {
  const { data } = await api.get<CallSummary[]>('/v1/calls/live')
  return data
}

export async function getCall(id: string): Promise<CallDetail> {
  const { data } = await api.get<CallDetail>(`/v1/calls/${id}`)
  return data
}

export async function hangupCall(id: string): Promise<CallSummary> {
  const { data } = await api.post<CallSummary>(`/v1/calls/${id}/hangup`)
  return data
}

export async function getCallTranscript(id: string): Promise<CallTranscript> {
  const { data } = await api.get<CallTranscript>(`/v1/calls/${id}/transcript`)
  return data
}

export async function getCallEvents(id: string): Promise<CallEvent[]> {
  const { data } = await api.get<CallEvent[]>(`/v1/calls/${id}/events`)
  return data
}

export async function getCallRecording(id: string): Promise<Blob> {
  const { data } = await api.get<Blob>(`/v1/calls/${id}/recording`, {
    responseType: 'blob',
  })
  return data
}
