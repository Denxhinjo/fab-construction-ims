import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  ArrowLeft, Edit2, Plus, ImageOff, Package, MapPin,
  Truck, Tag, AlertTriangle, TrendingUp, TrendingDown, Settings2
} from 'lucide-react'
import { productsApi, stockMovementsApi, mediaUrl } from '../../services/api'
import type { Product, StockMovementListOut, StockMovementCreate } from '../../types'
import { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import toast from 'react-hot-toast'

export default function ProductDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [movementModal, setMovementModal] = useState(false)

  const { data: product, isLoading } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(Number(id)).then((r) => r.data),
  })

  const { data: movementsData } = useQuery<StockMovementListOut>({
    queryKey: ['movements', id],
    queryFn: () => stockMovementsApi.list({ product_id: id, page_size: 10 }).then((r) => r.data),
    enabled: !!id,
  })

  const [movForm, setMovForm] = useState<StockMovementCreate>({
    product_id: Number(id),
    movement_type: 'Stock In',
    quantity: 1,
    reason: '',
    movement_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  })

  const movementMutation = useMutation({
    mutationFn: (data: StockMovementCreate) => stockMovementsApi.create(data),
    onSuccess: () => {
      toast.success(t('productDetail.recordSuccess'))
      qc.invalidateQueries({ queryKey: ['product', id] })
      qc.invalidateQueries({ queryKey: ['movements', id] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setMovementModal(false)
      setMovForm({ ...movForm, quantity: 1, reason: '', notes: '' })
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? t('productDetail.movementFailed'))
    },
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  if (!product) return <p className="text-slate-500 text-center py-16">{t('productDetail.notFound')}</p>

  const movements = movementsData?.items ?? []

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/inventory')} className="btn-secondary py-2 px-3">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{product.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              {product.sku && <span className="text-sm font-mono text-slate-500">SKU: {product.sku}</span>}
              <StatusBadge status={product.status} />
              {product.is_low_stock && (
                <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> {t('productDetail.lowStock')}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setMovementModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('productDetail.recordMovement')}
          </button>
          <button onClick={() => navigate(`/inventory/${id}/edit`)} className="btn-secondary">
            <Edit2 className="w-4 h-4" /> {t('common.edit')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Image & quick stats */}
        <div className="space-y-4">
          {/* Primary image */}
          <div className="card overflow-hidden aspect-square">
            {product.image_url ? (
              <img src={mediaUrl(product.image_url)} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50">
                <ImageOff className="w-12 h-12 text-slate-300" />
                <p className="text-xs text-slate-400 mt-2">{t('productDetail.noImage')}</p>
              </div>
            )}
          </div>
          {/* Secondary images */}
          {(product.image_url_2 || product.image_url_3) && (
            <div className="grid grid-cols-2 gap-2">
              {[product.image_url_2, product.image_url_3].map((url, i) =>
                url ? (
                  <div key={i} className="card overflow-hidden aspect-square">
                    <img src={mediaUrl(url)} alt={`${product.name} ${i + 2}`} className="w-full h-full object-cover" />
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Stock level card */}
          <div className={`card p-5 ${product.is_low_stock ? 'border-red-200 bg-red-50' : ''}`}>
            <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{t('productDetail.currentStock')}</p>
            <p className={`text-4xl font-bold ${product.is_low_stock ? 'text-red-600' : 'text-slate-800'}`}>
              {product.quantity}
            </p>
            <p className="text-sm text-slate-500 mt-0.5">{product.unit}</p>
            <div className="mt-3 pt-3 border-t border-slate-200">
              <div className="flex justify-between text-xs text-slate-500">
                <span>{t('productDetail.minLevel')} {product.min_stock_level} {product.unit}</span>
                {product.unit_price && (
                  <span>{product.price_currency === 'EUR' ? '€' : 'L'}{product.unit_price.toFixed(2)}/unit</span>
                )}
              </div>
              {product.min_stock_level > 0 && (
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      product.is_low_stock ? 'bg-red-500' : 'bg-green-500'
                    }`}
                    style={{
                      width: `${Math.min((product.quantity / (product.min_stock_level * 2)) * 100, 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('productDetail.details')}</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6">
              {product.category && (
                <div className="flex items-start gap-2.5">
                  <Tag className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">{t('productDetail.category')}</p>
                    <p className="text-sm font-medium text-slate-700">{product.category.name}</p>
                  </div>
                </div>
              )}
              {product.location && (
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">{t('productDetail.location')}</p>
                    <p className="text-sm font-medium text-slate-700">{product.location.name}</p>
                    {product.location.city && <p className="text-xs text-slate-400">{product.location.city}</p>}
                  </div>
                </div>
              )}
              {product.supplier && (
                <div className="flex items-start gap-2.5">
                  <Truck className="w-4 h-4 text-slate-400 mt-0.5" />
                  <div>
                    <p className="text-xs text-slate-500">{t('productDetail.supplier')}</p>
                    <p className="text-sm font-medium text-slate-700">{product.supplier.name}</p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <Package className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">{t('productDetail.unit')}</p>
                  <p className="text-sm font-medium text-slate-700">{product.unit}</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Settings2 className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">{t('productDetail.created')}</p>
                  <p className="text-sm font-medium text-slate-700">
                    {format(new Date(product.created_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <Settings2 className="w-4 h-4 text-slate-400 mt-0.5" />
                <div>
                  <p className="text-xs text-slate-500">{t('productDetail.lastUpdated')}</p>
                  <p className="text-sm font-medium text-slate-700">
                    {format(new Date(product.updated_at), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </div>
            {product.description && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">{t('productDetail.description')}</p>
                <p className="text-sm text-slate-600">{product.description}</p>
              </div>
            )}
            {product.notes && (
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">{t('productDetail.notes')}</p>
                <p className="text-sm text-slate-600">{product.notes}</p>
              </div>
            )}
          </div>

          {/* Movement history */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-700">{t('productDetail.stockHistory')}</h2>
              <button onClick={() => setMovementModal(true)} className="btn-primary py-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> {t('productDetail.recordMovement')}
              </button>
            </div>
            {movements.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">{t('productDetail.noMovements')}</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {movements.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        m.movement_type === 'Stock In' ? 'bg-green-100' :
                        m.movement_type === 'Stock Out' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {m.movement_type === 'Stock In' ? (
                          <TrendingUp className="w-4 h-4 text-green-600" />
                        ) : m.movement_type === 'Stock Out' ? (
                          <TrendingDown className="w-4 h-4 text-red-600" />
                        ) : (
                          <Settings2 className="w-4 h-4 text-blue-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-700">{m.movement_type}</p>
                        <p className="text-xs text-slate-400">
                          {m.reason ?? 'No reason'} · {m.user?.full_name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${
                        m.movement_type === 'Stock In' ? 'text-green-600' :
                        m.movement_type === 'Stock Out' ? 'text-red-600' : 'text-blue-600'
                      }`}>
                        {m.movement_type === 'Stock In' ? '+' : m.movement_type === 'Stock Out' ? '-' : '→'}
                        {m.quantity} {product.unit}
                      </p>
                      <p className="text-xs text-slate-400">{format(new Date(m.movement_date), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock Movement Modal */}
      <Modal open={movementModal} onClose={() => setMovementModal(false)} title={t('productDetail.stockMovement')} size="md">
        <div className="space-y-4">
          <FormField label={t('productDetail.movementType')} required>
            <select
              className="input-base"
              value={movForm.movement_type}
              onChange={(e) => setMovForm({ ...movForm, movement_type: e.target.value as never })}
            >
              <option value="Stock In">{t('productDetail.stockIn')}</option>
              <option value="Stock Out">{t('productDetail.stockOut')}</option>
              <option value="Adjustment">{t('productDetail.adjustment')}</option>
            </select>
          </FormField>
          <FormField label={movForm.movement_type === 'Adjustment' ? t('productDetail.newQuantity') : t('inventory.quantity')} required>
            <input
              type="number"
              min="0.01"
              step="any"
              className="input-base"
              value={movForm.quantity}
              onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })}
            />
            <p className="text-xs text-slate-500 mt-1">{t('productDetail.currentQty')} {product.quantity} {product.unit}</p>
          </FormField>
          <FormField label={t('productDetail.reason')}>
            <input
              className="input-base"
              value={movForm.reason}
              onChange={(e) => setMovForm({ ...movForm, reason: e.target.value })}
              placeholder={t('productDetail.reasonPlaceholder')}
            />
          </FormField>
          <FormField label={t('productDetail.date')} required>
            <input
              type="date"
              className="input-base"
              value={movForm.movement_date}
              onChange={(e) => setMovForm({ ...movForm, movement_date: e.target.value })}
            />
          </FormField>
          <FormField label={t('productDetail.additionalNotes')}>
            <textarea
              className="input-base min-h-16 resize-y"
              value={movForm.notes}
              onChange={(e) => setMovForm({ ...movForm, notes: e.target.value })}
              placeholder={t('productDetail.optionalNotes')}
            />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => movementMutation.mutate({ ...movForm, product_id: Number(id) })}
              disabled={movementMutation.isPending}
              className="flex-1 btn-primary justify-center"
            >
              {movementMutation.isPending ? <Spinner size="sm" /> : null}
              {movementMutation.isPending ? t('product.saving') : t('productDetail.record')}
            </button>
            <button onClick={() => setMovementModal(false)} className="btn-secondary">{t('product.cancel')}</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
