import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Spinner from './components/ui/Spinner'

// Route-level code-split — loaded on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const InventoryList = lazy(() => import('./pages/Inventory/InventoryList'))
const AddEditProduct = lazy(() => import('./pages/Inventory/AddEditProduct'))
const ProductDetail = lazy(() => import('./pages/Inventory/ProductDetail'))
const LocationList = lazy(() => import('./pages/Locations/LocationList'))
const SupplierList = lazy(() => import('./pages/Suppliers/SupplierList'))
const WorkProcessList = lazy(() => import('./pages/WorkProcesses/WorkProcessList'))
const AddEditWorkProcess = lazy(() => import('./pages/WorkProcesses/AddEditWorkProcess'))
const UserManagement = lazy(() => import('./pages/Users/UserManagement'))
const Reports = lazy(() => import('./pages/Reports/Reports'))
const ProjectList = lazy(() => import('./pages/Projects/ProjectList'))
const TransferList = lazy(() => import('./pages/Transfers/TransferList'))
const PurchaseOrderList = lazy(() => import('./pages/PurchaseOrders/PurchaseOrderList'))

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}

export function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) return null
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="inventory" element={<InventoryList />} />
          <Route path="inventory/new" element={<AddEditProduct />} />
          <Route path="inventory/:id" element={<ProductDetail />} />
          <Route path="inventory/:id/edit" element={<AddEditProduct />} />
          <Route path="locations" element={<LocationList />} />
          <Route path="suppliers" element={<SupplierList />} />
          <Route path="work-processes" element={<WorkProcessList />} />
          <Route path="work-processes/new" element={<AddEditWorkProcess />} />
          <Route path="work-processes/:id/edit" element={<AddEditWorkProcess />} />
          <Route path="projects" element={<ProjectList />} />
          <Route path="transfers" element={<TransferList />} />
          <Route path="purchase-orders" element={<PurchaseOrderList />} />
          <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
          <Route path="reports" element={<Reports />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  )
}
