import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Menu, Search, Box, FileText, ArrowLeftRight } from 'lucide-react'
import { searchApi } from '../../services/api'
import { fmtNum } from '../../lib/format'
import type { SearchResults } from '../../types'

interface HeaderProps { onMenuClick: () => void }

export function LanguageToggle({ dark = false }: { dark?: boolean }) {
  const { i18n } = useTranslation()
  const set = (lang: 'sq' | 'en') => {
    i18n.changeLanguage(lang)
    localStorage.setItem('lang_v2', lang)
  }
  const base = dark ? 'text-white/50 hover:text-white' : 'text-slate-400 hover:text-slate-700'
  const active = dark ? 'text-white' : 'text-slate-900'
  return (
    <div className={`flex items-center gap-1 text-xs font-semibold ${dark ? '' : 'px-2.5 py-1.5 rounded-lg border border-line bg-white'}`}>
      <button onClick={() => set('sq')} className={i18n.language === 'sq' ? active : base}>SQ</button>
      <span className={dark ? 'text-white/30' : 'text-slate-300'}>·</span>
      <button onClick={() => set('en')} className={i18n.language === 'en' ? active : base}>EN</button>
    </div>
  )
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return debounced
}

export default function Header({ onMenuClick }: HeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const q = useDebounced(query.trim(), 250)

  const { data } = useQuery<SearchResults>({
    queryKey: ['search', q],
    queryFn: () => searchApi.search(q).then((r) => r.data),
    enabled: q.length >= 2,
  })

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (path: string) => { setOpen(false); setQuery(''); navigate(path) }
  const empty = data && !data.products.length && !data.invoices.length && !data.transfers.length

  return (
    <header className="h-16 bg-white border-b border-line flex items-center gap-3 px-4 lg:px-8 flex-shrink-0 no-print">
      <button onClick={onMenuClick} className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-slate-100">
        <Menu className="w-5 h-5 text-slate-600" />
      </button>

      <div ref={box} className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder={t('search.placeholder')}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-line bg-paper text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:bg-white"
        />
        {open && q.length >= 2 && data && (
          <div className="absolute left-0 right-0 mt-1.5 bg-white rounded-xl border border-line shadow-lg py-1.5 z-30 max-h-[70vh] overflow-y-auto">
            {empty && <p className="px-4 py-3 text-sm text-slate-500">{t('search.nothing')}</p>}
            {data.products.map((p) => (
              <button key={`p${p.id}`} onClick={() => go(`/stock?search=${encodeURIComponent(p.name)}`)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-paper text-left">
                <Box className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-sm truncate">{p.name}</span>
                <span className="font-mono text-xs text-slate-500">{fmtNum(p.quantity)} {p.unit}</span>
              </button>
            ))}
            {data.invoices.map((i) => (
              <button key={`i${i.id}`} onClick={() => go(`/receipts/${i.id}`)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-paper text-left">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-sm truncate">{i.supplier ?? i.file_name}</span>
                <span className="font-mono text-xs text-slate-500">{i.invoice_number ?? '—'}</span>
              </button>
            ))}
            {data.transfers.map((tr) => (
              <button key={`t${tr.id}`} onClick={() => go(`/transfers?open=${tr.id}`)} className="w-full flex items-center gap-3 px-4 py-2 hover:bg-paper text-left">
                <ArrowLeftRight className="w-4 h-4 text-slate-400" />
                <span className="flex-1 text-sm truncate">{tr.source} → {tr.destination}</span>
                <span className="font-mono text-xs text-slate-500">{tr.reference}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ml-auto">
        <LanguageToggle />
      </div>
    </header>
  )
}
