import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { Camera, Upload } from 'lucide-react'
import { invoicesApi, locationsApi } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { fmtDate, fmtMoney } from '../../lib/format'
import type { InvoiceListOut, InvoiceStatus, Location } from '../../types'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'

const MAX_FILES = 20
const PARALLEL_UPLOADS = 2
const ACCEPT = 'application/pdf,image/jpeg,image/png'
const DEPOT_KEY = 'receipts.location'

interface Pending { key: string; name: string }

const FILTERS: (InvoiceStatus | 'all')[] = ['all', 'review', 'accepted', 'failed', 'rejected']

export default function ReceiptsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as InvoiceStatus | null) ?? undefined
  const [pending, setPending] = useState<Pending[]>([])
  const [dragging, setDragging] = useState(false)
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })
  const active = locations.filter((l) => l.is_active)
  const [locationId, setLocationId] = useState<number | undefined>(() => {
    const saved = Number(localStorage.getItem(DEPOT_KEY))
    return saved || undefined
  })
  const depot = active.find((l) => l.id === locationId) ? locationId : active[0]?.id

  const { data, isLoading } = useQuery<InvoiceListOut>({
    queryKey: ['invoices', status],
    queryFn: () => invoicesApi.list({ status, page_size: 50 }).then((r) => r.data),
  })

  const upload = useMutation({
    mutationFn: async (files: File[]) => {
      const queue = files.map((f, i) => ({ file: f, key: `${Date.now()}-${i}` }))
      setPending((p) => [...queue.map((q) => ({ key: q.key, name: q.file.name })), ...p])
      let read = 0
      let failed = 0
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          try {
            const res = await invoicesApi.upload(next.file, depot)
            if (res.data.status === 'failed') failed++
            else read++
          } catch {
            failed++
          } finally {
            const done = next.key
            setPending((p) => p.filter((x) => x.key !== done))
            qc.invalidateQueries({ queryKey: ['invoices'] })
          }
        }
      }
      await Promise.all(Array.from({ length: PARALLEL_UPLOADS }, worker))
      return { read, failed }
    },
    onSuccess: ({ read, failed }) => {
      qc.invalidateQueries({ queryKey: ['nav-counts'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (read) toast.success(t('receipts.readDone', { count: read }))
      if (failed) toast.error(t('receipts.readFailed', { count: failed }))
    },
  })

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return
    const files = Array.from(list)
    if (files.length > MAX_FILES) toast.error(t('receipts.tooMany', { max: MAX_FILES }))
    upload.mutate(files.slice(0, MAX_FILES))
  }

  const setStatus = (s: InvoiceStatus | 'all') => {
    const next = new URLSearchParams(params)
    if (s === 'all') next.delete('status')
    else next.set('status', s)
    setParams(next, { replace: true })
  }

  const counts = data?.counts ?? {}

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{t('receipts.title')}</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">{t('receipts.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_20rem] gap-4">
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
          className={`rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-6 py-12 transition-colors ${
            dragging ? 'border-brand-500 bg-brand-50' : 'border-line bg-white'
          }`}
        >
          <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center mb-4">
            <Upload className="w-5 h-5 text-brand-700" />
          </div>
          <p className="text-lg font-semibold">{t('receipts.drop')}</p>
          <p className="text-sm text-slate-500 mt-1 mb-5">{t('receipts.dropHint', { max: MAX_FILES })}</p>
          <button onClick={() => picker.current?.click()} className="btn-primary" disabled={!depot}>
            {t('receipts.choose')}
          </button>
          <input ref={picker} type="file" accept={ACCEPT} multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        <div className="card p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">{t('receipts.depot')}</label>
            <select
              className="input-base mt-1.5 font-medium"
              value={depot ?? ''}
              onChange={(e) => { setLocationId(Number(e.target.value)); localStorage.setItem(DEPOT_KEY, e.target.value) }}
            >
              {active.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">{t('receipts.depotHint')}</p>
          </div>
          <div className="border-t border-line pt-4">
            <button onClick={() => camera.current?.click()} className="w-full flex items-start gap-3 text-left group" disabled={!depot}>
              <Camera className="w-4 h-4 mt-0.5 text-slate-500" />
              <span>
                <span className="block text-sm font-semibold group-hover:text-brand-700">{t('receipts.photo')}</span>
                <span className="block text-xs text-slate-500">{t('receipts.photoHint')}</span>
              </span>
            </button>
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
          </div>
        </div>
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3].map((n) => (
          <li key={n} className="rounded-xl bg-stone-200/50 px-4 py-3 flex gap-3">
            <span className="w-6 h-6 rounded-full bg-ink-900 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{n}</span>
            <span>
              <span className="block text-sm font-semibold">{t(`receipts.step${n}`)}</span>
              <span className="block text-xs text-slate-500">{t(`receipts.step${n}Hint`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="font-semibold">{t('receipts.invoices')}</h2>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const on = (status ?? 'all') === f
              return (
                <button
                  key={f}
                  onClick={() => setStatus(f)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    on ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-slate-700 border-line hover:border-slate-300'
                  }`}
                >
                  {t(`receipts.filter.${f}`)} · {counts[f] ?? 0}
                </button>
              )
            })}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th>{t('receipts.col.invoice')}</th>
                <th>{t('receipts.col.supplier')}</th>
                <th>{t('receipts.col.date')}</th>
                <th className="!text-right">{t('receipts.col.rows')}</th>
                <th className="!text-right">{t('receipts.col.total')}</th>
                <th>{t('receipts.col.depot')}</th>
                <th>{t('receipts.col.status')}</th>
                <th><span className="sr-only">{t('common.actions')}</span></th>
              </tr>
            </thead>
            <tbody className="table-body">
              {pending.map((p) => (
                <tr key={p.key}>
                  <td className="font-mono text-slate-400">—</td>
                  <td className="font-medium truncate max-w-[16rem]">{p.name}</td>
                  <td className="text-slate-500">{t('time.today')}</td>
                  <td className="text-right text-slate-400">—</td>
                  <td className="text-right text-slate-400">—</td>
                  <td className="text-slate-600">{active.find((l) => l.id === depot)?.name}</td>
                  <td><Badge variant="info" dot>{t('receipts.reading')}</Badge></td>
                  <td className="text-right"><span className="inline-flex items-center gap-2 text-xs text-slate-500"><Spinner size="sm" /> {t('receipts.wait')}</span></td>
                </tr>
              ))}
              {isLoading && (
                <tr><td colSpan={8} className="text-center py-10"><Spinner /></td></tr>
              )}
              {data?.items.map((inv) => {
                const open = inv.status === 'review' || inv.status === 'failed'
                return (
                  <tr key={inv.id} className="hover:bg-paper/60 cursor-pointer" onClick={() => navigate(`/receipts/${inv.id}`)}>
                    <td className="font-mono text-xs">{inv.invoice_number ?? '—'}</td>
                    <td className="font-medium max-w-[16rem] truncate">{inv.supplier_name ?? inv.file_name}</td>
                    <td className="text-slate-600">{inv.invoice_date ? fmtDate(inv.invoice_date) : fmtDate(inv.created_at)}</td>
                    <td className="text-right font-mono">{inv.line_count || '—'}</td>
                    <td className="text-right font-mono">{inv.total != null ? fmtMoney(inv.total, inv.currency, 2) : '—'}</td>
                    <td className="text-slate-600">{inv.location?.name ?? '—'}</td>
                    <td><InvoiceStatusBadge status={inv.status} /></td>
                    <td className="text-right">
                      <button className={`${open && inv.status === 'review' ? 'btn-primary' : 'btn-secondary'} !px-3 !py-1.5 text-xs`}>
                        {inv.status === 'review' ? t('receipts.review') : inv.status === 'failed' ? t('receipts.manual') : t('receipts.view')}
                      </button>
                    </td>
                  </tr>
                )
              })}
              {!isLoading && !pending.length && !data?.items.length && (
                <tr><td colSpan={8} className="text-center py-10 text-slate-500">{t('receipts.none')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
