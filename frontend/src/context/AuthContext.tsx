import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { authApi } from '../services/api'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('user')
    setUser(null)
  }, [])

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => logout())
      .finally(() => setIsLoading(false))
  }, [logout])

  const login = async (username: string, password: string) => {
    const res = await authApi.login(username, password)
    const { access_token } = res.data
    localStorage.setItem('access_token', access_token)

    const meRes = await authApi.me()
    const userData: User = meRes.data
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// Standard context pattern: the hook belongs next to its provider.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
