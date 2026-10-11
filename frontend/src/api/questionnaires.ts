import { api } from './client'
import type { PagedResponse, Questionnaire, QuestionnaireVersion } from './types'

export async function listQuestionnaires(params: {
  status?: string
  page?: number
  page_size?: number
} = {}): Promise<PagedResponse<Questionnaire> | Questionnaire[]> {
  const { data } = await api.get<PagedResponse<Questionnaire> | Questionnaire[]>(
    '/v1/questionnaires',
    { params },
  )
  return data
}

export async function createQuestionnaire(payload: Partial<Questionnaire>): Promise<Questionnaire> {
  const { data } = await api.post<Questionnaire>('/v1/questionnaires', payload)
  return data
}

export async function getQuestionnaire(id: string): Promise<Questionnaire> {
  const { data } = await api.get<Questionnaire>(`/v1/questionnaires/${id}`)
  return data
}

export async function updateQuestionnaire(
  id: string,
  payload: Partial<Questionnaire>,
): Promise<Questionnaire> {
  const { data } = await api.put<Questionnaire>(`/v1/questionnaires/${id}`, payload)
  return data
}

export async function deleteQuestionnaire(id: string): Promise<void> {
  await api.delete(`/v1/questionnaires/${id}`)
}

export async function duplicateQuestionnaire(id: string): Promise<Questionnaire> {
  const { data } = await api.post<Questionnaire>(`/v1/questionnaires/${id}/duplicate`)
  return data
}

export async function publishQuestionnaire(id: string): Promise<Questionnaire> {
  const { data } = await api.post<Questionnaire>(`/v1/questionnaires/${id}/publish`)
  return data
}

export async function archiveQuestionnaire(id: string): Promise<Questionnaire> {
  const { data } = await api.post<Questionnaire>(`/v1/questionnaires/${id}/archive`)
  return data
}

export async function listQuestionnaireVersions(id: string): Promise<QuestionnaireVersion[]> {
  const { data } = await api.get<QuestionnaireVersion[]>(`/v1/questionnaires/${id}/versions`)
  return data
}

export async function importQuestionnaires(
  file: File,
): Promise<{ imported: number; errors?: string[] }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/v1/questionnaires/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { imported: number; errors?: string[] }
}

export async function downloadQuestionnaireTemplate(): Promise<Blob> {
  const { data } = await api.get<Blob>('/v1/questionnaires/template', {
    responseType: 'blob',
  })
  return data
}
