import { api } from './client'
import type { User } from './types'

export async function listUsers(): Promise<User[]> {
  const { data } = await api.get<User[]>('/v1/users')
  return data
}

export async function createUser(payload: {
  name: string
  email: string
  password: string
  role: string
}): Promise<User> {
  const { data } = await api.post<User>('/v1/users', payload)
  return data
}

export async function getUser(id: string): Promise<User> {
  const { data } = await api.get<User>(`/v1/users/${id}`)
  return data
}

export async function updateUser(id: string, payload: Partial<User>): Promise<User> {
  const { data } = await api.put<User>(`/v1/users/${id}`, payload)
  return data
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/v1/users/${id}`)
}
