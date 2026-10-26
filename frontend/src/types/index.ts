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

// Materials
export interface ProductSummary {
  id: number
  name: string
  sku?: string
  quantity: number
  unit: string
}

export interface Product extends ProductSummary {
  min_stock_level: number
  unit_price?: number
  avg_cost?: number
  latest_cost?: number
  status: string
  notes?: string
  category?: { id: number; name: string }
  supplier?: { id: number; name: string }
  created_at: string
  updated_at: string
}

export interface ProductWrite {
  name: string
  sku?: string | null
  category_name?: string | null
  unit: string
  min_stock_level: number
  unit_price?: number | null
  notes?: string | null
  location_mins: Record<number, number | null>
}

// Stock matrix: one row per material, one cell per warehouse
export interface StockCell {
  quantity: number
  min: number
  below_min: boolean
}

export interface StockRow {
  id: number
  name: string
  sku?: string
  category?: string
  unit: string
  total: number
  avg_cost?: number
  last_supplier?: string
  min_stock_level: number
  notes?: string
  cells: Record<string, StockCell>
}

export interface StockOut {
  locations: { id: number; name: string }[]
  rows: StockRow[]
  total_materials: number
}

// Movements (history)
export interface StockMovement {
  id: number
  product_id: number
  movement_type: string
  quantity: number
  previous_quantity?: number
  new_quantity?: number
  reason?: string
  movement_date: string
  notes?: string
  reference_number?: string
  source_location_id?: number
  destination_location_id?: number
  transfer_id?: number
  invoice_id?: number
  user_id: number
  product?: ProductSummary
  user?: UserSummary
  source_location?: LocationSummary
  destination_location?: LocationSummary
  created_at: string
}

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// Transfers
export type TransferStatus = 'IN_TRANSIT' | 'DISPATCHED' | 'RECEIVED' | 'RECEIVED_PARTIAL' | 'CANCELLED'

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
  driver?: string
  dispatched_at?: string
  received_at?: string
  created_at: string
  source_location?: LocationSummary
  destination_location?: LocationSummary
  requested_by?: UserSummary
  received_by?: UserSummary
  items: TransferItem[]
}

// Invoices
export type InvoiceStatus = 'review' | 'failed' | 'accepted' | 'rejected'
export type LineKind = 'stock' | 'extra' | 'skip'

export interface InvoiceLine {
  id: number
  line_no: number
  code?: string
  raw_description?: string
  raw_unit?: string
  kind: LineKind
  quantity?: number | null
  unit?: string | null
  unit_price?: number | null
  net_amount?: number | null
  vat_amount?: number | null
  gross_amount?: number | null
  confidence: 'ok' | 'check'
  issues: string[]
  product_id?: number | null
  match_method?: 'alias' | 'sku' | 'name' | 'manual' | 'new' | null
  new_name?: string | null
  new_category?: string | null
  new_min?: number | null
  product?: ProductSummary | null
}

export interface Invoice {
  id: number
  status: InvoiceStatus
  file_name: string
  content_type: string
  file_size: number
  used_ocr: boolean
  read_issues: string[]
  supplier_name_raw?: string
  supplier_tax_number?: string
  supplier_id?: number | null
  supplier?: { id: number; name: string } | null
  invoice_number?: string | null
  invoice_date?: string | null
  currency: string
  subtotal?: number | null
  vat_total?: number | null
  total?: number | null
  location_id?: number | null
  location?: LocationSummary | null
  uploaded_by?: UserSummary
  accepted_by?: UserSummary
  accepted_at?: string
  created_at: string
  lines: InvoiceLine[]
  duplicate_of?: number | null
  review_queue: number[]
}

export interface InvoiceListItem {
  id: number
  status: InvoiceStatus
  file_name: string
  invoice_number?: string
  invoice_date?: string
  supplier_name?: string
  line_count: number
  total?: number
  currency: string
  location?: LocationSummary
  created_at: string
}

export interface InvoiceListOut extends Paginated<InvoiceListItem> {
  counts: Record<string, number>
}

export interface InvoiceLineInput {
  id?: number
  kind: LineKind
  raw_description?: string | null
  quantity?: number | null
  unit?: string | null
  unit_price?: number | null
  product_id?: number | null
  new_name?: string | null
  new_category?: string | null
  new_min?: number | null
}

export interface InvoiceUpdate {
  supplier_id?: number | null
  new_supplier?: { name: string; tax_number?: string | null } | null
  invoice_number?: string | null
  invoice_date?: string | null
  location_id?: number | null
  lines?: InvoiceLineInput[]
  allow_duplicate?: boolean
}

// Dashboard
export interface BelowMinItem {
  product_id: number
  product_name: string
  unit: string
  location_id: number
  location_name: string
  quantity: number
  min: number
  need: number
  source_location_id?: number
  source_location_name?: string
  source_quantity?: number
  can_transfer: number
}

export interface Dashboard {
  todo: {
    invoices_to_review: number
    transfers_in_transit: number
    transfer_destinations: string[]
    below_min: number
    below_min_coverable: number
  }
  total_value: number
  depots: {
    id: number
    name: string
    city?: string
    value: number
    materials: number
    below_min: number
    incoming: number
  }[]
  recent_movements: StockMovement[]
  below_min: BelowMinItem[]
}

export interface NavCounts {
  invoices_to_review: number
  transfers_in_transit: number
}

export interface SearchResults {
  products: { id: number; name: string; sku?: string; quantity: number; unit: string }[]
  invoices: { id: number; status: InvoiceStatus; invoice_number?: string; supplier?: string; file_name: string }[]
  transfers: { id: number; reference: string; status: TransferStatus; source: string; destination: string }[]
}
