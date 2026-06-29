import axios from 'axios'
import toast from 'react-hot-toast'

const api = axios.create({
  baseURL: '/api',
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
      toast.error('Access denied: insufficient permissions')
    } else if (status === 422) {
      toast.error('Validation error: please check your input')
    } else if (status >= 500) {
      toast.error('Server error. Please try again later.')
    } else if (detail) {
      // Let individual callers handle 400/404 errors with specific messages
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
export const productsApi = {
  list: (params?: Record<string, unknown>) => api.get('/products', { params }),
  get: (id: number) => api.get(`/products/${id}`),
  create: (data: FormData) =>
    api.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id: number, data: FormData) =>
    api.put(`/products/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  delete: (id: number) => api.delete(`/products/${id}`),
}

// ─── Stock Movements ────────────────────────────────────────────────────────
export const stockMovementsApi = {
  list: (params?: Record<string, unknown>) => api.get('/stock-movements', { params }),
  get: (id: number) => api.get(`/stock-movements/${id}`),
  create: (data: object) => api.post('/stock-movements', data),
}

// ─── Work Processes ─────────────────────────────────────────────────────────
export const workProcessesApi = {
  list: (params?: Record<string, unknown>) => api.get('/work-processes', { params }),
  get: (id: number) => api.get(`/work-processes/${id}`),
  create: (data: object) => api.post('/work-processes', data),
  update: (id: number, data: object) => api.put(`/work-processes/${id}`, data),
  delete: (id: number) => api.delete(`/work-processes/${id}`),
}

// ─── Dashboard ──────────────────────────────────────────────────────────────
export const dashboardApi = {
  stats: () => api.get('/dashboard/stats'),
}
