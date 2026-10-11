import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Login } from '../pages/Login'

const loginMock = vi.fn()

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    login: loginMock,
    logout: vi.fn(),
    isAdmin: false,
    isManager: false,
    hasRole: () => false,
  }),
}))

function renderLogin(): void {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Login page', () => {
  beforeEach(() => {
    loginMock.mockReset()
  })

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/email is required/i)).toBeInTheDocument()
    expect(await screen.findByText(/password is required/i)).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('shows a validation error for an invalid email', async () => {
    const user = userEvent.setup()
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'not-an-email')
    await user.type(screen.getByLabelText(/password/i), 'demo1234')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByText(/enter a valid email address/i)).toBeInTheDocument()
    expect(loginMock).not.toHaveBeenCalled()
  })

  it('calls auth.login with the entered credentials on valid submit', async () => {
    const user = userEvent.setup()
    loginMock.mockResolvedValue(undefined)
    renderLogin()

    await user.type(screen.getByLabelText(/email/i), 'admin@voxora.demo')
    await user.type(screen.getByLabelText(/password/i), 'demo1234')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledTimes(1)
    })
    expect(loginMock).toHaveBeenCalledWith({
      email: 'admin@voxora.demo',
      password: 'demo1234',
    })
  })

  it('displays the demo credentials hint', () => {
    renderLogin()
    expect(screen.getByText(/admin@voxora\.demo \/ demo1234/)).toBeInTheDocument()
  })
})
