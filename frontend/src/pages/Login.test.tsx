import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'
import { useAuth } from '../context/AuthContext'

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const mockUseAuth = vi.mocked(useAuth)

function renderLogin() {
  const login = vi.fn(() => Promise.resolve())
  mockUseAuth.mockReturnValue({
    user: null, isLoading: false, isAuthenticated: false, isAdmin: false,
    login, logout: vi.fn(),
  })
  render(<MemoryRouter><Login /></MemoryRouter>)
  return { login }
}

describe('Login', () => {
  it('does not call login when username/password are empty', async () => {
    const { login } = renderLogin()
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).not.toHaveBeenCalled()
  })

  it('calls login with the entered credentials', async () => {
    const { login } = renderLogin()
    await userEvent.type(screen.getByPlaceholderText(/admin@fabconstruction\.com/i), 'admin')
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'Admin@123')
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }))
    expect(login).toHaveBeenCalledWith('admin', 'Admin@123')
  })
})
