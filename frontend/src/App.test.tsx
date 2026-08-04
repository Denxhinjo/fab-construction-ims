import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { PrivateRoute, AdminRoute } from './App'
import { useAuth } from './context/AuthContext'

vi.mock('./context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

function renderGuarded(guard: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route path="/dashboard" element={<div>Dashboard page</div>} />
        <Route path="/protected" element={guard} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PrivateRoute', () => {
  it('redirects to /login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: null, isLoading: false, isAuthenticated: false, isAdmin: false,
      login: vi.fn(), logout: vi.fn(),
    })
    renderGuarded(<PrivateRoute><div>Secret content</div></PrivateRoute>)
    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Secret content')).not.toBeInTheDocument()
  })

  it('renders children when authenticated', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'user' } as never, isLoading: false, isAuthenticated: true, isAdmin: false,
      login: vi.fn(), logout: vi.fn(),
    })
    renderGuarded(<PrivateRoute><div>Secret content</div></PrivateRoute>)
    expect(screen.getByText('Secret content')).toBeInTheDocument()
  })
})

describe('AdminRoute', () => {
  it('redirects non-admins to /dashboard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'user' } as never, isLoading: false, isAuthenticated: true, isAdmin: false,
      login: vi.fn(), logout: vi.fn(),
    })
    renderGuarded(<AdminRoute><div>Admin-only content</div></AdminRoute>)
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
    expect(screen.queryByText('Admin-only content')).not.toBeInTheDocument()
  })

  it('renders children for admins', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, role: 'admin' } as never, isLoading: false, isAuthenticated: true, isAdmin: true,
      login: vi.fn(), logout: vi.fn(),
    })
    renderGuarded(<AdminRoute><div>Admin-only content</div></AdminRoute>)
    expect(screen.getByText('Admin-only content')).toBeInTheDocument()
  })
})
