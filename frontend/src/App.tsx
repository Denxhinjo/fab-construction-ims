import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ui/ErrorBoundary'
import Layout from './components/layout/Layout'
import Login from './pages/Login'
import Spinner from './components/ui/Spinner'

// Route-level code-split — loaded on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const StockPage = lazy(() => import('./pages/Stock/StockPage'))
const ReceiptsPage = lazy(() => import('./pages/Receipts/ReceiptsPage'))
const InvoiceReview = lazy(() => import('./pages/Receipts/InvoiceReview'))
const TransfersPage = lazy(() => import('./pages/Transfers/TransfersPage'))
const HistoryPage = lazy(() => import('./pages/History/HistoryPage'))
const LocationList = lazy(() => import('./pages/Locations/LocationList'))
const SupplierList = lazy(() => import('./pages/Suppliers/SupplierList'))
const UserManagement = lazy(() => import('./pages/Users/UserManagement'))

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
          <Route path="stock" element={<StockPage />} />
          <Route path="receipts" element={<ReceiptsPage />} />
          <Route path="receipts/:id" element={<InvoiceReview />} />
          <Route path="transfers" element={<TransfersPage />} />
          <Route path="history" element={<HistoryPage />} />
          <Route path="locations" element={<LocationList />} />
          <Route path="suppliers" element={<SupplierList />} />
          <Route path="users" element={<AdminRoute><UserManagement /></AdminRoute>} />
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
