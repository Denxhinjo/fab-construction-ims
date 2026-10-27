import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { ArrowRight, ArrowLeftRight, Printer, Truck, X } from 'lucide-react'
import { stockApi, transfersApi } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Spinner from '../../components/ui/Spinner'
import MaterialPicker from '../../components/ui/MaterialPicker'
import { useAuth } from '../../context/AuthContext'
import { fmtMoney, fmtNum, fmtWhen } from '../../lib/format'
import type { Paginated, StockOut, StockRow, WarehouseTransfer } from '../../types'
import DeliveryNote, { type NoteData } from './DeliveryNote'

interface Line { product_id: number; quantity: number | '' }

const shortName = (name: string) => name.replace(/^Depo\s+/i, '')

function itemsSummary(tr: WarehouseTransfer): string {
  const [first, ...rest] = tr.items
  if (!first) return ''
  const text = `${first.product?.name} · ${fmtNum(first.quantity)} ${first.product?.unit ?? ''}`
  return rest.length ? `${text} +${rest.length}` : text
}

export default function TransfersPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const canWrite = user?.role !== 'viewer'

  const { data: stock } = useQuery<StockOut>({
    queryKey: ['stock', 'all'],
    queryFn: () => stockApi.matrix().then((r) => r.data),
  })
  const { data: open } = useQuery<Paginated<WarehouseTransfer>>({
    queryKey: ['transfers', 'open'],
    queryFn: () => transfersApi.list({ status: 'open', page_size: 50 }).then((r) => r.data),
  })
  const { data: closed } = useQuery<Paginated<WarehouseTransfer>>({
    queryKey: ['transfers', 'closed'],
    queryFn: () => transfersApi.list({ status: 'closed', page_size: 8 }).then((r) => r.data),
  })

  const locations = useMemo(() => stock?.locations ?? [], [stock])
  const byId = useMemo(() => new Map((stock?.rows ?? []).map((r) => [r.id, r])), [stock])

  const [from, setFrom] = useState<number>()
  const [to, setTo] = useState<number>()
  const [lines, setLines] = useState<Line[]>([])
  const [driver, setDriver] = useState('')
  const [note, setNote] = useState('')
  const [printing, setPrinting] = useState<NoteData | null>(null)
  const [differences, setDifferences] = useState<WarehouseTransfer | null>(null)

  //this block sets the defaults and prefills from links like /transfers?from=1&to=2&product=7&qty=32
  useEffect(() => {
    if (!locations.length || from !== undefined) return
    const pFrom = Number(params.get('from')) || locations[0].id
    const pTo = Number(params.get('to')) || locations.find((l) => l.id !== pFrom)?.id
    setFrom(pFrom)
    setTo(pTo)
    const product = Number(params.get('product'))
    if (product) setLines([{ product_id: product, quantity: Number(params.get('qty')) || '' }])
    if (params.get('from') || params.get('product')) setParams({}, { replace: true })
  }, [locations, from, params, setParams])

  const fromName = locations.find((l) => l.id === from)?.name ?? ''
  const toName = locations.find((l) => l.id === to)?.name ?? ''
  const qtyIn = (row: StockRow | undefined, loc?: number) => (row && loc ? row.cells[loc]?.quantity ?? 0 : 0)
  const inStockAtSource = (stock?.rows ?? []).filter((r) => qtyIn(r, from) > 0).length
  const belowAtDest = (stock?.rows ?? []).filter((r) => to && r.cells[to]?.below_min).length

  const fillToMinimum = () => {
    if (!from || !to || !stock) return
    const additions: Line[] = []
    for (const r of stock.rows) {
      const dest = r.cells[to]
      if (!dest?.below_min || lines.some((l) => l.product_id === r.id)) continue
      const qty = Math.min(dest.min - dest.quantity, qtyIn(r, from))
      if (qty > 0) additions.push({ product_id: r.id, quantity: qty })
    }
    if (!additions.length) toast(t('transfers.nothingToFill'))
    setLines((ls) => [...ls, ...additions])
  }

  const value = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (byId.get(l.product_id)?.avg_cost ?? 0), 0)
  const overdrawn = lines.find((l) => Number(l.quantity) > qtyIn(byId.get(l.product_id), from))
  const valid = from && to && from !== to && lines.length > 0 && lines.every((l) => Number(l.quantity) > 0) && !overdrawn

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['transfers'] })
    qc.invalidateQueries({ queryKey: ['stock'] })
    qc.invalidateQueries({ queryKey: ['nav-counts'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const send = useMutation({
    mutationFn: () => transfersApi.send({
      source_location_id: from!, destination_location_id: to!, driver: driver || undefined, notes: note || undefined,
      items: lines.map((l) => ({ product_id: l.product_id, quantity: Number(l.quantity) })),
    }),
    onSuccess: (res) => {
      toast.success(t('transfers.sent', { ref: res.data.reference }))
      setLines([]); setDriver(''); setNote('')
      refresh()
    },
  })
  const receive = useMutation({
    mutationFn: ({ id, items }: { id: number; items?: { item_id: number; received_quantity: number }[] }) =>
      transfersApi.receive(id, items),
    onSuccess: (res) => {
      toast.success(res.data.status === 'RECEIVED' ? t('transfers.receivedFull') : t('transfers.receivedPartial'))
      setDifferences(null)
      refresh()
    },
  })

  const print = (data: NoteData) => setPrinting(data)
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done, { once: true })
    window.print()
    return () => window.removeEventListener('afterprint', done)
  }, [printing])

  const draftNote = (): NoteData => ({
    date: new Date().toISOString(), from: fromName, to: toName, driver, notes: note,
    items: lines.map((l) => {
      const r = byId.get(l.product_id)
      return { name: r?.name ?? '', sku: r?.sku, quantity: Number(l.quantity) || 0, unit: r?.unit ?? '' }
    }),
  })
  const sentNote = (tr: WarehouseTransfer): NoteData => ({
    reference: tr.reference, date: tr.dispatched_at ?? tr.created_at,
    from: tr.source_location?.name ?? '', to: tr.destination_location?.name ?? '', driver: tr.driver, notes: tr.notes,
    items: tr.items.map((it) => ({ name: it.product?.name ?? '', sku: it.product?.sku, quantity: it.quantity, unit: it.product?.unit ?? '' })),
  })

  const highlight = Number(params.get('open'))

  return (
    <>
      <div className="max-w-7xl mx-auto space-y-5 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">{t('transfers.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">{t('transfers.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_22rem] gap-5 items-start">
          <section className="card">
            <div className="px-5 py-4 border-b border-line"><h2 className="font-semibold">{t('transfers.new')}</h2></div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] items-center gap-3">
                <label className="rounded-xl border border-line bg-paper/60 px-4 py-3 block">
                  <span className="eyebrow">{t('transfers.from')}</span>
                  <select className="block w-full bg-transparent font-semibold mt-1 focus:outline-none" value={from ?? ''}
                    onChange={(e) => { setFrom(Number(e.target.value)); setLines([]) }}>
                    {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">{t('transfers.inStock', { count: inStockAtSource })}</span>
                </label>
                <button className="mx-auto w-9 h-9 rounded-full border border-line bg-white flex items-center justify-center hover:bg-paper"
                  onClick={() => { setFrom(to); setTo(from); setLines([]) }} aria-label={t('transfers.swap')}>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <label className="rounded-xl border border-line bg-paper/60 px-4 py-3 block">
                  <span className="eyebrow">{t('transfers.to')}</span>
                  <select className="block w-full bg-transparent font-semibold mt-1 focus:outline-none" value={to ?? ''}
                    onChange={(e) => setTo(Number(e.target.value))}>
                    {locations.filter((l) => l.id !== from).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <span className="text-xs text-slate-500">{t('transfers.belowMinAt', { count: belowAtDest })}</span>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <MaterialPicker
                  className="flex-1 min-w-[16rem]"
                  placeholder={t('transfers.addMaterial')}
                  exclude={lines.map((l) => l.product_id)}
                  hint={(p) => `${fmtNum(qtyIn(byId.get(p.id), from))} ${p.unit} ${t('transfers.inShort', { place: shortName(fromName) })}`}
                  onPick={(p) => setLines((ls) => [...ls, { product_id: p.id, quantity: '' }])}
                />
                <button onClick={fillToMinimum} className="btn-secondary" disabled={!belowAtDest}>{t('transfers.fillToMin')}</button>
              </div>
            </div>

            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="table-head">
                    <tr>
                      <th>{t('transfers.material')}</th>
                      <th className="!text-right">{t('transfers.inPlace', { place: shortName(fromName) })}</th>
                      <th className="!text-right">{t('transfers.inPlaceMin', { place: shortName(toName) })}</th>
                      <th>{t('transfers.quantity')}</th>
                      <th><span className="sr-only">{t('common.delete')}</span></th>
                    </tr>
                  </thead>
                  <tbody className="table-body">
                    {lines.map((l, i) => {
                      const r = byId.get(l.product_id)
                      const dest = to ? r?.cells[to] : undefined
                      const tooMuch = Number(l.quantity) > qtyIn(r, from)
                      return (
                        <tr key={l.product_id}>
                          <td><p className="font-medium">{r?.name}</p><p className="font-mono text-[11px] text-slate-400">{r?.sku}</p></td>
                          <td className="text-right font-mono">{fmtNum(qtyIn(r, from))}</td>
                          <td className={`text-right font-mono ${dest?.below_min ? 'text-red-600' : ''}`}>
                            {fmtNum(dest?.quantity ?? 0)} / {fmtNum(dest?.min ?? 0)}
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <input type="number" min={0} step="any" autoFocus={l.quantity === '' && i === lines.length - 1}
                                className={`input-base w-24 text-right font-mono ${tooMuch ? '!border-red-400 !ring-red-300' : ''}`}
                                value={l.quantity} aria-label={t('transfers.quantityFor', { name: r?.name })}
                                onChange={(e) => setLines((ls) => ls.map((x) => x.product_id === l.product_id ? { ...x, quantity: e.target.value === '' ? '' : Number(e.target.value) } : x))} />
                              <span className="text-slate-500 text-xs">{r?.unit}</span>
                            </div>
                          </td>
                          <td className="text-right">
                            <button onClick={() => setLines((ls) => ls.filter((x) => x.product_id !== l.product_id))} className="text-slate-400 hover:text-red-600 p-1" aria-label={t('common.delete')}>
                              <X className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-line">
              <label className="text-xs font-semibold text-slate-700">{t('transfers.driver')}
                <input className="input-base mt-1" placeholder={t('transfers.driverPlaceholder')} value={driver} onChange={(e) => setDriver(e.target.value)} />
              </label>
              <label className="text-xs font-semibold text-slate-700">{t('transfers.note')}
                <input className="input-base mt-1" placeholder={t('transfers.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </div>
            <div className="px-5 py-4 bg-stone-50 border-t border-line rounded-b-xl flex flex-wrap items-center gap-3">
              <p className="text-sm flex-1">
                <b>{t('transfers.count', { count: lines.length })}</b> · {t('transfers.value')} <b className="font-mono">{fmtMoney(value)}</b>
                {overdrawn && <span className="block text-xs text-red-600 mt-0.5">{t('transfers.tooMuch', { name: byId.get(overdrawn.product_id)?.name })}</span>}
              </p>
              <button className="btn-secondary" disabled={!lines.length} onClick={() => print(draftNote())}>
                <Printer className="w-4 h-4" /> {t('transfers.printNote')}
              </button>
              <button className="btn-primary" disabled={!valid || !canWrite || send.isPending} onClick={() => send.mutate()}>
                {send.isPending ? <Spinner size="sm" /> : <Truck className="w-4 h-4" />} {t('transfers.send')}
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <div>
              <p className="eyebrow mb-3">{t('transfers.inTransit')}</p>
              {!open?.items.length ? (
                <p className="text-sm text-slate-500 card px-4 py-6 text-center">{t('transfers.noneInTransit')}</p>
              ) : (
                <div className="space-y-3">
                  {open.items.map((tr) => (
                    <div key={tr.id} className={`card p-4 ${highlight === tr.id ? 'ring-2 ring-brand-400' : ''}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs">{tr.reference}</span>
                        <Badge variant="info">{t('transfers.onTheWay')}</Badge>
                      </div>
                      <p className="font-semibold mt-2 flex items-center gap-2">
                        {shortName(tr.source_location?.name ?? '')} <ArrowRight className="w-3.5 h-3.5" /> {shortName(tr.destination_location?.name ?? '')}
                      </p>
                      <p className="text-sm mt-1">{itemsSummary(tr)}</p>
                      <p className="text-xs text-slate-500 mt-1">
                        {t('transfers.sentAt', { when: fmtWhen(tr.dispatched_at ?? tr.created_at) })}{tr.driver ? ` · ${tr.driver}` : ''}
                        <button onClick={() => print(sentNote(tr))} className="ml-2 underline hover:text-slate-800">{t('transfers.print')}</button>
                      </p>
                      {canWrite && (
                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <button className="btn-dark" disabled={receive.isPending} onClick={() => receive.mutate({ id: tr.id })}>{t('transfers.arrivedFull')}</button>
                          <button className="btn-secondary" onClick={() => setDifferences(tr)}>{t('transfers.differences')}</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="eyebrow mb-3">{t('transfers.recent')}</p>
              <div className="card divide-y divide-line">
                {!closed?.items.length && <p className="px-4 py-6 text-sm text-slate-500 text-center">{t('transfers.noneRecent')}</p>}
                {closed?.items.map((tr) => {
                  const missing = tr.items.filter((i) => i.received_quantity < i.quantity)
                  return (
                    <div key={tr.id} className={`px-4 py-3 ${highlight === tr.id ? 'bg-brand-50' : ''}`}>
                      <div className="flex justify-between gap-2">
                        <p className="text-sm font-medium">{shortName(tr.source_location?.name ?? '')} → {shortName(tr.destination_location?.name ?? '')}</p>
                        <span className="font-mono text-xs text-slate-500">{tr.reference}</span>
                      </div>
                      {tr.status === 'RECEIVED' ? (
                        <p className="text-xs text-emerald-700 mt-0.5">{t('transfers.closedFull', { when: fmtWhen(tr.received_at) })}</p>
                      ) : (
                        <p className="text-xs text-red-600 mt-0.5">
                          {t('transfers.closedPartial', {
                            missing: missing.map((i) => `${fmtNum(i.quantity - i.received_quantity)} ${i.product?.name ?? ''}`).join(', '),
                          })}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {printing && <DeliveryNote note={printing} />}

      {differences && (
        <ReceiveDifferences
          transfer={differences}
          pending={receive.isPending}
          onClose={() => setDifferences(null)}
          onSubmit={(items) => receive.mutate({ id: differences.id, items })}
        />
      )}
    </>
  )
}

function ReceiveDifferences({ transfer, pending, onClose, onSubmit }: {
  transfer: WarehouseTransfer
  pending: boolean
  onClose: () => void
  onSubmit: (items: { item_id: number; received_quantity: number }[]) => void
}) {
  const { t } = useTranslation()
  const [qty, setQty] = useState<Record<number, number | ''>>(
    () => Object.fromEntries(transfer.items.map((i) => [i.id, i.quantity - i.received_quantity])),
  )
  return (
    <Modal open onClose={onClose} title={t('transfers.differencesTitle', { ref: transfer.reference })}>
      <p className="text-sm text-slate-600 mb-4">{t('transfers.differencesHint')}</p>
      <div className="space-y-2">
        {transfer.items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="flex-1 text-sm">{it.product?.name}</span>
            <span className="text-xs text-slate-500 font-mono">{t('transfers.sentQty', { qty: fmtNum(it.quantity) })}</span>
            <input type="number" min={0} max={it.quantity} step="any" className="input-base w-24 text-right font-mono"
              value={qty[it.id]} aria-label={t('transfers.arrivedQty', { name: it.product?.name })}
              onChange={(e) => setQty({ ...qty, [it.id]: e.target.value === '' ? '' : Number(e.target.value) })} />
            <span className="text-xs text-slate-500 w-12">{it.product?.unit}</span>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-6">
        <button className="btn-secondary" onClick={onClose}>{t('common.cancel')}</button>
        <button className="btn-dark" disabled={pending}
          onClick={() => onSubmit(transfer.items.map((it) => ({ item_id: it.id, received_quantity: Number(qty[it.id]) || 0 })))}>
          <ArrowLeftRight className="w-4 h-4" /> {t('transfers.confirmReceived')}
        </button>
      </div>
    </Modal>
  )
}
