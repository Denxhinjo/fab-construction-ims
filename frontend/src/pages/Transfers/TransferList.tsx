import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { transfersApi, locationsApi, productsApi } from '../../services/api'
import type { WarehouseTransfer, WarehouseTransferListOut, Location, ProductListOut } from '../../types'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  DRAFT: 'gray',
  PENDING: 'warning',
  APPROVED: 'info',
  DISPATCHED: 'default',
  IN_TRANSIT: 'purple',
  RECEIVED: 'success',
  CANCELLED: 'danger',
}

const NEXT_ACTIONS: Record<string, string[]> = {
  DRAFT: ['PENDING', 'CANCELLED'],
  PENDING: ['APPROVED', 'CANCELLED'],
  APPROVED: ['DISPATCHED', 'CANCELLED'],
  DISPATCHED: ['IN_TRANSIT'],
  IN_TRANSIT: [],
}

const MANAGER_ROLES = new Set(['admin', 'warehouse_manager'])

interface TransferItem { product_id: number; quantity: number; notes: string }

export default function TransferList() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [receiveId, setReceiveId] = useState<number | null>(null)
  const [sourceLocation, setSourceLocation] = useState('')
  const [destLocation, setDestLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<TransferItem[]>([{ product_id: 0, quantity: 1, notes: '' }])

  const isManager = MANAGER_ROLES.has(user?.role ?? '')

  const { data, isLoading } = useQuery<WarehouseTransferListOut>({
    queryKey: ['transfers', page, statusFilter],
    queryFn: () =>
      transfersApi.list({ page, page_size: 20, ...(statusFilter && { status: statusFilter }) }).then(r => r.data),
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then(r => r.data),
  })

  const { data: productsData } = useQuery<ProductListOut>({
    queryKey: ['products-transfer'],
    queryFn: () => productsApi.list({ page_size: 200 }).then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (payload: object) => transfersApi.create(payload),
    onSuccess: () => {
      toast.success(t('common.created'))
      qc.invalidateQueries({ queryKey: ['transfers'] })
      closeModal()
    },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => transfersApi.update(id, { status }),
    onSuccess: () => {
      toast.success(t('common.updated'))
      qc.invalidateQueries({ queryKey: ['transfers'] })
    },
  })

  function closeModal() {
    setModalOpen(false)
    setSourceLocation('')
    setDestLocation('')
    setNotes('')
    setItems([{ product_id: 0, quantity: 1, notes: '' }])
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!sourceLocation || !destLocation) { toast.error(t('transfers.locationsRequired')); return }
    if (sourceLocation === destLocation) { toast.error(t('transfers.differentLocations')); return }
    const validItems = items.filter(i => i.product_id && i.quantity > 0)
    if (!validItems.length) { toast.error(t('transfers.itemsRequired')); return }
    createMut.mutate({
      source_location_id: parseInt(sourceLocation),
      destination_location_id: parseInt(destLocation),
      notes: notes || undefined,
      items: validItems.map(i => ({ product_id: i.product_id, quantity: i.quantity, notes: i.notes || undefined })),
    })
  }

  function addItem() { setItems(prev => [...prev, { product_id: 0, quantity: 1, notes: '' }]) }
  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)) }
  function updateItem(idx: number, field: keyof TransferItem, value: string | number) {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  const transfers = data?.items ?? []
  const totalPages = data?.total_pages ?? 1
  const products = productsData?.items ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('transfers.title')}</h1>
          <p className="text-slate-500 text-sm">{t('transfers.subtitle')}</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" />
          {t('transfers.create')}
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }} className="input-base w-auto">
          <option value="">{t('common.allStatuses')}</option>
          {['DRAFT','PENDING','APPROVED','DISPATCHED','IN_TRANSIT','RECEIVED','CANCELLED'].map(s => (
            <option key={s} value={s}>{t(`transfers.status.${s}`, { defaultValue: s })}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : transfers.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight className="w-10 h-10 text-slate-300" />}
            title={t('transfers.empty')}
            description={t('transfers.emptyDesc')}
            action={{ label: t('transfers.create'), onClick: () => setModalOpen(true) }}
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {transfers.map(tr => (
              <div key={tr.id}>
                <div
                  className="px-5 py-4 hover:bg-slate-50/50 cursor-pointer"
                  onClick={() => setExpandedId(expandedId === tr.id ? null : tr.id)}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {expandedId === tr.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{tr.reference}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {tr.source_location?.name ?? t('common.unknown')} → {tr.destination_location?.name ?? t('common.unknown')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={STATUS_VARIANTS[tr.status] ?? 'gray'}>
                        {t(`transfers.status.${tr.status}`, { defaultValue: tr.status })}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {format(new Date(tr.created_at), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </div>
                </div>

                {expandedId === tr.id && (
                  <div className="px-5 pb-4 bg-slate-50/30 border-t border-slate-100">
                    <div className="mt-3 mb-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">{t('transfers.items')}</p>
                      <div className="space-y-1">
                        {tr.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-slate-700">{item.product?.name ?? `Product #${item.product_id}`}</span>
                            <span className="text-slate-500">
                              {item.received_quantity}/{item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap mt-3">
                      {/* Status transition buttons for managers */}
                      {isManager && (NEXT_ACTIONS[tr.status] ?? []).map(nextStatus => (
                        <button
                          key={nextStatus}
                          onClick={() => updateMut.mutate({ id: tr.id, status: nextStatus })}
                          disabled={updateMut.isPending}
                          className="btn-secondary text-xs"
                        >
                          → {t(`transfers.status.${nextStatus}`, { defaultValue: nextStatus })}
                        </button>
                      ))}
                      {/* Receive button */}
                      {(tr.status === 'DISPATCHED' || tr.status === 'IN_TRANSIT') && (
                        <button
                          onClick={() => setReceiveId(tr.id)}
                          className="btn-primary text-xs"
                        >
                          {t('transfers.receive')}
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

      {/* Create Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={t('transfers.create')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('transfers.sourceWarehouse')} required>
              <select value={sourceLocation} onChange={e => setSourceLocation(e.target.value)} className="input-base">
                <option value="">{t('common.select')}</option>
                {(locations ?? []).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
            <FormField label={t('transfers.destinationWarehouse')} required>
              <select value={destLocation} onChange={e => setDestLocation(e.target.value)} className="input-base">
                <option value="">{t('common.select')}</option>
                {(locations ?? []).filter(l => l.id.toString() !== sourceLocation).map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </FormField>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700">{t('transfers.items')}</p>
              <button type="button" onClick={addItem} className="text-xs text-brand-600 hover:text-brand-700">{t('common.addItem')}</button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <select
                    value={item.product_id}
                    onChange={e => updateItem(idx, 'product_id', parseInt(e.target.value))}
                    className="input-base flex-1"
                  >
                    <option value={0}>{t('common.selectProduct')}</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.quantity} {p.unit})</option>)}
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', parseFloat(e.target.value))}
                    className="input-base w-24"
                    placeholder={t('common.qty')}
                  />
                  {items.length > 1 && (
                    <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 text-sm px-1">✕</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <FormField label={t('common.notes')}>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input-base min-h-[60px]" />
          </FormField>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary">
              {createMut.isPending ? t('common.saving') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick receive dialog — simplified */}
      <ConfirmDialog
        open={receiveId !== null}
        title={t('transfers.confirmReceive')}
        description={t('transfers.confirmReceiveDesc')}
        confirmLabel={t('transfers.receiveAll')}
        onConfirm={async () => {
          if (!receiveId) return
          const transfer = transfers.find(t => t.id === receiveId)
          if (!transfer) return
          await transfersApi.receive(receiveId, {
            items: transfer.items.map(item => ({
              item_id: item.id,
              received_quantity: item.quantity - item.received_quantity,
            })),
          })
          toast.success(t('common.updated'))
          qc.invalidateQueries({ queryKey: ['transfers'] })
          setReceiveId(null)
        }}
        onCancel={() => setReceiveId(null)}
      />
    </div>
  )
}
