import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Package, MapPin, ClipboardList, CheckCircle2, AlertTriangle,
  Users, TrendingUp, TrendingDown, ArrowRight
} from 'lucide-react'
import { dashboardApi } from '../services/api'
import type { DashboardStats } from '../types'
import StatsCard from '../components/ui/StatsCard'
import { StatusBadge } from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import { format } from 'date-fns'

export default function Dashboard() {
  const navigate = useNavigate()
  const { data, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.stats().then((r) => r.data),
    refetchInterval: 60_000,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    )
  }

  const stats = data?.stats
  const recentActivity = data?.recent_activity ?? []
  const lowStockItems = data?.low_stock_items ?? []
  const wpByStatus = data?.work_process_by_status ?? {}

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          Welcome back — here's what's happening at Fab Construction.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatsCard
          label="Total Products"
          value={stats?.total_products ?? 0}
          icon={<Package className="w-6 h-6 text-brand-600" />}
          iconBg="bg-brand-100"
          onClick={() => navigate('/inventory')}
        />
        <StatsCard
          label="Low Stock"
          value={stats?.low_stock_products ?? 0}
          icon={<AlertTriangle className="w-6 h-6 text-red-500" />}
          iconBg="bg-red-100"
          onClick={() => navigate('/inventory?low_stock=true')}
        />
        <StatsCard
          label="Locations"
          value={stats?.total_locations ?? 0}
          icon={<MapPin className="w-6 h-6 text-blue-600" />}
          iconBg="bg-blue-100"
          onClick={() => navigate('/locations')}
        />
        <StatsCard
          label="Active Tasks"
          value={stats?.active_work_processes ?? 0}
          icon={<ClipboardList className="w-6 h-6 text-purple-600" />}
          iconBg="bg-purple-100"
          onClick={() => navigate('/work-processes')}
        />
        <StatsCard
          label="Completed Tasks"
          value={stats?.completed_work_processes ?? 0}
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />}
          iconBg="bg-green-100"
        />
        <StatsCard
          label="Active Users"
          value={stats?.total_users ?? 0}
          icon={<Users className="w-6 h-6 text-slate-600" />}
          iconBg="bg-slate-100"
          onClick={() => navigate('/users')}
        />
      </div>

      {/* Stock summary + WP status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock movement summary */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Stock Movement (30 days)</h3>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Stock In</p>
                <p className="text-xl font-bold text-green-700">
                  +{data?.stock_summary.stock_in_30d.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-red-50 rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Stock Out</p>
                <p className="text-xl font-bold text-red-700">
                  -{data?.stock_summary.stock_out_30d.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Work process by status */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Work Process Status</h3>
          <div className="space-y-3">
            {(['Not Started', 'Started', 'In Process', 'Done'] as const).map((status) => {
              const total = Object.values(wpByStatus).reduce((a, b) => a + b, 0) || 1
              const count = wpByStatus[status] ?? 0
              const pct = Math.round((count / total) * 100)
              const colorMap = {
                'Not Started': 'bg-slate-300',
                Started:       'bg-blue-400',
                'In Process':  'bg-amber-400',
                Done:          'bg-green-500',
              }
              return (
                <div key={status}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-slate-600 font-medium">{status}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${colorMap[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Low stock alert */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-700">Low Stock Alert</h3>
            <button
              onClick={() => navigate('/inventory?low_stock=true')}
              className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
            >
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {lowStockItems.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">No low stock items</p>
          ) : (
            <div className="space-y-3">
              {lowStockItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => navigate(`/inventory/${item.id}`)}
                  className="flex items-center justify-between cursor-pointer hover:bg-slate-50 rounded-lg p-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.location ?? 'No location'}</p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    <p className="text-sm font-bold text-red-600">{item.quantity} {item.unit}</p>
                    <p className="text-xs text-slate-400">min: {item.min_stock_level}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent activity */}
      <div className="card">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-700">Recent Inventory Activity</h3>
          <button
            onClick={() => navigate('/reports')}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium flex items-center gap-1"
          >
            Full report <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">No recent activity</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Quantity</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">By</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((activity) => (
                  <tr key={activity.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-5 py-3">
                      <StatusBadge status={activity.type} />
                    </td>
                    <td className="px-5 py-3 font-medium text-slate-700">{activity.product_name}</td>
                    <td className="px-5 py-3 text-slate-600">
                      {activity.quantity} {activity.unit}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{activity.user_name}</td>
                    <td className="px-5 py-3 text-slate-500">
                      {format(new Date(activity.date), 'MMM d, yyyy')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
