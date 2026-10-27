import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { productsApi } from '../../services/api'
import { fmtNum } from '../../lib/format'
import type { ProductSummary } from '../../types'

interface MaterialPickerProps {
  onPick: (product: ProductSummary) => void
  placeholder?: string
  exclude?: number[]
  autoFocus?: boolean
  className?: string
  //this prop shows extra text next to each result, e.g. the quantity in a warehouse
  hint?: (product: ProductSummary) => string | undefined
}

//this component searches materials by name or sku as you type
export default function MaterialPicker({ onPick, placeholder, exclude = [], autoFocus, className = '', hint }: MaterialPickerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  const { data = [] } = useQuery<ProductSummary[]>({
    queryKey: ['product-search', query.trim()],
    queryFn: () => productsApi.search(query.trim() || undefined, 12).then((r) => r.data),
    enabled: open,
    staleTime: 10_000,
  })
  const results = data.filter((p) => !exclude.includes(p.id))

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const pick = (p: ProductSummary) => {
    onPick(p)
    setQuery('')
    setOpen(false)
  }

  return (
    <div ref={box} className={`relative ${className}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
      <input
        className="input-base pl-9"
        value={query}
        autoFocus={autoFocus}
        placeholder={placeholder ?? t('picker.placeholder')}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && results[active]) { e.preventDefault(); pick(results[active]) }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1 bg-white rounded-xl border border-line shadow-lg py-1 z-30 max-h-72 overflow-y-auto">
          {results.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-slate-500">{t('picker.none')}</p>
          ) : results.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(p)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left ${i === active ? 'bg-paper' : ''}`}
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm truncate">{p.name}</span>
                {p.sku && <span className="block font-mono text-[11px] text-slate-400">{p.sku}</span>}
              </span>
              <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                {hint?.(p) ?? `${fmtNum(p.quantity)} ${p.unit}`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
