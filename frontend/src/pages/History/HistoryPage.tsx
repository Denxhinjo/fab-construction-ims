import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { locationsApi, movementsApi } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { fmtDate, fmtNum, movementBadge, movementQty, movementRoute } from '../../lib/format'
import type { Location, Paginated, StockMovement } from '../../types'

const KINDS = ['', 'in', 'transfer', 'adjustment'] as const

export default function HistoryPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [searchText, setSearchText] = useState(params.get('search') ?? '')
  const kind = params.get('kind') ?? ''
  const location = params.get('location') ?? ''
  const search = params.get('search') ?? ''
  const page = Number(params.get('page')) || 1

  const set = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    if (!('page' in patch)) next.delete('page')
    setParams(next, { replace: true })
  }

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })
  const { data, isLoading } = useQuery<Paginated<StockMovement>>({
    queryKey: ['movements', { kind, location, search, page }],
    queryFn: () => movementsApi.list({
      kind: kind || undefined, location_id: location || undefined, search: search || undefined, page, page_size: 30,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">{t('history.title')}</h1>
        <p className="text-sm text-slate-500 mt-1">{t('history.subtitle')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented">
          {KINDS.map((k) => (
            <button key={k || 'all'} aria-pressed={kind === k} onClick={() => set({ kind: k })}>
              {k ? t(`movement.${k}`) : t('common.all')}
            </button>
          ))}
        </div>
        <select className="input-base w-48" value={location} onChange={(e) => set({ location: e.target.value })}>
          <option value="">{t('stock.allDepots')}</option>
          {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        <form className="relative w-64" onSubmit={(e) => { e.preventDefault(); set({ search: searchText.trim() }) }}>
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input-base pl-9" placeholder={t('history.search')} value={searchText}
            onChange={(e) => setSearchText(e.target.value)} onBlur={() => set({ search: searchText.trim() })} />
        </form>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th>{t('history.type')}</th>
              <th>{t('history.material')}</th>
              <th className="!text-right">{t('history.qty')}</th>
              <th>{t('history.route')}</th>
              <th>{t('history.reference')}</th>
              <th>{t('history.user')}</th>
              <th className="!text-right">{t('history.date')}</th>
            </tr>
          </thead>
          <tbody className="table-body">
            {isLoading && <tr><td colSpan={7} className="text-center py-10"><Spinner /></td></tr>}
            {!isLoading && !data?.items.length && (
              <tr><td colSpan={7} className="text-center py-10 text-slate-500">{t('history.none')}</td></tr>
            )}
            {data?.items.map((m) => {
              const badge = movementBadge(m)
              return (
                <tr key={m.id}>
                  <td><Badge variant={badge.variant}>{badge.label}</Badge></td>
                  <td className="font-medium">{m.product?.name}</td>
                  <td className="text-right font-mono whitespace-nowrap">{movementQty(m)} <span className="text-slate-400">{m.product?.unit}</span></td>
                  <td className="text-slate-600">{movementRoute(m)}</td>
                  <td className="font-mono text-xs">
                    {m.invoice_id ? (
                      <Link to={`/receipts/${m.invoice_id}`} className="text-brand-700 hover:underline">{m.reference_number}</Link>
                    ) : m.transfer_id ? (
                      <Link to={`/transfers?open=${m.transfer_id}`} className="text-brand-700 hover:underline">{m.reference_number}</Link>
                    ) : m.reference_number ?? '—'}
                  </td>
                  <td className="text-slate-600">{m.user?.full_name}</td>
                  <td className="text-right text-slate-500 whitespace-nowrap">
                    {fmtDate(m.created_at)} <span className="text-xs">{new Date(m.created_at).toTimeString().slice(0, 5)}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{t('history.count', { count: data.total, shown: fmtNum(data.items.length) })}</span>
          <div className="flex items-center gap-2">
            <button className="btn-secondary !p-2" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label={t('common.previous')}><ChevronLeft className="w-4 h-4" /></button>
            <span>{page} / {data.total_pages}</span>
            <button className="btn-secondary !p-2" disabled={page >= data.total_pages} onClick={() => set({ page: String(page + 1) })} aria-label={t('common.next')}><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  )
}
