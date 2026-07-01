import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes
const WARNING_MS = 29 * 60 * 1000     // warn at 29 minutes

export function useInactivityLogout() {
  const { isAuthenticated, logout } = useAuth()
  const navigate = useNavigate()
  const logoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isAuthenticated) return

    const reset = () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (warningTimer.current) clearTimeout(warningTimer.current)

      warningTimer.current = setTimeout(() => {
        toast('Sesioni juaj do të skadojë në 1 minutë.', { icon: '⚠️', duration: 60_000 })
      }, WARNING_MS)

      logoutTimer.current = setTimeout(() => {
        toast.dismiss()
        logout()
        navigate('/login')
        toast.error('Sesioni skadoi. Ju lutemi hyni përsëri.')
      }, INACTIVITY_MS)
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset))
      if (logoutTimer.current) clearTimeout(logoutTimer.current)
      if (warningTimer.current) clearTimeout(warningTimer.current)
    }
  }, [isAuthenticated, logout, navigate])
}
