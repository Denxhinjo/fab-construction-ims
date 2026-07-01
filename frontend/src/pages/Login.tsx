import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { HardHat, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import Spinner from '../components/ui/Spinner'

interface LoginForm { username: string; password: string }

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<LoginForm>()

  const onSubmit = async (data: LoginForm) => {
    setError('')
    try {
      await login(data.username, data.password)
      navigate('/dashboard', { replace: true })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? t('login.invalidCredentials'))
    }
  }

  const toggleLang = () => {
    const next = i18n.language === 'sq' ? 'en' : 'sq'
    i18n.changeLanguage(next)
    localStorage.setItem('lang', next)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
      </div>

      {/* Language toggle */}
      <button
        onClick={toggleLang}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm font-semibold hover:bg-white/20 transition-colors"
      >
        {i18n.language === 'sq' ? 'EN' : 'SQ'}
      </button>

      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-8 py-10 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4">
              <HardHat className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">{t('app.name')}</h1>
            <p className="text-brand-100 text-sm mt-1">{t('app.ims')}</p>
          </div>

          <div className="px-8 py-8">
            <h2 className="text-xl font-semibold text-slate-800 mb-6">{t('login.title')}</h2>

            {error && (
              <div className="flex items-center gap-2.5 p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login.emailOrUsername')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input {...register('username', { required: true })} type="text" placeholder={t('login.emailPlaceholder')} className="input-base pl-10" autoComplete="username" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">{t('login.password')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input {...register('password', { required: true })} type={showPassword ? 'text' : 'password'} placeholder={t('login.passwordPlaceholder')} className="input-base pl-10 pr-10" autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={isSubmitting} className="w-full btn-primary justify-center py-2.5 text-base mt-2">
                {isSubmitting ? <Spinner size="sm" /> : null}
                {isSubmitting ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>

            {import.meta.env.DEV && (
              <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">{t('login.demoCredentials')}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">Admin:</span>
                    <span className="font-mono text-slate-700">admin / Admin@123</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-500">User:</span>
                    <span className="font-mono text-slate-700">jsmith / User@123</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">{t('login.copyright')}</p>
      </div>
    </div>
  )
}
