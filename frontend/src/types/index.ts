// Auth
export interface AuthToken {
  access_token: string
  token_type: string
  user_id: number
  role: string
  full_name: string
  email: string
}

// User
export interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: 'admin' | 'user'
  is_active: boolean
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface UserCreate {
  email: string
  username: string
  full_name: string
  password: string
  role: 'admin' | 'user'
  phone?: string
}

export interface UserUpdate {
  email?: string
  full_name?: string
  role?: string
  phone?: string
  is_active?: boolean
  password?: string
}

// Category
export interface Category {
  id: number
  name: string
  description?: string
  color?: string
  product_count: number
  created_at: string
  updated_at: string
}

// Location
export interface Location {
  id: number
  name: string
  address?: string
  city?: string
  manager_name?: string
  contact_email?: string
  contact_phone?: string
  notes?: string
  is_active: boolean
  product_count: number
  created_at: string
  updated_at: string
}

// Supplier
export interface Supplier {
  id: number
  name: string
  contact_name?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  notes?: string
  is_active: boolean
  product_count: number
  created_at: string
  updated_at: string
}

// Product
export interface Product {
  id: number
  name: string
  sku?: string
  category_id?: number
  description?: string
  quantity: number
  unit: string
  min_stock_level: number
  unit_price?: number
  location_id?: number
  supplier_id?: number
  image_url?: string
  status: string
  notes?: string
  is_low_stock: boolean
  category?: { id: number; name: string; color?: string }
  location?: { id: number; name: string; city?: string }
  supplier?: { id: number; name: string }
  created_at: string
  updated_at: string
}

export interface ProductListOut {
  items: Product[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Stock Movement
export interface StockMovement {
  id: number
  product_id: number
  movement_type: 'Stock In' | 'Stock Out' | 'Adjustment'
  quantity: number
  previous_quantity?: number
  new_quantity?: number
  reason?: string
  user_id: number
  movement_date: string
  notes?: string
  reference_number?: string
  product?: { id: number; name: string; sku?: string; quantity: number; unit: string }
  user?: { id: number; full_name: string; email: string; role: string }
  created_at: string
}

export interface StockMovementListOut {
  items: StockMovement[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface StockMovementCreate {
  product_id: number
  movement_type: 'Stock In' | 'Stock Out' | 'Adjustment'
  quantity: number
  reason?: string
  movement_date: string
  notes?: string
  reference_number?: string
}

// Work Process
export type WorkProcessStatus = 'Not Started' | 'Started' | 'In Process' | 'Done'
export type WorkProcessPriority = 'Low' | 'Medium' | 'High' | 'Critical'

export interface WorkProcess {
  id: number
  title: string
  description?: string
  product_id?: number
  assigned_user_id?: number
  location_id?: number
  status: WorkProcessStatus
  priority: WorkProcessPriority
  start_date?: string
  due_date?: string
  completion_date?: string
  notes?: string
  image_url?: string
  product?: { id: number; name: string; sku?: string; quantity: number; unit: string }
  assigned_user?: { id: number; full_name: string; email: string; role: string }
  location?: { id: number; name: string; city?: string }
  created_at: string
  updated_at: string
}

export interface WorkProcessListOut {
  items: WorkProcess[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Dashboard
export interface DashboardStats {
  stats: {
    total_products: number
    low_stock_products: number
    total_locations: number
    active_work_processes: number
    completed_work_processes: number
    total_users: number
  }
  stock_summary: {
    stock_in_30d: number
    stock_out_30d: number
  }
  work_process_by_status: Record<WorkProcessStatus, number>
  recent_activity: Array<{
    id: number
    type: string
    product_name: string
    quantity: number
    unit: string
    user_name: string
    date: string
    created_at: string
  }>
  low_stock_items: Array<{
    id: number
    name: string
    quantity: number
    min_stock_level: number
    unit: string
    location?: string
  }>
}

// Generic paginated list params
export interface ListParams {
  page?: number
  page_size?: number
  search?: string
}
