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
export type UserRole =
  | 'admin' | 'user' | 'procurement' | 'warehouse_manager'
  | 'warehouse_worker' | 'project_manager' | 'finance' | 'viewer'

export interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  phone?: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface UserSummary {
  id: number
  full_name: string
  email: string
  role: string
}

export interface UserCreate {
  email: string
  username: string
  full_name: string
  password: string
  role: UserRole
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

export interface LocationSummary {
  id: number
  name: string
  city?: string
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
  tax_number?: string
  payment_terms?: string
  lead_time_days?: number
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
  reorder_quantity?: number
  unit_price?: number
  latest_cost?: number
  avg_cost?: number
  location_id?: number
  supplier_id?: number
  brand?: string
  barcode?: string
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

export interface ProductSummary {
  id: number
  name: string
  sku?: string
  quantity: number
  unit: string
}

export interface ProductListOut {
  items: Product[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Stock Movement
export type MovementType =
  | 'Stock In' | 'Stock Out' | 'Adjustment'
  | 'Purchase Receipt' | 'Warehouse Transfer Out' | 'Warehouse Transfer In'
  | 'Project Issue' | 'Project Return' | 'Supplier Return'
  | 'Adjustment In' | 'Adjustment Out' | 'Opening Balance'

export interface StockMovement {
  id: number
  product_id: number
  movement_type: MovementType
  quantity: number
  previous_quantity?: number
  new_quantity?: number
  reason?: string
  user_id: number
  movement_date: string
  notes?: string
  reference_number?: string
  source_location_id?: number
  destination_location_id?: number
  project_id?: number
  purchase_order_id?: number
  transfer_id?: number
  approved_by_id?: number
  received_by_id?: number
  product?: ProductSummary
  user?: UserSummary
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
  movement_type: MovementType
  quantity: number
  reason?: string
  movement_date: string
  notes?: string
  reference_number?: string
  source_location_id?: number
  destination_location_id?: number
  project_id?: number
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
  product?: ProductSummary
  assigned_user?: UserSummary
  location?: LocationSummary
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

// Project
export type ProjectStatus = 'PLANNED' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED'

export interface Project {
  id: number
  code: string
  name: string
  client?: string
  address?: string
  city?: string
  status: ProjectStatus
  start_date?: string
  end_date?: string
  project_manager_id?: number
  notes?: string
  is_active: boolean
  project_manager?: UserSummary
  created_at: string
  updated_at: string
}

export interface ProjectListOut {
  items: Project[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Warehouse Transfer
export type TransferStatus =
  | 'DRAFT' | 'PENDING' | 'APPROVED' | 'DISPATCHED' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'

export interface TransferItem {
  id: number
  product_id: number
  quantity: number
  received_quantity: number
  notes?: string
  product?: ProductSummary
}

export interface WarehouseTransfer {
  id: number
  reference: string
  source_location_id: number
  destination_location_id: number
  status: TransferStatus
  notes?: string
  requested_by_id: number
  approved_by_id?: number
  dispatched_by_id?: number
  received_by_id?: number
  approved_at?: string
  dispatched_at?: string
  received_at?: string
  created_at: string
  updated_at: string
  source_location?: LocationSummary
  destination_location?: LocationSummary
  requested_by?: UserSummary
  approved_by?: UserSummary
  items: TransferItem[]
}

export interface WarehouseTransferListOut {
  items: WarehouseTransfer[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Purchase Order
export type POStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'SENT'
  | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

export interface POItem {
  id: number
  product_id?: number
  description?: string
  quantity: number
  received_quantity: number
  unit_cost?: number
  unit: string
  product?: ProductSummary
}

export interface PurchaseOrder {
  id: number
  po_number: string
  supplier_id: number
  destination_location_id: number
  status: POStatus
  order_date: string
  expected_delivery_date?: string
  notes?: string
  total_amount: number
  currency: string
  created_by_id: number
  approved_by_id?: number
  approved_at?: string
  created_at: string
  updated_at: string
  supplier?: { id: number; name: string }
  destination_location?: LocationSummary
  created_by?: UserSummary
  approved_by?: UserSummary
  items: POItem[]
}

export interface PurchaseOrderListOut {
  items: PurchaseOrder[]
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
    total_inventory_value: number
    active_projects: number
    pending_transfers: number
    open_purchase_orders: number
  }
  stock_summary: {
    stock_in_30d: number
    stock_out_30d: number
    stock_in_prev_30d: number
    stock_out_prev_30d: number
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
  top_moved_products?: Array<{
    id: number
    name: string
    quantity: number
    unit: string
  }>
  movements_this_week?: number
  movements_last_week?: number
}

// Generic paginated list params
export interface ListParams {
  page?: number
  page_size?: number
  search?: string
}
