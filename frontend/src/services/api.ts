import axios from 'axios'
import toast from 'react-hot-toast'
import i18n from '../i18n'
import type {
  BelowMinItem, Category, Dashboard, Invoice, InvoiceListOut, InvoiceUpdate, Location, NavCounts,
  Paginated, Product, ProductSummary, ProductWrite, SearchResults, StockMovement, StockOut, Supplier,
  WarehouseTransfer,
} from '../types'

//this line picks the backend address: in dev VITE_API_URL is not set and the vite proxy sends /api to localhost:8000,
//in production set VITE_API_URL to the backend address (e.g. https://fab-construction-ims.onrender.com) in the vercel project
export const API_ORIGIN = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
})

//this block attaches the jwt token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

//this block handles errors for every request
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
      //this line shows the field-level validation messages when there are some
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
      //this line leaves conflicts (e.g. an invoice already booked) for the caller to ask about
    } else if (status >= 500) {
      toast.error(i18n.t('common.serverError'))
    } else if (detail && typeof detail === 'string') {
      //this line lets each caller handle 400/404 but still shows a useful toast
      toast.error(detail)
    }
    return Promise.reject(error)
  },
)

export default api

//this section calls the auth endpoints
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

//this section calls the users endpoints
export const usersApi = {
  list: () => api.get('/users'),
  get: (id: number) => api.get(`/users/${id}`),
  create: (data: object) => api.post('/users', data),
  update: (id: number, data: object) => api.put(`/users/${id}`, data),
  delete: (id: number) => api.delete(`/users/${id}`),
}

//this section calls the categories endpoints
export const categoriesApi = {
  list: () => api.get<Category[]>('/categories'),
}

//this section calls the locations endpoints
export const locationsApi = {
  list: () => api.get<Location[]>('/locations'),
  get: (id: number) => api.get(`/locations/${id}`),
  create: (data: object) => api.post('/locations', data),
  update: (id: number, data: object) => api.put(`/locations/${id}`, data),
  delete: (id: number) => api.delete(`/locations/${id}`),
}

//this section calls the suppliers endpoints
export const suppliersApi = {
  list: () => api.get<Supplier[]>('/suppliers'),
  get: (id: number) => api.get(`/suppliers/${id}`),
  create: (data: object) => api.post('/suppliers', data),
  update: (id: number, data: object) => api.put(`/suppliers/${id}`, data),
  delete: (id: number) => api.delete(`/suppliers/${id}`),
}

//this section calls the materials and stock endpoints
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

//this section calls the transfers endpoints
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

//this section calls the invoices endpoints
export const invoicesApi = {
  list: (params?: { status?: string; page?: number; page_size?: number }) =>
    api.get<InvoiceListOut>('/invoices', { params }),
  get: (id: number) => api.get<Invoice>(`/invoices/${id}`),
  //this line allows a long wait because ocr of a scanned page takes several seconds on slow servers
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

//this section calls the dashboard and search endpoints
export const dashboardApi = {
  get: () => api.get<Dashboard>('/dashboard'),
  counts: () => api.get<NavCounts>('/dashboard/counts'),
  belowMin: () => api.get<BelowMinItem[]>('/dashboard/below-min'),
}

export const searchApi = {
  search: (q: string) => api.get<SearchResults>('/search', { params: { q } }),
}
