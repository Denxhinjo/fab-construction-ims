import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Upload, X, Camera } from 'lucide-react'
import { productsApi, categoriesApi, locationsApi, suppliersApi, uploadsApi, mediaUrl } from '../../services/api'
import type { Product, Category, Location, Supplier } from '../../types'
import FormField from '../../components/ui/FormField'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'

const CURRENCIES = [
  { value: 'ALL', label: 'ALL — Albanian Lek' },
  { value: 'EUR', label: 'EUR — Euro' },
]

interface ImageSlot {
  preview: string | null   // object URL or existing URL
  file: File | null        // new file to upload (null = keep existing)
  existingUrl: string | null
}

function emptySlot(): ImageSlot {
  return { preview: null, file: null, existingUrl: null }
}

export default function AddEditProduct() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ]
  const [slots, setSlots] = useState<ImageSlot[]>([emptySlot(), emptySlot(), emptySlot()])
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    description: '',
    quantity: '0',
    unit: 'pcs',
    min_stock_level: '0',
    unit_price: '',
    price_currency: 'ALL',
    location_id: '',
    supplier_id: '',
    product_status: 'active',
    notes: '',
  })

  const { data: product, isLoading: loadingProduct } = useQuery<Product>({
    queryKey: ['product', id],
    queryFn: () => productsApi.get(Number(id)).then((r) => r.data),
    enabled: isEdit,
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  })
  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })
  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then((r) => r.data),
  })

  useEffect(() => {
    if (product && isEdit) {
      setForm({
        name: product.name,
        sku: product.sku ?? '',
        category_id: product.category_id?.toString() ?? '',
        description: product.description ?? '',
        quantity: product.quantity.toString(),
        unit: product.unit,
        min_stock_level: product.min_stock_level.toString(),
        unit_price: product.unit_price?.toString() ?? '',
        price_currency: product.price_currency ?? 'ALL',
        location_id: product.location_id?.toString() ?? '',
        supplier_id: product.supplier_id?.toString() ?? '',
        product_status: product.status,
        notes: product.notes ?? '',
      })
      const urls = [product.image_url, product.image_url_2, product.image_url_3]
      setSlots(urls.map(u => ({
        preview: u ? (mediaUrl(u) ?? null) : null,
        file: null,
        existingUrl: u ?? null,
      })))
    }
  }, [product, isEdit])

  const uploadOne = async (file: File): Promise<string> => {
    const res = await uploadsApi.image(file)
    return res.data.url
  }

  const mutation = useMutation({
    mutationFn: (params: URLSearchParams) =>
      isEdit ? productsApi.update(Number(id), params) : productsApi.create(params),
    onSuccess: (res) => {
      toast.success(isEdit ? t('product.updated') : t('product.created'))
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/inventory/${res.data.id}`)
    },
    onError: (err: { response?: { data?: { detail?: unknown } } }) => {
      const detail = err?.response?.data?.detail
      if (typeof detail === 'string') toast.error(detail)
      else if (Array.isArray(detail)) {
        toast.error(detail.map((d: { msg?: string; loc?: string[] }) =>
          `${d.loc?.slice(-1)[0] ?? 'field'}: ${d.msg ?? 'error'}`).join(', '))
      } else {
        toast.error(t('product.failedToSave'))
      }
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = t('product.nameRequired')
    if (Number(form.quantity) < 0) e.quantity = t('product.quantityNegative')
    if (Number(form.min_stock_level) < 0) e.min_stock_level = t('product.minStockNegative')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setUploading(true)
    const toastId = 'img-upload'
    const resolvedUrls: (string | null)[] = []

    try {
      for (const slot of slots) {
        if (slot.file) {
          toast.loading(t('product.uploadingImage'), { id: toastId })
          const url = await uploadOne(slot.file)
          resolvedUrls.push(url)
        } else {
          resolvedUrls.push(slot.existingUrl)
        }
      }
    } catch {
      toast.dismiss(toastId)
      toast.error(t('product.imageUploadFailed'))
      setUploading(false)
      return
    }
    toast.dismiss(toastId)
    setUploading(false)

    const params = new URLSearchParams()
    Object.entries(form).forEach(([k, v]) => {
      if (v !== '' && !(isEdit && k === 'quantity')) params.append(k, v)
    })
    const urlKeys = ['image_url', 'image_url_2', 'image_url_3'] as const
    resolvedUrls.forEach((url, i) => {
      if (url) params.append(urlKeys[i], url)
    })
    mutation.mutate(params)
  }

  const handleFileChange = (idx: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowed.includes(file.type)) { toast.error('Only JPEG, PNG, WebP or GIF'); return }
    if (file.size > 10 * 1024 * 1024) { toast.error('Image must be under 10MB'); return }
    setSlots(prev => prev.map((s, i) =>
      i === idx ? { ...s, file, preview: URL.createObjectURL(file) } : s
    ))
  }

  const clearSlot = (idx: number) => {
    setSlots(prev => prev.map((s, i) => i === idx ? emptySlot() : s))
  }

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const currencySymbol = form.price_currency === 'EUR' ? '€' : 'L'

  if (isEdit && loadingProduct) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? t('product.editTitle') : t('product.addTitle')}
          </h1>
          <p className="text-slate-500 text-sm">{t('product.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              {t('product.basicInfo')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('product.name')} required error={errors.name}>
                <input className="input-base" value={form.name} onChange={set('name')} placeholder={t('product.namePlaceholder')} />
              </FormField>
              <FormField label={t('product.sku')}>
                <input className="input-base" value={form.sku} onChange={set('sku')} placeholder={t('product.skuPlaceholder')} />
              </FormField>
            </div>
            <FormField label={t('product.description')}>
              <textarea
                className="input-base min-h-20 resize-y"
                value={form.description}
                onChange={set('description')}
                placeholder={t('product.descriptionPlaceholder')}
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('product.category')}>
                <select className="input-base" value={form.category_id} onChange={set('category_id')}>
                  <option value="">{t('product.selectCategory')}</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label={t('product.status')}>
                <select className="input-base" value={form.product_status} onChange={set('product_status')}>
                  <option value="active">{t('common.active')}</option>
                  <option value="inactive">{t('common.inactive')}</option>
                  <option value="discontinued">{t('common.discontinued')}</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              {t('product.stockPricing')}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField
                label={t('product.currentQuantity')}
                required={!isEdit}
                error={errors.quantity}
                hint={isEdit ? t('product.quantityEditHint') : undefined}
              >
                <input
                  className="input-base disabled:bg-slate-50 disabled:text-slate-400"
                  type="number"
                  step="any"
                  min="0"
                  value={form.quantity}
                  onChange={set('quantity')}
                  disabled={isEdit}
                  title={isEdit ? t('product.quantityEditHint') : undefined}
                />
              </FormField>
              <FormField label={t('product.unit')}>
                <select className="input-base" value={form.unit} onChange={set('unit')}>
                  {['pcs', 'bags', 'rolls', 'sheets', 'meters', 'kg', 'liters', 'boxes', 'sets', 'pairs', 'tons', 'cases', 'buckets'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </FormField>
              <FormField label={t('product.minStockLevel')} error={errors.min_stock_level}>
                <input className="input-base" type="number" step="any" min="0" value={form.min_stock_level} onChange={set('min_stock_level')} />
              </FormField>
            </div>

            {/* Price + currency on the same row */}
            <div className="grid grid-cols-2 gap-4">
              <FormField label={t('product.currency')}>
                <select className="input-base" value={form.price_currency} onChange={set('price_currency')}>
                  {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </FormField>
              <FormField label={`${t('product.unitPrice')} (${currencySymbol})`}>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium select-none">
                    {currencySymbol}
                  </span>
                  <input
                    className="input-base pl-7"
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.unit_price}
                    onChange={set('unit_price')}
                    placeholder="0.00"
                  />
                </div>
              </FormField>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              {t('product.locationSupplier')}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t('product.storageLocation')}>
                <select className="input-base" value={form.location_id} onChange={set('location_id')}>
                  <option value="">{t('product.selectLocation')}</option>
                  {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </FormField>
              <FormField label={t('product.supplier')}>
                <select className="input-base" value={form.supplier_id} onChange={set('supplier_id')}>
                  <option value="">{t('product.selectSupplier')}</option>
                  {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label={t('product.notes')}>
              <textarea className="input-base min-h-16 resize-y" value={form.notes} onChange={set('notes')} placeholder={t('product.notesPlaceholder')} />
            </FormField>
          </div>
        </div>

        {/* Sidebar: images + actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">{t('product.productImages')}</h2>
            <p className="text-xs text-slate-400 mb-4">{t('product.uploadHintMulti')}</p>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {slots.map((slot, idx) => (
                <div key={idx}>
                  <div
                    className="relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-brand-400 transition-colors group"
                    onClick={() => fileRefs[idx].current?.click()}
                  >
                    {slot.preview ? (
                      <>
                        <img src={slot.preview} alt={`Image ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="w-5 h-5 text-white" />
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearSlot(idx) }}
                          className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="text-center p-2">
                        <Upload className="w-5 h-5 text-slate-300 mx-auto mb-1" />
                        <p className="text-[10px] text-slate-400">{idx + 1}</p>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileRefs[idx]}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange(idx)}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">{t('product.uploadHint')}</p>
          </div>

          <div className="card p-5 space-y-3">
            <button
              type="submit"
              disabled={mutation.isPending || uploading}
              className="w-full btn-primary justify-center"
            >
              {mutation.isPending || uploading ? <Spinner size="sm" /> : null}
              {mutation.isPending || uploading
                ? t('product.saving')
                : isEdit ? t('product.saveChanges') : t('product.create')}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full btn-secondary justify-center"
            >
              {t('product.cancel')}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
