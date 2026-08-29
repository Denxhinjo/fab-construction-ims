import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { purchaseOrdersApi, suppliersApi, locationsApi, productsApi } from '../../services/api'
import type { PurchaseOrder, PurchaseOrderListOut, Supplier, Location, ProductListOut } from '../../types'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  DRAFT: 'gray',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'info',
  SENT: 'default',
  PARTIALLY_RECEIVED: 'purple',
  RECEIVED: 'success',
  CANCELLED: 'danger',
}

const NEXT_ACTIONS: Record<string, string[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['SENT', 'CANCELLED'],
  SENT: ['PARTIALLY_RECEIVED', 'RECEIVED'],
  PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
}

interface POItemForm { product_id: number; description: string; quantity: number; unit_cost: number; unit: string }

export default function PurchaseOrderList() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [receiveId, setReceiveId] = useState<number | null>(null)
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({})

  const [supplier, setSupplier] = useState('')
  const [location, setLocation] = useState('')
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [expectedDate, setExpectedDate] = useState('')
  const [currency, setCurrency] = useState('ALL')
  const [poNotes, setPoNotes] = useState('')
  const [items, setItems] = useState<POItemForm[]>([{ product_id: 0, description: '', quantity: 1, unit_cost: 0, unit: 'pcs' }])

  const { data, isLoading } = useQuery<PurchaseOrderListOut>({
    queryKey: ['purchase-orders', page, statusFilter],
    queryFn: () =>
      purchaseOrdersApi.list({ page, page_size: 20, ...(statusFilter && { status: statusFilter }) }).then(r => r.data),
  })

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then(r => r.data),
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then(r => r.data),
  })

  const { data: productsData } = useQuery<ProductListOut>({
    queryKey: ['products-po'],
    queryFn: () => productsApi.list({ page_size: 200 }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (payload: object) => purchaseOrdersApi.create(payload),
    onSuccess: () => {
      toast.success(t('common.created'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      closeModal()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => purchaseOrdersApi.update(id, { status }),
    onSuccess: () => {
      toast.success(t('common.updated'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
    },
  })

  const receiveMut = useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: object }) => purchaseOrdersApi.receive(id, payload),
    onSuccess: () => {
      toast.success(t('po.received'))
      qc.invalidateQueries({ queryKey: ['purchase-orders'] })
      setReceiveId(null)
      setReceiveQtys({})
    },
  })

  function closeModal() {
    setModalOpen(false)
    setSupplier('')
    setLocation('')
    setOrderDate(format(new Date(), 'yyyy-MM-dd'))
    setExpectedDate('')
    setPoNotes('')
    setItems([{ product_id: 0, description: '', quantity: 1, unit_cost: 0, unit: 'pcs' }])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supplier || !location) { toast.error(t('po.supplierAndLocationRequired')); return }
    const validItems = items.filter(i => i.quantity > 0)
    if (!validItems.length) { toast.error(t('po.itemsRequired')); return }
    createMut.mutate({
      supplier_id: parseInt(supplier),
      destination_location_id: parseInt(location),
      order_date: orderDate,
      expected_delivery_date: expectedDate || undefined,
      currency,
      notes: poNotes || undefined,
      items: validItems.map(i => ({
        product_id: i.product_id || undefined,
        description: i.description || undefined,
        quantity: i.quantity,
        unit_cost: i.unit_cost || undefined,
        unit: i.unit,
      })),
    })
  }

  function addItem() { setItems(prev => [...prev, { product_id: 0, description: '', quantity: 1, unit_cost: 0, unit: 'pcs' }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof POItemForm, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const orders = data?.items ?? []
  const totalPages = data?.total_pages ?? 1
  const products = productsData?.items ?? []

  const receivePO = orders.find(po => po.id === receiveId)

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('po.title')}</h1>
          <p className="text-slate-500 text-sm">{t('po.subtitle')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('po.create')}
        </button>
      </div>

      {/* Filter */}
      <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="input-base w-auto">
        <option value="">{t('common.allStatuses')}</option>
        {['DRAFT','PENDING_APPROVAL','APPROVED','SENT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED'].map(s => (
          <option key={s} value={s}>{t(`po.status.${s}`, { defaultValue: s.replace('_', ' ') })}</option>
        ))}
      </select>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="w-10 h-10 text-slate-300" />}
            title={t('po.empty')}
            description={t('po.emptyDesc')}
            action={{ label: t('po.create'), onClick: () => setModalOpen(true) }}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map(po => (
              <div key={po.id}>
                <div
                  className="px-5 py-4 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === po.id ? null : po.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {expandedId === po.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{po.po_number}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {po.supplier?.name ?? '—'} → {po.destination_location?.name ?? '—'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={STATUS_VARIANTS[po.status] ?? 'gray'}>
                        {t(`po.status.${po.status}`, { defaultValue: po.status.replace('_', ' ') })}
                      </Badge>
                      <span className="text-xs font-medium text-slate-600">
                        {po.total_amount.toLocaleString()} {po.currency}
                      </span>
                      <span className="text-xs text-slate-400">{format(new Date(po.order_date), 'MMM d, yyyy')}</span>
                    </div>
                  </div>
                </div>

                {expandedId === po.id && (
                  <div className="px-5 pb-4 bg-slate-50/30 border-t border-slate-100">
                    <div className="mt-3 mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('po.items')}</p>
                      <div className="space-y-1">
                        {po.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-700">{item.product?.name ?? item.description ?? `Item #${item.id}`}</span>
                            <span className="text-slate-500">
                              {item.received_quantity}/{item.quantity} {item.unit}
                              {item.unit_cost ? ` × ${item.unit_cost} ${po.currency}` : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap mt-3">
                      {(NEXT_ACTIONS[po.status] ?? []).map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => updateMut.mutate({ id: po.id, status: nextStatus })}
                          disabled={updateMut.isPending}
                          className="btn-secondary text-xs"
                        >
                          → {t(`po.status.${nextStatus}`, { defaultValue: nextStatus.replace('_', ' ') })}
                        </button>
                      ))}
                      {(po.status === 'APPROVED' || po.status === 'SENT' || po.status === 'PARTIALLY_RECEIVED') && (
                        <button
                          onClick={() => {
                            setReceiveId(po.id)
                            const qtys: Record<number, number> = {}
                            po.items.forEach(item => { qtys[item.id] = item.quantity - item.received_quantity })
                            setReceiveQtys(qtys)
                          }}
                          className="btn-primary text-xs"
                        >
                          {t('po.receiveGoods')}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">{t('common.previous')}</button>
          <span className="text-sm text-slate-500 self-center">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">{t('common.next')}</button>
        </div>
      )}

      {/* Create PO Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={t('po.create')} size="xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('po.supplier')} required>
              <select value={supplier} onChange={e => setSupplier(e.target.value)} className="input-base">
                <option value="">{t('common.select')}</option>
                {(suppliers ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('po.destinationWarehouse')} required>
              <select value={location} onChange={e => setLocation(e.target.value)} className="input-base">
                <option value="">{t('common.select')}</option>
                {(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <FormField label={t('po.orderDate')} required>
              <input type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="input-base" />
            </FormField>
            <FormField label={t('po.expectedDelivery')}>
              <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} className="input-base" />
            </FormField>
            <FormField label={t('po.currency')}>
              <select value={currency} onChange={e => setCurrency(e.target.value)} className="input-base">
                {['ALL', 'EUR', 'USD'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FormField>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">{t('po.items')}</p>
              <button type="button" onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700">{t('common.addItem')}</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center flex-wrap">
                  <select
                    value={item.product_id}
                    onChange={e => updateItem(idx, 'product_id', parseInt(e.target.value))}
                    className="input-base flex-1 min-w-[150px]"
                  >
                    <option value={0}>{t('po.selectProduct')}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input
                    type="text"
                    value={item.description}
                    onChange={e => updateItem(idx, 'description', e.target.value)}
                    className="input-base w-32"
                    placeholder={t('po.description')}
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                    className="input-base w-20"
                    placeholder={t('common.qty')}
                  />
                  <input
                    type="number"
                    min={0}
                    value={item.unit_cost}
                    onChange={e => updateItem(idx, 'unit_cost', parseFloat(e.target.value))}
                    className="input-base w-24"
                    placeholder={t('po.unitCost')}
                  />
                  <select value={item.unit} onChange={e => updateItem(idx, 'unit', e.target.value)} className="input-base w-20">
                    {['pcs', 'kg', 'ton', 'm', 'm²', 'm³', 'L', 'bags', 'boxes'].map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-2">
              {t('po.total')}: {items.reduce((s, i) => s + i.quantity * (i.unit_cost || 0), 0).toLocaleString()} {currency}
            </p>
          </div>

          <FormField label={t('common.notes')}>
            <textarea value={poNotes} onChange={e => setPoNotes(e.target.value)} className="input-base min-h-[60px]" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary">
              {createMut.isPending ? t('common.saving') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Receive Goods Modal */}
      {receivePO && (
        <Modal open={receiveId !== null} onClose={() => setReceiveId(null)} title={`${t('po.receiveGoods')} — ${receivePO.po_number}`} size="md">
          <div className="space-y-4">
            <p className="text-sm text-slate-600">{t('po.receiveDesc')}</p>
            <div className="space-y-3">
              {receivePO.items.map(item => {
                const remaining = item.quantity - item.received_quantity
                return (
                  <div key={item.id} className="flex items-center gap-3">
                    <span className="flex-1 text-sm text-slate-700">{item.product?.name ?? item.description ?? `Item #${item.id}`}</span>
                    <span className="text-xs text-slate-400">{t('po.remaining')}: {remaining} {item.unit}</span>
                    <input
                      type="number"
                      min={0}
                      max={remaining}
                      value={receiveQtys[item.id] ?? 0}
                      onChange={e => setReceiveQtys(q => ({ ...q, [item.id]: parseFloat(e.target.value) || 0 }))}
                      className="input-base w-24"
                    />
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setReceiveId(null)} className="btn-secondary">{t('common.cancel')}</button>
              <button
                onClick={() => {
                  receiveMut.mutate({
                    id: receiveId!,
                    payload: {
                      items: receivePO.items
                        .filter(item => (receiveQtys[item.id] ?? 0) > 0)
                        .map(item => ({ item_id: item.id, received_quantity: receiveQtys[item.id] ?? 0 })),
                    },
                  })
                }}
                disabled={receiveMut.isPending}
                className="btn-primary"
              >
                {receiveMut.isPending ? t('common.saving') : t('po.confirmReceipt')}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
