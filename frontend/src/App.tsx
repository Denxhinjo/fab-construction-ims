import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import InventoryList from './pages/Inventory/InventoryList'
import AddEditProduct from './pages/Inventory/AddEditProduct'
import ProductDetail from './pages/Inventory/ProductDetail'
import LocationList from './pages/Locations/LocationList'
import SupplierList from './pages/Suppliers/SupplierList'
import WorkProcessList from './pages/WorkProcesses/WorkProcessList'
import AddEditWorkProcess from './pages/WorkProcesses/AddEditWorkProcess'
import UserManagement from './pages/Users/UserManagement'
import Reports from './pages/Reports/Reports'
import Spinner from './components/ui/Spinner'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { isAdmin, isLoading } = useAuth()
  if (isLoading) return null
  return isAdmin ? <>{children}</> : <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  const { isAuthenticated } = useAuth()
  return (
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
        <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
        <Route path="reports" element={<Reports />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
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
