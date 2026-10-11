import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '../theme/ThemeProvider'
import { App } from '../App'

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', email: 'admin@voxora.demo', name: 'Admin', role: 'admin' },
    token: 'test-token',
    isLoading: false,
    isAuthenticated: true,
    login: vi.fn(),
    logout: vi.fn(),
    isAdmin: true,
    isManager: true,
    hasRole: (roles: string[]) => roles.includes('admin'),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('../api/analytics', () => ({
  getAnalyticsOverview: vi.fn().mockRejectedValue(new Error('network down')),
  getCallsOverTime: vi.fn().mockResolvedValue([]),
  getOutcomeBreakdown: vi.fn().mockResolvedValue([]),
  getDurationBuckets: vi.fn().mockResolvedValue([]),
  getAgentPerformance: vi.fn().mockResolvedValue([]),
  getCampaignPerformance: vi.fn().mockResolvedValue([]),
  getLeadFunnel: vi.fn().mockResolvedValue([]),
  getUsage: vi.fn().mockResolvedValue({}),
}))

vi.mock('../api/followups', () => ({
  listFollowUps: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 5 }),
}))

describe('App router', () => {
  it('renders the dashboard route behind auth', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </QueryClientProvider>,
    )

    // Dashboard heading renders inside the protected layout
    expect(await screen.findByRole('heading', { name: /dashboard/i })).toBeInTheDocument()
    // Sidebar navigation is visible
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
    // Nav links to the main sections exist
    expect(screen.getByRole('link', { name: /live calls/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /agents/i })).toBeInTheDocument()
  })
})
