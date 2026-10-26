import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeftRight, ArrowRight, FileText, Truck, TriangleAlert, Upload } from 'lucide-react'
import type { ReactNode } from 'react'
import { dashboardApi } from '../services/api'
import Badge from '../components/ui/Badge'
import Spinner from '../components/ui/Spinner'
import LoadError from '../components/ui/LoadError'
import { fmtLongToday, fmtMoney, fmtNum, fmtWhen, movementBadge, movementQty, movementRoute } from '../lib/format'
import type { Dashboard as DashboardData } from '../types'

function TodoCard({ icon, tone, count, text, action, to }: {
  icon: ReactNode; tone: string; count: number; text: string; action: string; to: string
}) {
  return (
    <div className="card p-5 flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}>{icon}</div>
        <span className="text-3xl font-semibold font-mono text-slate-900">{count}</span>
      </div>
      <p className="text-sm text-slate-600 flex-1 mb-4">{text}</p>
      <Link to={to} className="btn-link">{action} <ArrowRight className="w-3.5 h-3.5" /></Link>
    </div>
  )
}

export default function Dashboard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.get().then((r) => r.data),
  })

  if (isError) return <LoadError onRetry={() => refetch()} />
  if (isLoading || !data) {
    return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
  }

  const { todo } = data
  const maxValue = Math.max(...data.depots.map((d) => d.value), 1)
  const today = fmtLongToday()

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{t('dashboard.title')}</h1>
          <p className="text-sm text-slate-500 mt-1">
            <span className="first-letter:uppercase inline-block">{today}</span> · {t('dashboard.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => navigate('/transfers')} className="btn-secondary">
            <ArrowLeftRight className="w-4 h-4" /> {t('dashboard.newTransfer')}
          </button>
          <button onClick={() => navigate('/receipts')} className="btn-primary">
            <Upload className="w-4 h-4" /> {t('dashboard.uploadInvoice')}
          </button>
        </div>
      </div>

      <section>
        <p className="eyebrow mb-3">{t('dashboard.todo')}</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <TodoCard
            icon={<FileText className="w-[18px] h-[18px] text-amber-700" />} tone="bg-amber-50"
            count={todo.invoices_to_review}
            text={t('dashboard.invoicesToReview', { count: todo.invoices_to_review })}
            action={t('dashboard.reviewInvoices')} to="/receipts?status=review"
          />
          <TodoCard
            icon={<Truck className="w-[18px] h-[18px] text-blue-700" />} tone="bg-blue-50"
            count={todo.transfers_in_transit}
            text={todo.transfer_destinations.length
              ? t('dashboard.transfersTo', { count: todo.transfers_in_transit, places: todo.transfer_destinations.join(', ') })
              : t('dashboard.noTransfers')}
            action={t('dashboard.receiveTransfers')} to="/transfers"
          />
          <TodoCard
            icon={<TriangleAlert className="w-[18px] h-[18px] text-red-700" />} tone="bg-red-50"
            count={todo.below_min}
            text={todo.below_min
              ? t('dashboard.belowMinText', { count: todo.below_min, coverable: todo.below_min_coverable })
              : t('dashboard.noneBelowMin')}
            action={t('dashboard.seeLowStock')} to="/stock?below_min=1"
          />
        </div>
      </section>

      <section>
        <div className="flex items-baseline gap-3 mb-3">
          <p className="eyebrow">{t('dashboard.depots')}</p>
          <p className="text-sm text-slate-500">
            {t('dashboard.totalValue')} <span className="font-mono font-semibold text-slate-900">{fmtMoney(data.total_value, undefined, 0)}</span>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {data.depots.map((d) => (
            <Link key={d.id} to={`/stock?location=${d.id}`} className="card p-5 hover:border-slate-300 transition-colors">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{d.name}</h3>
                {d.city && <span className="text-[11px] uppercase tracking-wide text-slate-400">{d.city}</span>}
              </div>
              <p className="text-2xl font-semibold font-mono mt-3">{fmtMoney(d.value, undefined, 0)}</p>
              <div className="h-1 bg-stone-100 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-ink-900 rounded-full" style={{ width: `${(d.value / maxValue) * 100}%` }} />
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-slate-500">
                <span><b className="text-slate-900">{d.materials}</b> {t('dashboard.materials')}</span>
                <span><b className={d.below_min ? 'text-red-600' : 'text-slate-900'}>{d.below_min}</b> {t('dashboard.belowMin')}</span>
                <span><b className="text-slate-900">{d.incoming}</b> {t('dashboard.incoming')}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-semibold">{t('dashboard.recent')}</h2>
            <Link to="/history" className="btn-link text-xs">{t('dashboard.fullHistory')}</Link>
          </div>
          {data.recent_movements.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">{t('dashboard.noMovements')}</p>
          ) : data.recent_movements.map((m) => {
            const badge = movementBadge(m)
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3 border-b border-line last:border-0">
                <Badge variant={badge.variant} className="w-24 justify-center">{badge.label}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.product?.name} · {movementQty(m)} {m.product?.unit}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{movementRoute(m)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono text-xs text-slate-700">{m.reference_number ?? '—'}</p>
                  <p className="text-xs text-slate-400">{fmtWhen(m.created_at)}</p>
                </div>
              </div>
            )
          })}
        </section>

        <section className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-line">
            <h2 className="font-semibold">{t('dashboard.belowMinTitle')}</h2>
            <Link to="/stock?below_min=1" className="btn-link text-xs">{t('common.all')}</Link>
          </div>
          {data.below_min.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500 text-center">{t('dashboard.noneBelowMin')}</p>
          ) : data.below_min.map((b) => (
            <div key={`${b.product_id}-${b.location_id}`} className="px-5 py-3 border-b border-line last:border-0">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium truncate">{b.product_name}</p>
                <p className="font-mono text-xs text-red-600 whitespace-nowrap">
                  {fmtNum(b.quantity)} / {fmtNum(b.min)} {b.unit}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 mt-0.5">
                <p className="text-xs text-slate-500 truncate">
                  {b.location_name} · {b.source_location_name
                    ? t('dashboard.availableIn', { qty: fmtNum(b.source_quantity), place: b.source_location_name })
                    : t('dashboard.notElsewhere')}
                </p>
                {b.can_transfer > 0 ? (
                  <Link
                    to={`/transfers?from=${b.source_location_id}&to=${b.location_id}&product=${b.product_id}&qty=${b.can_transfer}`}
                    className="btn-link text-xs"
                  >
                    {t('dashboard.transfer')}
                  </Link>
                ) : (
                  <span className="text-xs font-semibold text-brand-700">{t('dashboard.order')}</span>
                )}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
