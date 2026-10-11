import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getToken, setToken } from '../api/client'
import { login as apiLogin, logout as apiLogout, me } from '../api/auth'
import type { LoginPayload, User } from '../api/types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (payload: LoginPayload) => Promise<void>
  logout: () => Promise<void>
  isAdmin: boolean
  isManager: boolean
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const queryClient = useQueryClient()
  const token = getToken()

  const { data: user, isLoading } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: me,
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
  })

  const login = useCallback(
    async (payload: LoginPayload) => {
      const res = await apiLogin(payload)
      queryClient.setQueryData(['auth', 'me'], res.user)
    },
    [queryClient],
  )

  const logout = useCallback(async () => {
    await apiLogout()
    queryClient.setQueryData(['auth', 'me'], null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(() => {
    const role = (user?.role ?? '').toLowerCase()
    return {
      user: user ?? null,
      token,
      isLoading: !!token && isLoading,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      isAdmin: role === 'admin',
      isManager: role === 'manager' || role === 'admin',
      hasRole: (...roles: string[]) => roles.map((r) => r.toLowerCase()).includes(role),
    }
  }, [user, token, isLoading, login, logout])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export function clearStoredToken(): void {
  setToken(null)
}
