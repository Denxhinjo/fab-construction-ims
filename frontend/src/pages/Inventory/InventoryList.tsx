import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Filter, Edit2, Trash2, Eye, Package,
  ChevronLeft, ChevronRight, AlertTriangle, ImageOff
} from 'lucide-react'
import { productsApi, categoriesApi, locationsApi, mediaUrl } from '../../services/api'
import type { Product, ProductListOut, Category, Location } from '../../types'
import { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

export default function InventoryList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAdmin } = useAuth()
  const qc = useQueryClient()

  const page = Number(searchParams.get('page') ?? 1)
  const search = searchParams.get('search') ?? ''
  const categoryId = searchParams.get('category_id') ?? ''
  const locationId = searchParams.get('location_id') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const lowStock = searchParams.get('low_stock') === 'true'

  const [filtersOpen, setFiltersOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const { data, isLoading } = useQuery<ProductListOut>({
    queryKey: ['products', { page, search, categoryId, locationId, statusFilter, lowStock }],
    queryFn: () =>
      productsApi.list({
        page,
        page_size: 20,
        search: search || undefined,
        category_id: categoryId || undefined,
        location_id: locationId || undefined,
        status: statusFilter || undefined,
        low_stock: lowStock || undefined,
      }).then((r) => r.data),
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  })

  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => productsApi.delete(id),
    onSuccess: () => {
      toast.success('Product deleted')
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteId(null)
    },
    onError: () => toast.error('Failed to delete product'),
  })

  const setParam = useCallback((key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }, [searchParams, setSearchParams])

  const products = data?.items ?? []

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventory</h1>
          <p className="text-slate-500 text-sm">
            {data?.total ?? 0} products total
          </p>
        </div>
        <button onClick={() => navigate('/inventory/new')} className="btn-primary">
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={search}
              onChange={(e) => setParam('search', e.target.value)}
              className="input-base pl-9"
            />
          </div>

          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`btn-secondary gap-2 ${filtersOpen ? 'bg-brand-50 border-brand-200 text-brand-700' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {(categoryId || locationId || statusFilter || lowStock) && (
              <span className="w-5 h-5 rounded-full bg-brand-500 text-white text-xs flex items-center justify-center">
                {[categoryId, locationId, statusFilter, lowStock].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-100">
            <select
              value={categoryId}
              onChange={(e) => setParam('category_id', e.target.value)}
              className="input-base"
            >
              <option value="">All Categories</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select
              value={locationId}
              onChange={(e) => setParam('location_id', e.target.value)}
              className="input-base"
            >
              <option value="">All Locations</option>
              {locations?.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setParam('status', e.target.value)}
              className="input-base"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="discontinued">Discontinued</option>
            </select>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(e) => setParam('low_stock', e.target.checked ? 'true' : '')}
                className="w-4 h-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
              />
              <span className="text-sm text-slate-700 font-medium">Low stock only</span>
            </label>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : products.length === 0 ? (
          <EmptyState
            icon={<Package className="w-8 h-8 text-slate-400" />}
            title="No products found"
            description="Try adjusting your search or filters, or add a new product."
            action={
              <button onClick={() => navigate('/inventory/new')} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Product
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {products.map((product: Product) => (
                  <tr key={product.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {/* Product image */}
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex-shrink-0 overflow-hidden">
                          {product.image_url ? (
                            <img
                              src={mediaUrl(product.image_url)}
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <ImageOff className="w-4 h-4 text-slate-300" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className="font-semibold text-slate-700 cursor-pointer hover:text-brand-600 truncate"
                            onClick={() => navigate(`/inventory/${product.id}`)}
                          >
                            {product.name}
                          </p>
                          {product.sku && (
                            <p className="text-xs text-slate-400 font-mono">{product.sku}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {product.category ? (
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: product.category.color + '20',
                            color: product.category.color,
                          }}
                        >
                          {product.category.name}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {product.is_low_stock && (
                          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                        )}
                        <span className={`font-semibold ${product.is_low_stock ? 'text-red-600' : 'text-slate-700'}`}>
                          {product.quantity}
                        </span>
                        <span className="text-slate-400 text-xs">{product.unit}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500 hidden lg:table-cell">
                      {product.location?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={product.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/inventory/${product.id}`)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => navigate(`/inventory/${product.id}/edit`)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => setDeleteId(product.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.total_pages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
            <p className="text-sm text-slate-500">
              Page {data.page} of {data.total_pages} ({data.total} items)
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setParam('page', String(page - 1))}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= data.total_pages}
                onClick={() => setParam('page', String(page + 1))}
                className="btn-secondary py-1.5 px-2.5 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title="Delete Product"
        message="Are you sure you want to delete this product? This action cannot be undone and will remove all associated stock movements."
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
