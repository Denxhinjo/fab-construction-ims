import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Spinner from '../../components/ui/Spinner'
import { categoriesApi, productsApi, stockApi } from '../../services/api'
import { useAuth } from '../../context/AuthContext'
import { fmtNum } from '../../lib/format'
import { COMMON_UNITS } from '../../lib/units'
import type { Category, StockOut, StockRow } from '../../types'

interface Props {
  open: boolean
  onClose: () => void
  row: StockRow | null  //this line is null for a new material
  locations: StockOut['locations']
}

export default function MaterialModal({ open, onClose, row, locations }: Props) {
  const { t } = useTranslation()
  const { isAdmin, user } = useAuth()
  const qc = useQueryClient()
  const canCorrect = user?.role !== 'viewer'

  const [form, setForm] = useState(() => ({
    name: row?.name ?? '',
    sku: row?.sku ?? '',
    category_name: row?.category ?? '',
    unit: row?.unit ?? 'copë',
    min_stock_level: row?.min_stock_level ?? 0,
    notes: row?.notes ?? '',
    mins: Object.fromEntries(locations.map((l) => [l.id, row?.cells[l.id]?.min ?? ''])) as Record<number, number | ''>,
  }))
  const [count, setCount] = useState({ location_id: locations[0]?.id ?? 0, counted: '' as number | '', note: '' })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
    enabled: open,
  })

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['stock'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        name: form.name,
        sku: form.sku || null,
        category_name: form.category_name || null,
        unit: form.unit,
        min_stock_level: Number(form.min_stock_level) || 0,
        notes: form.notes || null,
        location_mins: Object.fromEntries(
          Object.entries(form.mins).map(([id, v]) => [id, v === '' ? null : Number(v)]),
        ),
      }
      return row ? productsApi.update(row.id, payload) : productsApi.create(payload)
    },
    onSuccess: () => { toast.success(t('stock.saved')); refresh(); onClose() },
  })

  const correct = useMutation({
    mutationFn: () => stockApi.adjust({
      product_id: row!.id, location_id: count.location_id,
      counted_quantity: Number(count.counted), note: count.note || undefined,
    }),
    onSuccess: (res) => {
      toast.success(res.data.changed ? t('stock.corrected', { ref: res.data.reference }) : t('stock.countMatches'))
      refresh()
      onClose()
    },
  })

  const readOnly = !isAdmin

  return (
    <Modal open={open} onClose={onClose} title={row ? row.name : t('stock.newMaterial')} size="lg">
      <form
        onSubmit={(e) => { e.preventDefault(); if (form.name.trim()) save.mutate() }}
        className="space-y-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label={t('stock.name')} required>
              <input className="input-base" disabled={readOnly} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </FormField>
          </div>
          <FormField label="SKU">
            <input className="input-base font-mono" disabled={readOnly} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </FormField>
          <FormField label={t('stock.category')}>
            <input className="input-base" list="category-options" disabled={readOnly} value={form.category_name} onChange={(e) => setForm({ ...form, category_name: e.target.value })} />
            <datalist id="category-options">
              {categories.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </FormField>
          <FormField label={t('stock.unit')}>
            <input className="input-base" list="unit-options" disabled={readOnly} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            <datalist id="unit-options">
              {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
            </datalist>
          </FormField>
          <FormField label={t('stock.defaultMin')} hint={t('stock.defaultMinHint')}>
            <input type="number" min={0} step="any" className="input-base" disabled={readOnly} value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: e.target.value === '' ? 0 : Number(e.target.value) })} />
          </FormField>
        </div>

        <div>
          <p className="eyebrow mb-2">{t('stock.minPerDepot')}</p>
          <div className="rounded-lg border border-line divide-y divide-line">
            {locations.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-sm">{l.name}</span>
                {row && (
                  <span className={`font-mono text-sm ${row.cells[l.id]?.below_min ? 'text-red-600' : 'text-slate-600'}`}>
                    {fmtNum(row.cells[l.id]?.quantity ?? 0)} {row.unit}
                  </span>
                )}
                <input
                  type="number" min={0} step="any" disabled={readOnly}
                  className="input-base w-28 text-right font-mono"
                  placeholder={String(form.min_stock_level || 0)}
                  value={form.mins[l.id]}
                  onChange={(e) => setForm({ ...form, mins: { ...form.mins, [l.id]: e.target.value === '' ? '' : Number(e.target.value) } })}
                  aria-label={`${t('stock.min')} ${l.name}`}
                />
              </div>
            ))}
          </div>
        </div>

        <FormField label={t('stock.notes')}>
          <textarea className="input-base min-h-16" disabled={readOnly} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </FormField>

        {isAdmin && (
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" className="btn-primary" disabled={save.isPending || !form.name.trim()}>
              {save.isPending && <Spinner size="sm" />} {t('common.save')}
            </button>
          </div>
        )}
      </form>

      {row && canCorrect && (
        <form
          onSubmit={(e) => { e.preventDefault(); if (count.counted !== '') correct.mutate() }}
          className="mt-6 pt-5 border-t border-line space-y-3"
        >
          <div>
            <p className="font-semibold text-sm">{t('stock.correction')}</p>
            <p className="text-xs text-slate-500">{t('stock.correctionHint')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_8rem_1fr_auto] gap-2 items-end">
            <select className="input-base" value={count.location_id} onChange={(e) => setCount({ ...count, location_id: Number(e.target.value) })}>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <input
              type="number" min={0} step="any" required className="input-base font-mono text-right"
              placeholder={fmtNum(row.cells[count.location_id]?.quantity ?? 0)}
              value={count.counted}
              onChange={(e) => setCount({ ...count, counted: e.target.value === '' ? '' : Number(e.target.value) })}
              aria-label={t('stock.counted')}
            />
            <input className="input-base" placeholder={t('stock.correctionNote')} value={count.note} onChange={(e) => setCount({ ...count, note: e.target.value })} />
            <button type="submit" className="btn-dark" disabled={correct.isPending || count.counted === ''}>
              {t('stock.correct')}
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
