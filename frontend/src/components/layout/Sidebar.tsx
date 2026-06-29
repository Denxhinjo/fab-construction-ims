import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  MapPin,
  ClipboardList,
  Users,
  BarChart3,
  HardHat,
  ChevronRight,
  X,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface SidebarProps {
  open: boolean
  onClose: () => void
}

const navItems = [
  { to: '/dashboard',       icon: LayoutDashboard, label: 'Dashboard'       },
  { to: '/inventory',       icon: Package,         label: 'Inventory'       },
  { to: '/locations',       icon: MapPin,          label: 'Locations'       },
  { to: '/work-processes',  icon: ClipboardList,   label: 'Work Processes'  },
  { to: '/reports',         icon: BarChart3,       label: 'Reports'         },
]

export default function Sidebar({ open, onClose }: SidebarProps) {
  const { isAdmin, user } = useAuth()
  const location = useLocation()

  const items = isAdmin
    ? [...navItems, { to: '/users', icon: Users, label: 'Users' }]
    : navItems

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 flex flex-col transition-transform duration-300
          lg:translate-x-0 lg:static lg:z-auto
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center">
              <HardHat className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">Fab Construction</div>
              <div className="text-slate-400 text-xs">IMS v1.0</div>
            </div>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
            Navigation
          </p>
          {items.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `sidebar-link ${isActive || location.pathname.startsWith(to + '/') ? 'active' : ''}`
              }
            >
              <Icon className="w-4.5 h-4.5 flex-shrink-0" size={18} />
              <span className="flex-1">{label}</span>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
              <p className="text-slate-400 text-xs capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
