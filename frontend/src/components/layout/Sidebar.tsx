import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutGrid, Box, FileInput, ArrowLeftRight, History, Warehouse, Truck, Users, HardHat, X, LogOut,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { dashboardApi } from '../../services/api'
import type { NavCounts } from '../../types'

interface SidebarProps { open: boolean; onClose: () => void }

interface Item { to: string; icon: LucideIcon; label: string; badge?: number; badgeTone?: 'amber' | 'dark' }

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const { user, isAdmin, logout } = useAuth()

  const { data: counts } = useQuery<NavCounts>({
    queryKey: ['nav-counts'],
    queryFn: () => dashboardApi.counts().then((r) => r.data),
    refetchInterval: 60_000,
  })

  const main: Item[] = [
    { to: '/dashboard', icon: LayoutGrid, label: t('nav.dashboard') },
    { to: '/stock', icon: Box, label: t('nav.stock') },
    { to: '/receipts', icon: FileInput, label: t('nav.receipts'), badge: counts?.invoices_to_review, badgeTone: 'amber' },
    { to: '/transfers', icon: ArrowLeftRight, label: t('nav.transfers'), badge: counts?.transfers_in_transit, badgeTone: 'dark' },
    { to: '/history', icon: History, label: t('nav.history') },
  ]
  const admin: Item[] = [
    { to: '/locations', icon: Warehouse, label: t('nav.warehouses') },
    { to: '/suppliers', icon: Truck, label: t('nav.suppliers') },
    ...(isAdmin ? [{ to: '/users', icon: Users, label: t('nav.users') }] : []),
  ]

  const initials = (user?.full_name ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()

  const link = ({ to, icon: Icon, label, badge, badgeTone }: Item) => (
    <NavLink key={to} to={to} onClick={onClose} className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
      <Icon size={17} className="flex-shrink-0 text-ink-500" />
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className={`min-w-[22px] px-1.5 py-0.5 rounded-full text-[11px] font-bold text-center ${
          badgeTone === 'amber' ? 'bg-brand-500 text-ink-950' : 'bg-ink-700 text-ink-300'
        }`}>
          {badge}
        </span>
      )}
    </NavLink>
  )

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`print:hidden fixed inset-y-0 left-0 z-40 w-60 bg-ink-900 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-brand-500 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-ink-950" />
            </div>
            <div>
              <div className="text-white font-semibold text-sm leading-tight">{t('app.name')}</div>
              <div className="text-ink-500 text-xs">{t('app.subtitle')}</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-ink-500 hover:text-white" aria-label={t('common.close')}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
          {main.map(link)}
          <p className="px-3 pt-6 pb-2 text-[10px] font-semibold text-ink-500 uppercase tracking-[0.12em]">
            {t('nav.admin')}
          </p>
          {admin.map(link)}
        </nav>

        <div className="mx-3 mb-3 pt-3 border-t border-white/10 flex items-center gap-3 px-1">
          <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
            <span className="text-ink-950 text-[11px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-ink-500 text-xs">{t(`roles.${user?.role ?? 'user'}`, { defaultValue: user?.role })}</p>
          </div>
          <button onClick={logout} title={t('common.logout')} className="text-ink-500 hover:text-white p-1">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  )
}
