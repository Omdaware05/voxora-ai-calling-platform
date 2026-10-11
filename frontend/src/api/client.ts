import axios, { type AxiosError } from 'axios'

const TOKEN_KEY = 'voxora_token'

export const apiBaseUrl: string = import.meta.env.VITE_API_URL ?? '/api'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

/** Build a WebSocket URL from the HTTP API base (http -> ws). */
export function wsUrl(path: string, token?: string | null): string {
  const wsBase = apiBaseUrl.replace(/^http/, 'ws')
  const t = token ?? getToken()
  const sep = path.includes('?') ? '&' : '?'
  return t ? `${wsBase}${path}${sep}token=${encodeURIComponent(t)}` : `${wsBase}${path}`
}

export const api = axios.create({
  baseURL: apiBaseUrl,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let redirectingToLogin = false
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      setToken(null)
      if (!redirectingToLogin) {
        redirectingToLogin = true
        window.location.assign('/login')
      }
    }
    return Promise.reject(error)
  },
)
