import { Menu, LogOut, ChevronDown, Globe } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'

interface HeaderProps { onMenuClick: () => void }

export default function Header({ onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [dropdownOpen, setDropdownOpen] = useState(false)

  const handleLogout = () => {
    logout()
    navigate('/login')
    toast.success(t('common.logout'))
  }

  const toggleLang = () => {
    const next = i18n.language === 'sq' ? 'en' : 'sq'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 lg:px-6 flex-shrink-0">
      <button
        onClick={onMenuClick}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors"
      >
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      <div className="flex items-center gap-2 ml-auto">
        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm font-semibold text-slate-600"
          title={t('common.language')}
        >
          <Globe className="w-4 h-4" />
          {i18n.language === 'sq' ? 'EN' : 'SQ'}
        </button>

        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">
                {user?.full_name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-sm font-semibold text-slate-700 leading-tight">{user?.full_name}</p>
              <p className="text-xs text-slate-400 capitalize">{user?.role}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-20">
                <div className="px-4 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-700">{user?.full_name}</p>
                  <p className="text-xs text-slate-500">{user?.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  {t('common.logout')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
