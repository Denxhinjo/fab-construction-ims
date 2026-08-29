import { NavLink, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard, Package, MapPin, ClipboardList,
  Users, BarChart3, HardHat, ChevronRight, X, Truck,
  FolderOpen, ArrowLeftRight, ShoppingCart,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface SidebarProps { open: boolean; onClose: () => void }

const PROCUREMENT_ROLES = new Set(['admin', 'procurement', 'warehouse_manager'])
const ADMIN_ROLES = new Set(['admin'])

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { t } = useTranslation()
  const { isAdmin, user } = useAuth()
  const location = useLocation()

  const role = user?.role ?? 'user'

  const navItems = [
    { to: '/dashboard',      icon: LayoutDashboard, label: t('nav.dashboard'),      always: true },
    { to: '/inventory',      icon: Package,         label: t('nav.inventory'),       always: true },
    { to: '/locations',      icon: MapPin,          label: t('nav.locations'),       always: true },
    { to: '/work-processes', icon: ClipboardList,   label: t('nav.workProcesses'),   always: true },
    { to: '/projects',       icon: FolderOpen,      label: t('nav.projects'),        always: true },
    { to: '/transfers',      icon: ArrowLeftRight,  label: t('nav.transfers'),       always: true },
    { to: '/purchase-orders',icon: ShoppingCart,    label: t('nav.purchaseOrders'), show: PROCUREMENT_ROLES.has(role) },
    { to: '/suppliers',      icon: Truck,           label: t('nav.suppliers'),       always: true },
    { to: '/reports',        icon: BarChart3,       label: t('nav.reports'),         always: true },
    { to: '/users',          icon: Users,           label: t('nav.users'),           show: ADMIN_ROLES.has(role) },
  ].filter(item => item.always || item.show)

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={onClose} />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transition-transform duration-300 lg:translate-x-0 lg:static lg:z-auto ${open ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">{t('app.name')}</div>
              <div className="text-slate-400 text-xs">{t('app.subtitle')}</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            {t('nav.navigation')}
          </p>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive || location.pathname.startsWith(to + '/') ? 'active' : ''}`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 opacity-0" />
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-slate-400 text-xs capitalize">{role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
