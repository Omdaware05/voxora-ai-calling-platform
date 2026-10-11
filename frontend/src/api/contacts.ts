import { api } from './client'
import type { Contact, ContactQueryParams, PagedResponse } from './types'

export async function listContacts(params: ContactQueryParams = {}): Promise<PagedResponse<Contact>> {
  const { data } = await api.get<PagedResponse<Contact>>('/v1/contacts', { params })
  return data
}

export async function createContact(payload: Partial<Contact>): Promise<Contact> {
  const { data } = await api.post<Contact>('/v1/contacts', payload)
  return data
}

export async function getContact(id: string): Promise<Contact> {
  const { data } = await api.get<Contact>(`/v1/contacts/${id}`)
  return data
}

export async function updateContact(id: string, payload: Partial<Contact>): Promise<Contact> {
  const { data } = await api.put<Contact>(`/v1/contacts/${id}`, payload)
  return data
}

export async function deleteContact(id: string): Promise<void> {
  await api.delete(`/v1/contacts/${id}`)
}

export async function importContacts(file: File): Promise<{ imported: number; errors?: string[] }> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post('/v1/contacts/import', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data as { imported: number; errors?: string[] }
}

export async function exportContacts(params: ContactQueryParams = {}): Promise<Blob> {
  const { data } = await api.get<Blob>('/v1/contacts/export', {
    params,
    responseType: 'blob',
  })
  return data
}

export async function bulkDeleteContacts(ids: string[]): Promise<void> {
  await api.post('/v1/contacts/bulk-delete', { ids })
}

export async function callContact(id: string): Promise<unknown> {
  const { data } = await api.post(`/v1/contacts/${id}/call`)
  return data
}

export async function setDoNotCall(id: string, do_not_call: boolean): Promise<Contact> {
  const { data } = await api.patch<Contact>(`/v1/contacts/${id}/do-not-call`, { do_not_call })
  return data
}
