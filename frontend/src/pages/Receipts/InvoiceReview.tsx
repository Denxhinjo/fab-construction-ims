import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Minus, Plus, Trash2 } from 'lucide-react'
import { invoicesApi, locationsApi, suppliersApi } from '../../services/api'
import Badge from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import MaterialPicker from '../../components/ui/MaterialPicker'
import { useAuth } from '../../context/AuthContext'
import { fmtBytes, fmtDate, fmtMoney, fmtNum } from '../../lib/format'
import type { Invoice, InvoiceLine, InvoiceUpdate, LineKind, Location, ProductSummary, Supplier } from '../../types'
import { InvoiceStatusBadge } from './InvoiceStatusBadge'
import { COMMON_UNITS } from '../../lib/units'

// Row issues that need a person; the rest are informational.
const BLOCKING = new Set(['arithmetic_mismatch', 'price_derived', 'missing_numbers', 'unit_unknown'])

interface Row {
  key: string
  id?: number
  line_no: number
  code?: string
  raw_description?: string | null
  kind: LineKind
  quantity: number | null
  unit: string
  unit_price: number | null
  vat_amount?: number | null
  issues: string[]
  needsCheck: boolean
  checked: boolean
  product: ProductSummary | null
  match_method?: InvoiceLine['match_method']
  new_name: string
  new_category: string
  new_min: number | null
  editingMatch: boolean
}

function toRow(l: InvoiceLine): Row {
  return {
    key: `l${l.id}`,
    id: l.id,
    line_no: l.line_no,
    code: l.code,
    raw_description: l.raw_description,
    kind: l.kind,
    quantity: l.quantity ?? null,
    unit: l.unit ?? '',
    unit_price: l.unit_price ?? null,
    vat_amount: l.vat_amount,
    issues: l.issues,
    needsCheck: l.confidence === 'check' && l.kind === 'stock',
    checked: false,
    product: l.product ?? null,
    match_method: l.match_method,
    new_name: l.new_name ?? '',
    new_category: l.new_category ?? '',
    new_min: l.new_min ?? null,
    editingMatch: false,
  }
}

function numberOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function DocumentPreview({ invoice }: { invoice: Invoice }) {
  const { t } = useTranslation()
  const [url, setUrl] = useState<string>()
  const [zoom, setZoom] = useState(1)
  const isPdf = invoice.content_type === 'application/pdf'

  useEffect(() => {
    let objectUrl: string | undefined
    invoicesApi.file(invoice.id).then((res) => {
      objectUrl = URL.createObjectURL(res.data)
      setUrl(objectUrl)
    })
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [invoice.id])

  return (
    <div className="lg:sticky lg:top-0 space-y-2">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5 font-mono truncate">
          <FileText className="w-3.5 h-3.5" /> {invoice.file_name} · {fmtBytes(invoice.file_size)}
          {invoice.used_ocr && <Badge variant="gray" className="ml-1">OCR</Badge>}
        </span>
        {!isPdf && (
          <span className="flex gap-1">
            <button onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="btn-secondary !p-1.5" aria-label={t('review.zoomOut')}><Minus className="w-3.5 h-3.5" /></button>
            <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="btn-secondary !p-1.5" aria-label={t('review.zoomIn')}><Plus className="w-3.5 h-3.5" /></button>
          </span>
        )}
      </div>
      <div className="card overflow-auto h-[45vh] lg:h-[70vh] bg-stone-100">
        {!url ? (
          <div className="h-full flex items-center justify-center"><Spinner /></div>
        ) : isPdf ? (
          <iframe src={url} title={invoice.file_name} className="w-full h-full bg-white" />
        ) : (
          <img src={url} alt={invoice.file_name} style={{ width: `${zoom * 100}%` }} className="max-w-none" />
        )}
      </div>
    </div>
  )
}

export default function InvoiceReview() {
  const { id } = useParams()
  const invoiceId = Number(id)
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { user } = useAuth()

  const { data: invoice, isLoading } = useQuery<Invoice>({
    queryKey: ['invoice', invoiceId],
    queryFn: () => invoicesApi.get(invoiceId).then((r) => r.data),
  })
  const { data: suppliers = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then((r) => r.data),
  })
  const { data: locations = [] } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })

  const [rows, setRows] = useState<Row[]>([])
  const [header, setHeader] = useState({
    supplier: '' as string, newName: '', newTax: '', number: '', date: '', location: '' as string,
  })
  const [duplicateAsk, setDuplicateAsk] = useState(false)
  const [rejectAsk, setRejectAsk] = useState(false)

  useEffect(() => {
    if (!invoice) return
    setRows(invoice.lines.map(toRow))
    setHeader({
      supplier: invoice.supplier_id ? String(invoice.supplier_id) : (invoice.supplier_name_raw || invoice.status === 'failed' ? 'new' : ''),
      newName: invoice.supplier_name_raw ?? '',
      newTax: invoice.supplier_tax_number ?? '',
      number: invoice.invoice_number ?? '',
      date: invoice.invoice_date ?? '',
      location: invoice.location_id ? String(invoice.location_id) : '',
    })
  }, [invoice])

  const editable = !!invoice && (invoice.status === 'review' || invoice.status === 'failed') && user?.role !== 'viewer'

  const update = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch, checked: r.checked || 'quantity' in patch || 'unit' in patch || 'unit_price' in patch || patch.checked === true } : r)))

  const stockRows = rows.filter((r) => r.kind === 'stock')
  const summary = useMemo(() => ({
    matched: stockRows.filter((r) => r.product).length,
    newOnes: stockRows.filter((r) => !r.product).length,
    toCheck: stockRows.filter((r) => r.needsCheck && !r.checked).length,
    extra: rows.filter((r) => r.kind === 'extra').length,
  }), [rows, stockRows])

  const net = rows.filter((r) => r.kind !== 'skip').reduce((s, r) => s + (r.quantity ?? 0) * (r.unit_price ?? 0), 0)
  const linesMatchTotal = invoice?.subtotal != null && Math.abs(net - invoice.subtotal) <= Math.max(1, invoice.subtotal * 0.004)
  const firstUnchecked = stockRows.find((r) => r.needsCheck && !r.checked)
  const missingName = stockRows.find((r) => !r.product && !r.new_name.trim())
  const missingQty = stockRows.find((r) => !r.quantity || r.quantity <= 0)

  const payload = (): InvoiceUpdate => ({
    ...(header.supplier === 'new'
      ? { new_supplier: header.newName.trim() ? { name: header.newName.trim(), tax_number: header.newTax || null } : null, supplier_id: null }
      : { supplier_id: header.supplier ? Number(header.supplier) : null }),
    invoice_number: header.number || null,
    invoice_date: header.date || null,
    location_id: header.location ? Number(header.location) : null,
    lines: rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      raw_description: r.id ? undefined : r.raw_description,
      quantity: r.quantity,
      unit: r.unit || null,
      unit_price: r.unit_price,
      product_id: r.product?.id ?? null,
      new_name: r.product ? null : r.new_name || null,
      new_category: r.product ? null : r.new_category || null,
      new_min: r.product ? null : r.new_min,
    })),
  })

  const done = (next?: number) => {
    qc.invalidateQueries({ queryKey: ['invoices'] })
    qc.invalidateQueries({ queryKey: ['nav-counts'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['stock'] })
    qc.invalidateQueries({ queryKey: ['invoice', invoiceId] })
    navigate(next ? `/receipts/${next}` : '/receipts')
  }
  const nextInQueue = () => invoice?.review_queue.find((q) => q !== invoiceId)

  const save = useMutation({
    mutationFn: () => invoicesApi.save(invoiceId, payload()),
    onSuccess: () => { toast.success(t('review.saved')); done() },
  })
  const accept = useMutation({
    mutationFn: (allowDuplicate: boolean) => invoicesApi.accept(invoiceId, { ...payload(), allow_duplicate: allowDuplicate }),
    onSuccess: (res) => {
      setDuplicateAsk(false)
      toast.success(t('review.accepted', { count: res.data.lines.filter((l) => l.kind === 'stock').length }))
      done(nextInQueue())
    },
    onError: (e: { response?: { status?: number } }) => {
      if (e.response?.status === 409) setDuplicateAsk(true)
    },
  })
  const reject = useMutation({
    mutationFn: () => invoicesApi.reject(invoiceId),
    onSuccess: () => { setRejectAsk(false); toast.success(t('review.rejected')); done(nextInQueue()) },
  })

  if (isLoading || !invoice) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  const supplierName = header.supplier === 'new'
    ? header.newName
    : suppliers.find((s) => String(s.id) === header.supplier)?.name ?? invoice.supplier_name_raw
  const queue = invoice.review_queue
  const pos = queue.indexOf(invoiceId)
  const blocker = !header.location ? t('review.needDepot')
    : !(header.supplier === 'new' ? header.newName.trim() : header.supplier) ? t('review.needSupplier')
    : !stockRows.length ? t('review.needRows')
    : missingQty ? t('review.needQty', { n: missingQty.line_no })
    : missingName ? t('review.needName', { n: missingName.line_no })
    : firstUnchecked ? t('review.needCheck', { n: firstUnchecked.line_no })
    : null

  const addRow = () => setRows((rs) => [...rs, {
    key: `new${Date.now()}`, line_no: rs.length + 1, kind: 'stock', quantity: null, unit: '', unit_price: null,
    raw_description: '', issues: [], needsCheck: false, checked: true, product: null, new_name: '', new_category: '',
    new_min: null, editingMatch: true,
  }])

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            <Link to="/receipts" className="text-brand-700 hover:underline">{t('nav.receipts')}</Link> / <span className="font-mono">{invoice.invoice_number ?? invoice.file_name}</span>
          </p>
          <h1 className="text-xl font-semibold mt-1 flex flex-wrap items-center gap-3">
            {supplierName ? t('review.titleFrom', { supplier: supplierName }) : t('review.title')}
            <InvoiceStatusBadge status={invoice.status} />
          </h1>
        </div>
        {pos >= 0 && queue.length > 1 && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            {t('review.position', { n: pos + 1, total: queue.length })}
            <button className="btn-secondary !p-2" disabled={pos === 0} onClick={() => navigate(`/receipts/${queue[pos - 1]}`)} aria-label={t('common.previous')}><ChevronLeft className="w-4 h-4" /></button>
            <button className="btn-secondary !p-2" disabled={pos === queue.length - 1} onClick={() => navigate(`/receipts/${queue[pos + 1]}`)} aria-label={t('common.next')}><ChevronRight className="w-4 h-4" /></button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-5 items-start">
        <DocumentPreview invoice={invoice} />

        <div className="space-y-4 min-w-0">
          {invoice.read_issues.some((i) => ['ocr_unavailable', 'read_error', 'no_rows'].includes(i)) && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{invoice.read_issues.map((i) => t(`issues.${i}`, { defaultValue: '' })).filter(Boolean).join(' ')} {t('review.enterByHand')}</span>
            </div>
          )}
          {invoice.duplicate_of && editable && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>
                {t('review.duplicate')} <Link to={`/receipts/${invoice.duplicate_of}`} className="font-semibold underline">{t('review.openOther')}</Link>
              </span>
            </div>
          )}

          <div className="card p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <p className="eyebrow">{t('review.supplier')}</p>
              {editable ? (
                <>
                  <select className="input-base mt-1.5" value={header.supplier} onChange={(e) => setHeader({ ...header, supplier: e.target.value })}>
                    <option value="">{t('review.pickSupplier')}</option>
                    {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    <option value="new">+ {t('review.newSupplier')}{invoice.supplier_name_raw ? `: ${invoice.supplier_name_raw}` : ''}</option>
                  </select>
                  {header.supplier === 'new' && (
                    <div className="mt-2 space-y-2">
                      <input className="input-base" placeholder={t('review.supplierName')} value={header.newName} onChange={(e) => setHeader({ ...header, newName: e.target.value })} />
                      <input className="input-base font-mono" placeholder="NIPT" value={header.newTax} onChange={(e) => setHeader({ ...header, newTax: e.target.value })} />
                    </div>
                  )}
                </>
              ) : (
                <p className="font-semibold mt-1">{invoice.supplier?.name ?? '—'}</p>
              )}
              <p className="text-xs mt-1.5 flex items-center gap-1 text-slate-500">
                {header.supplier && header.supplier !== 'new'
                  ? <><Check className="w-3.5 h-3.5 text-emerald-600" /> {t('review.existingSupplier')}</>
                  : header.supplier === 'new' ? t('review.willCreateSupplier') : null}
              </p>
            </div>
            <div>
              <p className="eyebrow">{t('review.numberDate')}</p>
              {editable ? (
                <div className="mt-1.5 space-y-2">
                  <input className="input-base font-mono" value={header.number} placeholder="Nr." onChange={(e) => setHeader({ ...header, number: e.target.value })} />
                  <input type="date" className="input-base" value={header.date} onChange={(e) => setHeader({ ...header, date: e.target.value })} />
                </div>
              ) : (
                <p className="mt-1"><span className="font-mono font-semibold">{invoice.invoice_number ?? '—'}</span><br /><span className="text-sm text-slate-500">{fmtDate(invoice.invoice_date)}</span></p>
              )}
            </div>
            <div>
              <p className="eyebrow">{t('review.totalVat')}</p>
              <p className="font-mono font-semibold text-lg mt-1">{fmtMoney(invoice.total, invoice.currency, 2)}</p>
              {invoice.subtotal != null && (
                <p className={`text-xs mt-1 flex items-center gap-1 ${linesMatchTotal ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {linesMatchTotal ? <><Check className="w-3.5 h-3.5" /> {t('review.matchesRows')}</> : <><AlertTriangle className="w-3.5 h-3.5" /> {t('review.rowsDiffer', { net: fmtMoney(net, invoice.currency, 2) })}</>}
                </p>
              )}
            </div>
            <div className="sm:col-span-3 border-t border-line pt-4">
              <p className="eyebrow">{t('review.receiveIn')}</p>
              {editable ? (
                <select className="input-base mt-1.5 sm:w-64 font-medium" value={header.location} onChange={(e) => setHeader({ ...header, location: e.target.value })}>
                  <option value="">{t('review.pickDepot')}</option>
                  {locations.filter((l) => l.is_active).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              ) : (
                <p className="font-semibold mt-1">{invoice.location?.name ?? '—'}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Badge variant="success">{t('review.chipMatched', { count: summary.matched })}</Badge>
            {summary.newOnes > 0 && <Badge variant="info">{t('review.chipNew', { count: summary.newOnes })}</Badge>}
            {summary.toCheck > 0 && <Badge variant="warning">{t('review.chipCheck', { count: summary.toCheck })}</Badge>}
            {summary.extra > 0 && <Badge variant="gray">{t('review.chipExtra', { count: summary.extra })}</Badge>}
          </div>

          <div className="card overflow-hidden">
            <div className="hidden md:grid grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6.5rem_7rem] gap-3 px-4 py-3 eyebrow border-b border-line">
              <span>#</span><span>{t('review.material')}</span><span className="text-right">{t('review.qty')}</span>
              <span>{t('review.unit')}</span><span className="text-right">{t('review.price')}</span><span className="text-right">{t('review.value')}</span>
            </div>
            {rows.map((r, i) => {
              const unresolved = r.needsCheck && !r.checked
              const value = (r.quantity ?? 0) * (r.unit_price ?? 0)
              return (
                <div key={r.key} className={`px-4 py-4 border-b border-line last:border-0 ${unresolved ? 'bg-amber-50/70' : ''} ${r.kind === 'skip' ? 'opacity-50' : ''}`}>
                  <div className="grid grid-cols-[2rem_minmax(0,1fr)] md:grid-cols-[2rem_minmax(0,1fr)_5.5rem_5.5rem_6.5rem_7rem] gap-3 items-start">
                    <span className="text-sm text-slate-400 pt-1">{i + 1}</span>
                    <div className="min-w-0">
                      {r.kind === 'stock' ? (
                        <p className="font-semibold text-sm">{r.product?.name ?? (r.new_name || t('review.unnamed'))}</p>
                      ) : (
                        <p className="font-semibold text-sm">{r.raw_description}</p>
                      )}
                      {r.raw_description && r.kind === 'stock' && (
                        <p className="font-mono text-[11px] text-slate-500 mt-0.5 break-words">
                          {t('review.onInvoice')}: “{r.raw_description}”{r.code ? ` · ${r.code}` : ''}
                        </p>
                      )}
                      {r.id === undefined && editable && (
                        <input className="input-base mt-1.5 text-xs" placeholder={t('review.descriptionPlaceholder')} value={r.raw_description ?? ''}
                          onChange={(e) => update(r.key, { raw_description: e.target.value })} />
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        {r.kind === 'extra' && <Badge variant="gray">{t('review.extraCost')}</Badge>}
                        {r.kind === 'skip' && <Badge variant="gray">{t('review.skipped')}</Badge>}
                        {r.kind === 'stock' && r.product && (
                          <Badge variant="success">{t(`review.match.${r.match_method ?? 'manual'}`)}{r.product.sku ? ` · ${r.product.sku}` : ''}</Badge>
                        )}
                        {r.kind === 'stock' && !r.product && <Badge variant="info">{t('review.newMaterial')}</Badge>}
                        {unresolved && <Badge variant="warning">{t('review.checkRow')}</Badge>}
                        {editable && (
                          <select className="text-xs bg-transparent text-slate-500 hover:text-slate-800 cursor-pointer" value={r.kind}
                            onChange={(e) => update(r.key, { kind: e.target.value as LineKind, needsCheck: e.target.value === 'stock' && r.needsCheck })}
                            aria-label={t('review.rowKind')}>
                            <option value="stock">{t('review.kind.stock')}</option>
                            <option value="extra">{t('review.kind.extra')}</option>
                            <option value="skip">{t('review.kind.skip')}</option>
                          </select>
                        )}
                        {editable && r.kind === 'stock' && r.product && !r.editingMatch && (
                          <button className="text-xs font-semibold text-blue-700 hover:underline" onClick={() => update(r.key, { editingMatch: true })}>
                            {t('review.change')}
                          </button>
                        )}
                        {editable && r.id === undefined && (
                          <button className="text-slate-400 hover:text-red-600" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={t('common.delete')}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="col-start-2 md:col-start-auto grid grid-cols-4 md:contents gap-2">
                      {editable ? (
                        <>
                          <input className="input-base !px-2 text-right font-mono" inputMode="decimal" value={r.quantity ?? ''} aria-label={t('review.qty')}
                            onChange={(e) => update(r.key, { quantity: numberOrNull(e.target.value) })} />
                          <input className={`input-base !px-2 ${r.issues.includes('unit_unknown') && !r.checked ? '!border-amber-400' : ''}`} list="review-units" value={r.unit} placeholder="?" aria-label={t('review.unit')}
                            onChange={(e) => update(r.key, { unit: e.target.value })} />
                          <input className="input-base !px-2 text-right font-mono" inputMode="decimal" value={r.unit_price ?? ''} aria-label={t('review.price')}
                            onChange={(e) => update(r.key, { unit_price: numberOrNull(e.target.value) })} />
                        </>
                      ) : (
                        <>
                          <span className="text-right font-mono text-sm">{fmtNum(r.quantity)}</span>
                          <span className="text-sm text-slate-600">{r.unit || '—'}</span>
                          <span className="text-right font-mono text-sm">{fmtMoney(r.unit_price, invoice.currency, 2)}</span>
                        </>
                      )}
                      <span className="text-right font-mono text-sm font-semibold pt-2">{fmtMoney(value, invoice.currency, 2)}</span>
                    </div>
                  </div>

                  {unresolved && (
                    <div className="ml-11 mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2.5 text-sm flex flex-wrap items-center gap-3">
                      <span className="flex-1 min-w-[12rem]">
                        {r.issues.filter((x) => BLOCKING.has(x)).map((x) => t(`issues.${x}`, { unit: r.unit })).join(' ')}
                      </span>
                      {editable && (
                        <button className="btn-dark !py-1.5 !px-3 text-xs" onClick={() => update(r.key, { checked: true })}>
                          <Check className="w-3.5 h-3.5" /> {t('review.rowOk')}
                        </button>
                      )}
                    </div>
                  )}

                  {editable && r.kind === 'stock' && (!r.product || r.editingMatch) && (
                    <div className="ml-11 mt-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-3">
                      {!r.product && (
                        <div className="grid grid-cols-1 sm:grid-cols-[1fr_10rem] gap-3">
                          <label className="text-xs font-semibold text-slate-600">{t('review.newName')}
                            <input className="input-base mt-1" value={r.new_name} onChange={(e) => update(r.key, { new_name: e.target.value })} />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">{t('review.category')}
                            <input className="input-base mt-1" value={r.new_category} onChange={(e) => update(r.key, { new_category: e.target.value })} />
                          </label>
                          <label className="text-xs font-semibold text-slate-600">{t('review.minimum')}
                            <input className="input-base mt-1 font-mono" inputMode="decimal" value={r.new_min ?? ''} onChange={(e) => update(r.key, { new_min: numberOrNull(e.target.value) })} />
                          </label>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-blue-800">{r.product ? t('review.linkOther') : t('review.orLink')}</span>
                        <MaterialPicker
                          className="flex-1 min-w-[14rem]"
                          onPick={(p) => update(r.key, { product: p, editingMatch: false, match_method: 'manual', unit: r.unit || p.unit })}
                        />
                        {r.product && (
                          <button className="text-xs font-semibold text-slate-600 hover:underline"
                            onClick={() => update(r.key, { product: null, editingMatch: false, new_name: r.new_name || r.raw_description || '' })}>
                            {t('review.createInstead')}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            <datalist id="review-units">{COMMON_UNITS.map((u) => <option key={u} value={u} />)}</datalist>
            {editable && (
              <button onClick={addRow} className="w-full px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-paper flex items-center gap-2 border-t border-line">
                <Plus className="w-4 h-4" /> {t('review.addRow')}
              </button>
            )}
            <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 px-4 py-3 border-t border-line text-sm text-slate-500 bg-stone-50">
              <span>{t('review.subtotal')} <b className="font-mono text-slate-900">{fmtMoney(invoice.subtotal ?? net, invoice.currency, 2)}</b></span>
              <span>{t('review.vat')} <b className="font-mono text-slate-900">{fmtMoney(invoice.vat_total, invoice.currency, 2)}</b></span>
              <span>{t('review.total')} <b className="font-mono text-slate-900">{fmtMoney(invoice.total, invoice.currency, 2)}</b></span>
            </div>
          </div>

          {editable ? (
            <div className="card p-4 flex flex-wrap items-center gap-3">
              <button onClick={() => setRejectAsk(true)} className="text-sm font-semibold text-red-700 hover:underline">{t('review.reject')}</button>
              <span className="flex-1 text-right text-xs text-slate-500">{blocker}</span>
              <button onClick={() => save.mutate()} disabled={save.isPending} className="btn-secondary">{t('review.saveLater')}</button>
              <button onClick={() => accept.mutate(false)} disabled={!!blocker || accept.isPending} className="btn-primary">
                {accept.isPending ? <Spinner size="sm" /> : <Check className="w-4 h-4" />} {t('review.confirm')}
              </button>
            </div>
          ) : invoice.status === 'accepted' ? (
            <p className="text-sm text-slate-500">
              {t('review.acceptedBy', { who: invoice.accepted_by?.full_name ?? '—', when: fmtDate(invoice.accepted_at) })}
            </p>
          ) : null}
        </div>
      </div>

      <Modal open={duplicateAsk} onClose={() => setDuplicateAsk(false)} title={t('review.duplicateTitle')} size="sm">
        <p className="text-sm text-slate-600 mb-5">{t('review.duplicateText', { number: header.number })}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setDuplicateAsk(false)}>{t('common.cancel')}</button>
          <button className="btn-primary" onClick={() => accept.mutate(true)} disabled={accept.isPending}>{t('review.bookAnyway')}</button>
        </div>
      </Modal>
      <Modal open={rejectAsk} onClose={() => setRejectAsk(false)} title={t('review.rejectTitle')} size="sm">
        <p className="text-sm text-slate-600 mb-5">{t('review.rejectText')}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={() => setRejectAsk(false)}>{t('common.cancel')}</button>
          <button className="btn-danger" onClick={() => reject.mutate()} disabled={reject.isPending}>{t('review.reject')}</button>
        </div>
      </Modal>
    </div>
  )
}
