import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Upload, X, Camera } from 'lucide-react'
import { productsApi, categoriesApi, locationsApi, suppliersApi, mediaUrl } from '../../services/api'
import type { Product, Category, Location, Supplier } from '../../types'
import FormField from '../../components/ui/FormField'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'

export default function AddEditProduct() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
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
        location_id: product.location_id?.toString() ?? '',
        supplier_id: product.supplier_id?.toString() ?? '',
        product_status: product.status,
        notes: product.notes ?? '',
      })
      if (product.image_url) setPreview(mediaUrl(product.image_url) ?? null)
    }
  }, [product, isEdit])

  const mutation = useMutation({
    mutationFn: (formData: FormData) =>
      isEdit ? productsApi.update(Number(id), formData) : productsApi.create(formData),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Product updated!' : 'Product created!')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate(`/inventory/${res.data.id}`)
    },
    onError: (err: { response?: { data?: { detail?: string } } }) => {
      toast.error(err?.response?.data?.detail ?? 'Failed to save product')
    },
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (Number(form.quantity) < 0) e.quantity = 'Quantity cannot be negative'
    if (Number(form.min_stock_level) < 0) e.min_stock_level = 'Min stock level cannot be negative'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== '') fd.append(k, v) })
    if (imageFile) fd.append('image', imageFile)
    mutation.mutate(fd)
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be under 10MB')
      return
    }
    setImageFile(file)
    setPreview(URL.createObjectURL(file))
  }

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  if (isEdit && loadingProduct) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? 'Edit Product' : 'Add Product'}
          </h1>
          <p className="text-slate-500 text-sm">Fill in the product details below</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main info */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Product Name" required error={errors.name}>
                <input className="input-base" value={form.name} onChange={set('name')} placeholder="e.g. W8x31 Steel Beam" />
              </FormField>
              <FormField label="SKU / Item Code">
                <input className="input-base" value={form.sku} onChange={set('sku')} placeholder="e.g. STL-001" />
              </FormField>
            </div>
            <FormField label="Description">
              <textarea
                className="input-base min-h-20 resize-y"
                value={form.description}
                onChange={set('description')}
                placeholder="Product description..."
              />
            </FormField>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Category">
                <select className="input-base" value={form.category_id} onChange={set('category_id')}>
                  <option value="">Select category</option>
                  {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </FormField>
              <FormField label="Status">
                <select className="input-base" value={form.product_status} onChange={set('product_status')}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="discontinued">Discontinued</option>
                </select>
              </FormField>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              Stock & Pricing
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <FormField label="Current Quantity" required error={errors.quantity}>
                <input className="input-base" type="number" step="any" min="0" value={form.quantity} onChange={set('quantity')} />
              </FormField>
              <FormField label="Unit">
                <select className="input-base" value={form.unit} onChange={set('unit')}>
                  {['pcs', 'bags', 'rolls', 'sheets', 'meters', 'kg', 'liters', 'boxes', 'sets', 'pairs', 'tons', 'cases', 'buckets'].map(u => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </FormField>
              <FormField label="Min Stock Level" error={errors.min_stock_level}>
                <input className="input-base" type="number" step="any" min="0" value={form.min_stock_level} onChange={set('min_stock_level')} />
              </FormField>
              <FormField label="Unit Price ($)">
                <input className="input-base" type="number" step="0.01" min="0" value={form.unit_price} onChange={set('unit_price')} placeholder="0.00" />
              </FormField>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">
              Location & Supplier
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Storage Location">
                <select className="input-base" value={form.location_id} onChange={set('location_id')}>
                  <option value="">Select location</option>
                  {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </FormField>
              <FormField label="Supplier">
                <select className="input-base" value={form.supplier_id} onChange={set('supplier_id')}>
                  <option value="">Select supplier</option>
                  {suppliers?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </FormField>
            </div>
            <FormField label="Notes">
              <textarea className="input-base min-h-16 resize-y" value={form.notes} onChange={set('notes')} placeholder="Additional notes..." />
            </FormField>
          </div>
        </div>

        {/* Sidebar: image upload + actions */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Product Image</h2>
            <div
              className="relative aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center cursor-pointer hover:border-brand-400 transition-colors group"
              onClick={() => fileRef.current?.click()}
            >
              {preview ? (
                <>
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setPreview(null); setImageFile(null) }}
                    className="absolute top-2 right-2 w-7 h-7 bg-red-500 rounded-full flex items-center justify-center text-white hover:bg-red-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <div className="text-center p-4">
                  <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-medium">Click to upload image</p>
                  <p className="text-xs text-slate-400 mt-0.5">JPEG, PNG, WebP up to 10MB</p>
                </div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </div>

          <div className="card p-5 space-y-3">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full btn-primary justify-center"
            >
              {mutation.isPending ? <Spinner size="sm" /> : null}
              {mutation.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="w-full btn-secondary justify-center"
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
