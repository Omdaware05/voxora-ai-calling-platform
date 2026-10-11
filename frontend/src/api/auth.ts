import { api, setToken } from './client'
import type { AuthResponse, LoginPayload, User } from './types'

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/v1/auth/login', payload)
  setToken(data.access_token)
  return data
}

export async function logout(): Promise<void> {
  try {
    await api.post('/v1/auth/logout')
  } finally {
    setToken(null)
  }
}

export async function me(): Promise<User> {
  const { data } = await api.get<User>('/v1/auth/me')
  return data
}
