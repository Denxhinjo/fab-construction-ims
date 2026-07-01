import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'
import { stockMovementsApi, productsApi, categoriesApi } from '../../services/api'
import type { StockMovementListOut, ProductListOut, Category } from '../../types'
import { StatusBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import { format as fmt } from 'date-fns'

const COLORS = ['#F59E0B', '#3B82F6', '#10B981', '#EF4444', '#8B5CF6', '#EC4899', '#6B7280', '#D97706']

export default function Reports() {
  const { t } = useTranslation()
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'))
  const [dateTo, setDateTo] = useState(format(new Date(), 'yyyy-MM-dd'))

  const { data: movementsData, isLoading: loadingMovements } = useQuery<StockMovementListOut>({
    queryKey: ['movements-report', dateFrom, dateTo],
    queryFn: () =>
      stockMovementsApi.list({ page_size: 100, date_from: dateFrom, date_to: dateTo }).then((r) => r.data),
  })

  const { data: productsData } = useQuery<ProductListOut>({
    queryKey: ['products-report'],
    queryFn: () => productsApi.list({ page_size: 200 }).then((r) => r.data),
  })

  const { data: categories } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.list().then((r) => r.data),
  })

  // Build daily movement chart data
  const movementsByDate: Record<string, { date: string; 'Stock In': number; 'Stock Out': number; Adjustment: number }> = {}
  movementsData?.items.forEach((m) => {
    const d = m.movement_date
    if (!movementsByDate[d]) movementsByDate[d] = { date: d, 'Stock In': 0, 'Stock Out': 0, Adjustment: 0 }
    movementsByDate[d][m.movement_type] = (movementsByDate[d][m.movement_type] ?? 0) + m.quantity
  })
  const chartData = Object.values(movementsByDate).sort((a, b) => a.date.localeCompare(b.date))

  // Category distribution by product count
  const categoryData = categories?.map((c) => ({
    name: c.name,
    value: c.product_count,
  })).filter((c) => c.value > 0) ?? []

  // Summary
  const totalIn = movementsData?.items.filter(m => m.movement_type === 'Stock In').reduce((s, m) => s + m.quantity, 0) ?? 0
  const totalOut = movementsData?.items.filter(m => m.movement_type === 'Stock Out').reduce((s, m) => s + m.quantity, 0) ?? 0
  const totalAdj = movementsData?.items.filter(m => m.movement_type === 'Adjustment').length ?? 0
  const lowStockCount = productsData?.items.filter(p => p.is_low_stock).length ?? 0

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('reports.title')}</h1>
          <p className="text-slate-500 text-sm">{t('reports.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-base w-auto" />
          <span className="text-slate-500 text-sm">{t('reports.to')}</span>
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-base w-auto" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t('reports.totalStockIn'), value: totalIn.toLocaleString(), color: 'text-green-600', bg: 'bg-green-50' },
          { label: t('reports.totalStockOut'), value: totalOut.toLocaleString(), color: 'text-red-600', bg: 'bg-red-50' },
          { label: t('reports.adjustments'), value: totalAdj, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('reports.lowStockItems'), value: lowStockCount, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((s) => (
          <div key={s.label} className={`card p-4 ${s.bg}`}>
            <p className="text-xs text-slate-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Movement over time */}
        <div className="xl:col-span-2 card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            {t('reports.stockMovementChart')} — {format(new Date(dateFrom), 'MMM d')} {t('reports.to')} {format(new Date(dateTo), 'MMM d, yyyy')}
          </h2>
          {loadingMovements ? (
            <div className="flex items-center justify-center h-48"><Spinner /></div>
          ) : chartData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
              {t('reports.noMovements')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(v) => fmt(new Date(v), 'MMM d')}
                />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
                  labelFormatter={(v) => fmt(new Date(v as string), 'MMM d, yyyy')}
                />
                <Bar dataKey="Stock In" fill="#10B981" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Stock Out" fill="#EF4444" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Adjustment" fill="#3B82F6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Category distribution */}
        <div className="card p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">{t('reports.productsByCategory')}</h2>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-48 text-slate-400 text-sm">{t('reports.noData')}</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
                  {categoryData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Movement table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-700">
            {t('reports.movementHistory')} ({t('reports.records', { count: movementsData?.total ?? 0 })})
          </h2>
        </div>
        {loadingMovements ? (
          <div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>
        ) : (movementsData?.items.length ?? 0) === 0 ? (
          <p className="text-center text-slate-400 py-10 text-sm">{t('reports.noMovements')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {[
                    t('reports.type'),
                    t('reports.product'),
                    t('reports.qty'),
                    t('reports.previous'),
                    t('reports.new'),
                    t('reports.by'),
                    t('reports.date'),
                    t('reports.reason'),
                  ].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {movementsData?.items.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3"><StatusBadge status={m.movement_type} /></td>
                    <td className="px-4 py-3 font-medium text-slate-700">{m.product?.name ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{m.quantity} {m.product?.unit}</td>
                    <td className="px-4 py-3 text-slate-400 font-mono">{m.previous_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 font-mono">{m.new_quantity ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{m.user?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{format(new Date(m.movement_date), 'MMM d, yyyy')}</td>
                    <td className="px-4 py-3 text-slate-400 max-w-xs truncate">{m.reason ?? '—'}</td>
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
