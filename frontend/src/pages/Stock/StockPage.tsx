import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Download, Plus, Search } from 'lucide-react'
import { categoriesApi, stockApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import { fmtMoney, fmtNum } from '../../lib/format'
import type { Category, StockOut, StockRow } from '../../types'
import MaterialModal from './MaterialModal'

export default function StockPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const [params, setParams] = useSearchParams()
  const [modal, setModal] = useState<{ row: StockRow | null } | null>(null)

  const locationId = params.get('location') ? Number(params.get('location')) : undefined
  const belowMin = params.get('below_min') === '1'
  const categoryId = params.get('category') ? Number(params.get('category')) : undefined
  const search = params.get('search') ?? ''

  const setParam = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const { data, isLoading } = useQuery<StockOut>({
    queryKey: ['stock', { locationId, belowMin, categoryId, search }],
    queryFn: () => stockApi.matrix({
      location_id: locationId, below_min: belowMin || undefined, category_id: categoryId, search: search || undefined,
    }).then((r) => r.data),
    placeholderData: (prev) => prev,
  })
  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  })

  const locations = useMemo(() => data?.locations ?? [], [data])
  const shown = useMemo(
    () => (locationId ? locations.filter((l) => l.id === locationId) : locations),
    [locations, locationId],
  )

  const exportCsv = async () => {
    const res = await stockApi.export()
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `stoku-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  //this function starts a transfer from the warehouse holding the most of this material
  const transfer = (row: StockRow) => {
    const best = locations.reduce((a, b) => (row.cells[b.id].quantity > row.cells[a.id].quantity ? b : a), locations[0])
    navigate(`/transfers?from=${best.id}&product=${row.id}`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('stock.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            {t('stock.subtitle', { count: data?.total_materials ?? 0, depots: locations.length })}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="btn-secondary"><Download className="w-4 h-4" /> {t('stock.export')}</button>
          {isAdmin && (
            <button onClick={() => setModal({ row: null })} className="btn-secondary">
              <Plus className="w-4 h-4" /> {t('stock.newMaterial')}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="segmented">
          <button aria-pressed={!locationId} onClick={() => setParam('location', undefined)}>{t('stock.allDepots')}</button>
          {locations.map((l) => (
            <button key={l.id} aria-pressed={locationId === l.id} onClick={() => setParam('location', String(l.id))}>
              {l.name.replace(/^Depo\s+/i, '')}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-500">
          {t('stock.category')}
          <select className="input-base w-44" value={categoryId ?? ''} onChange={(e) => setParam('category', e.target.value || undefined)}>
            <option value="">{t('common.all')}</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <div className="relative w-56">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            className="input-base pl-9"
            placeholder={t('stock.search')}
            defaultValue={search}
            onKeyDown={(e) => { if (e.key === 'Enter') setParam('search', (e.target as HTMLInputElement).value.trim() || undefined) }}
            onBlur={(e) => setParam('search', e.target.value.trim() || undefined)}
          />
        </div>
        <label className="ml-auto flex items-center gap-2 text-sm font-medium cursor-pointer select-none">
          <input type="checkbox" className="w-4 h-4 accent-amber-500" checked={belowMin} onChange={(e) => setParam('below_min', e.target.checked ? '1' : undefined)} />
          {t('stock.onlyBelowMin')}
        </label>
      </div>

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : !data?.rows.length ? (
          <EmptyState title={t('stock.empty')} description={belowMin ? t('stock.emptyBelowMin') : t('stock.emptyHint')} />
        ) : (
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th>{t('stock.material')}</th>
                <th>{t('stock.unit')}</th>
                {shown.map((l) => <th key={l.id} className="!text-right">{l.name.replace(/^Depo\s+/i, '')}</th>)}
                {!locationId && <th className="!text-right bg-stone-50">{t('stock.total')}</th>}
                <th className="!text-right">{t('stock.avgPrice')}</th>
                <th>{t('stock.lastSupplier')}</th>
                <th className="!text-right"><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="table-body">
              {data.rows.map((row) => (
                <tr key={row.id} className="hover:bg-paper/60 cursor-pointer" onClick={() => setModal({ row })}>
                  <td>
                    <p className="font-medium">{row.name}</p>
                    <p className="font-mono text-[11px] text-slate-400">
                      {[row.sku, row.category].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="text-slate-500">{row.unit}</td>
                  {shown.map((l) => {
                    const cell = row.cells[l.id]
                    return (
                      <td key={l.id} className={`text-right font-mono ${cell.below_min ? 'text-red-600 font-semibold' : ''}`}
                        title={cell.min ? t('stock.minTitle', { min: fmtNum(cell.min) }) : undefined}>
                        {cell.quantity === 0 && !cell.min ? '—' : fmtNum(cell.quantity)}
                      </td>
                    )
                  })}
                  {!locationId && <td className="text-right font-mono font-semibold bg-stone-50">{fmtNum(row.total)}</td>}
                  <td className="text-right font-mono text-slate-600">{row.avg_cost ? fmtMoney(row.avg_cost) : '—'}</td>
                  <td className="text-slate-600">{row.last_supplier ?? '—'}</td>
                  <td className="text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); transfer(row) }}
                      disabled={row.total <= 0 || locations.length < 2}
                      className="btn-secondary !px-3 !py-1.5 text-xs"
                    >
                      {t('stock.transfer')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {t('stock.footnote1')} <b className="text-red-600">{t('stock.footnoteRed')}</b> {t('stock.footnote2')}
      </p>

      {modal && (
        <MaterialModal open onClose={() => setModal(null)} row={modal.row} locations={locations} />
      )}
    </div>
  )
}
