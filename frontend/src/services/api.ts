import axios from 'axios'
import toast from 'react-hot-toast'
import i18n from '../i18n'

// In dev: VITE_API_URL is not set, so Vite proxy handles /api -> localhost:8000
// In production (Vercel): set VITE_API_URL = https://<your-backend>.vercel.app in the frontend project env vars
export const API_ORIGIN = import.meta.env.VITE_API_URL || ''

const api = axios.create({
  baseURL: `${API_ORIGIN}/api`,
  headers: { 'Content-Type': 'application/json' },
})

// Prefix media file paths with the backend origin for production
export function mediaUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${API_ORIGIN}${path}`
}

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

// ─── Uploads ────────────────────────────────────────────────────────────────
export const uploadsApi = {
  image: (file: File, folder: 'products' | 'work-processes' = 'products') => {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', folder)
    return api.post<{ url: string }>('/uploads/image', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
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
  list: () => api.get('/categories'),
  get: (id: number) => api.get(`/categories/${id}`),
  create: (data: object) => api.post('/categories', data),
  update: (id: number, data: object) => api.put(`/categories/${id}`, data),
  delete: (id: number) => api.delete(`/categories/${id}`),
}

// ─── Locations ──────────────────────────────────────────────────────────────
export const locationsApi = {
  list: () => api.get('/locations'),
  get: (id: number) => api.get(`/locations/${id}`),
  create: (data: object) => api.post('/locations', data),
  update: (id: number, data: object) => api.put(`/locations/${id}`, data),
  delete: (id: number) => api.delete(`/locations/${id}`),
}

// ─── Suppliers ──────────────────────────────────────────────────────────────
export const suppliersApi = {
  list: () => api.get('/suppliers'),
  get: (id: number) => api.get(`/suppliers/${id}`),
  create: (data: object) => api.post('/suppliers', data),
  update: (id: number, data: object) => api.put(`/suppliers/${id}`, data),
  delete: (id: number) => api.delete(`/suppliers/${id}`),
}

// ─── Products ───────────────────────────────────────────────────────────────
const FORM_HEADERS = { 'Content-Type': 'application/x-www-form-urlencoded' }

export const productsApi = {
  list: (params?: Record<string, unknown>) => api.get('/products', { params }),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: URLSearchParams) => api.post('/products', data.toString(), { headers: FORM_HEADERS }),
  update: (id: number, data: URLSearchParams) => api.put(`/products/${id}`, data.toString(), { headers: FORM_HEADERS }),
  delete: (id: number) => api.delete(`/products/${id}`),
}

// ─── Stock Movements ────────────────────────────────────────────────────────
export const stockMovementsApi = {
  list: (params?: Record<string, unknown>) => api.get('/stock-movements', { params }),
  get: (id: number) => api.get(`/stock-movements/${id}`),
  create: (data: object) => api.post('/stock-movements', data),
  types: () => api.get<string[]>('/stock-movements/types'),
}

// ─── Work Processes ─────────────────────────────────────────────────────────
export const workProcessesApi = {
  list: (params?: Record<string, unknown>) => api.get('/work-processes', { params }),
  get: (id: number) => api.get(`/work-processes/${id}`),
  create: (data: object) => api.post('/work-processes', data),
  update: (id: number, data: object) => api.put(`/work-processes/${id}`, data),
  delete: (id: number) => api.delete(`/work-processes/${id}`),
}

// ─── Projects ───────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: Record<string, unknown>) => api.get('/projects', { params }),
  get: (id: number) => api.get(`/projects/${id}`),
  create: (data: object) => api.post('/projects', data),
  update: (id: number, data: object) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
}

// ─── Warehouse Transfers ─────────────────────────────────────────────────────
export const transfersApi = {
  list: (params?: Record<string, unknown>) => api.get('/transfers', { params }),
  get: (id: number) => api.get(`/transfers/${id}`),
  create: (data: object) => api.post('/transfers', data),
  update: (id: number, data: object) => api.put(`/transfers/${id}`, data),
  receive: (id: number, data: object) => api.post(`/transfers/${id}/receive`, data),
}

// ─── Purchase Orders ─────────────────────────────────────────────────────────
export const purchaseOrdersApi = {
  list: (params?: Record<string, unknown>) => api.get('/purchase-orders', { params }),
  get: (id: number) => api.get(`/purchase-orders/${id}`),
  create: (data: object) => api.post('/purchase-orders', data),
  update: (id: number, data: object) => api.put(`/purchase-orders/${id}`, data),
  receive: (id: number, data: object) => api.post(`/purchase-orders/${id}/receive`, data),
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
}
