import axios from 'axios'
import toast from 'react-hot-toast'
import i18n from '../i18n'
import type {
  BelowMinItem, Category, Dashboard, Invoice, InvoiceListOut, InvoiceUpdate, Location, NavCounts,
  Paginated, Product, ProductSummary, ProductWrite, SearchResults, StockMovement, StockOut, Supplier,
  WarehouseTransfer,
} from '../types'

// In dev: VITE_API_URL is not set, so Vite proxy handles /api -> localhost:8000
// In production (Vercel): set VITE_API_URL = https://<your-backend>.vercel.app in the frontend project env vars
export const API_ORIGIN = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Attach JWT token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Global error handling
api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const detail = error?.response?.data?.detail

    if (status === 401) {
      localStorage.removeItem('access_token')
      localStorage.removeItem('user')
      window.location.href = '/login'
    } else if (status === 403) {
      toast.error(i18n.t('common.accessDenied'))
    } else if (status === 422) {
      // Show field-level validation messages when available
      const body = error?.response?.data
      if (body?.detail && Array.isArray(body.detail)) {
        const msgs = body.detail.map((e: { msg: string }) => e.msg).join('; ')
        toast.error(msgs || i18n.t('common.validationError'))
      } else if (typeof body?.detail === 'string') {
        toast.error(body.detail)
      } else {
        toast.error(i18n.t('common.validationError'))
      }
    } else if (status === 409) {
      // Conflicts (e.g. an invoice already booked) are asked about by the caller.
    } else if (status >= 500) {
      toast.error(i18n.t('common.serverError'))
    } else if (detail && typeof detail === 'string') {
      // Let individual callers handle 400/404 but show a useful toast
      toast.error(detail)
    }
    return Promise.reject(error)
  },
)

export default api

// ─── Auth ───────────────────────────────────────────────────────────────────
export const authApi = {
  login: (username: string, password: string) => {
    const form = new FormData()
    form.append('username', username)
    form.append('password', password)
    return api.post('/auth/login', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  me: () => api.get('/auth/me'),
  changePassword: (old_password: string, new_password: string) =>
    api.post('/auth/change-password', { old_password, new_password }),
}

// ─── Users ──────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get('/users'),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}

// ─── Categories ─────────────────────────────────────────────────────────────
export const categoriesApi = {
  list: () => api.get<Category[]>('/categories'),
}

// ─── Locations ──────────────────────────────────────────────────────────────
export const locationsApi = {
  list: () => api.get<Location[]>('/locations'),
  get: (id: number) => api.get(`/locations/${id}`),
  create: (data: object) => api.post('/locations', data),
  update: (id: number, data: object) => api.put(`/locations/${id}`, data),
  delete: (id: number) => api.delete(`/locations/${id}`),
}

// ─── Suppliers ──────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: () => api.get<Supplier[]>('/suppliers'),
  get: (id: number) => api.get(`/suppliers/${id}`),
  create: (data: object) => api.post('/suppliers', data),
  update: (id: number, data: object) => api.put(`/suppliers/${id}`, data),
  delete: (id: number) => api.delete(`/suppliers/${id}`),
}

// ─── Materials & stock ──────────────────────────────────────────────────────
export const productsApi = {
  search: (search?: string, limit = 20) =>
    api.get<ProductSummary[]>('/products', { params: { search, limit } }),
  get: (id: number) => api.get<Product>(`/products/${id}`),
  create: (data: ProductWrite) => api.post<Product>('/products', data),
  update: (id: number, data: ProductWrite) => api.put<Product>(`/products/${id}`, data),
  archive: (id: number) => api.delete(`/products/${id}`),
}

export const stockApi = {
  matrix: (params?: { search?: string; category_id?: number; location_id?: number; below_min?: boolean }) =>
    api.get<StockOut>('/stock', { params }),
  export: () => api.get<Blob>('/stock/export', { responseType: 'blob' }),
  adjust: (data: { product_id: number; location_id: number; counted_quantity: number; note?: string }) =>
    api.post<{ changed: boolean; reference: string | null }>('/stock/adjust', data),
}

export const movementsApi = {
  list: (params?: Record<string, unknown>) => api.get<Paginated<StockMovement>>('/stock-movements', { params }),
}

// ─── Transfers ──────────────────────────────────────────────────────────────
export const transfersApi = {
  list: (params?: { status?: 'open' | 'closed'; page_size?: number; location_id?: number }) =>
    api.get<Paginated<WarehouseTransfer>>('/transfers', { params }),
  get: (id: number) => api.get<WarehouseTransfer>(`/transfers/${id}`),
  send: (data: {
    source_location_id: number
    destination_location_id: number
    driver?: string
    notes?: string
    items: { product_id: number; quantity: number }[]
  }) => api.post<WarehouseTransfer>('/transfers', data),
  receive: (id: number, items?: { item_id: number; received_quantity: number }[]) =>
    api.post<WarehouseTransfer>(`/transfers/${id}/receive`, items ? { items } : {}),
}

// ─── Invoices ───────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<InvoiceListOut>('/invoices', { params }),
  get: (id: number) => api.get<Invoice>(`/invoices/${id}`),
  // OCR of a scanned page takes several seconds; allow for slow servers.
  upload: (file: File, locationId?: number) => {
    const form = new FormData()
    form.append('file', file)
    if (locationId) form.append('location_id', String(locationId))
    return api.post<Invoice>('/invoices', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120_000,
    })
  },
  file: (id: number) => api.get<Blob>(`/invoices/${id}/file`, { responseType: 'blob' }),
  save: (id: number, data: InvoiceUpdate) => api.put<Invoice>(`/invoices/${id}`, data),
  accept: (id: number, data: InvoiceUpdate) => api.post<Invoice>(`/invoices/${id}/accept`, data),
  reject: (id: number) => api.post<Invoice>(`/invoices/${id}/reject`),
}

// ─── Dashboard & search ─────────────────────────────────────────────────────
export const dashboardApi = {
  get: () => api.get<Dashboard>('/dashboard'),
  counts: () => api.get<NavCounts>('/dashboard/counts'),
  belowMin: () => api.get<BelowMinItem[]>('/dashboard/below-min'),
}

export const searchApi = {
  search: (q: string) => api.get<SearchResults>('/search', { params: { q } }),
}
