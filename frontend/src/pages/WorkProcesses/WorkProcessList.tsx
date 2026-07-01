import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import {
  Plus, Search, ClipboardList, Edit2, Trash2, Calendar,
  MapPin, User, ChevronLeft, ChevronRight, Filter
} from 'lucide-react'
import { workProcessesApi, mediaUrl } from '../../services/api'
import type { WorkProcess, WorkProcessListOut } from '../../types'
import { StatusBadge, PriorityBadge } from '../../components/ui/Badge'
import Spinner from '../../components/ui/Spinner'
import EmptyState from '../../components/ui/EmptyState'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import toast from 'react-hot-toast'

export default function WorkProcessList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const page = Number(searchParams.get('page') ?? 1)
  const search = searchParams.get('search') ?? ''
  const statusFilter = searchParams.get('status') ?? ''
  const priorityFilter = searchParams.get('priority') ?? ''

  const { data, isLoading } = useQuery<WorkProcessListOut>({
    queryKey: ['work-processes', { page, search, statusFilter, priorityFilter }],
    queryFn: () =>
      workProcessesApi.list({
        page,
        page_size: 15,
        search: search || undefined,
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      }).then((r) => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => workProcessesApi.delete(id),
    onSuccess: () => {
      toast.success(t('workProcesses.deleted'))
      qc.invalidateQueries({ queryKey: ['work-processes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      setDeleteId(null)
    },
    onError: () => toast.error(t('workProcesses.failedToSave')),
  })

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value); else next.delete(key)
    next.delete('page')
    setSearchParams(next)
  }

  const workProcesses = data?.items ?? []

  const statusColors: Record<string, string> = {
    'Not Started': 'border-l-slate-300',
    Started:       'border-l-blue-400',
    'In Process':  'border-l-amber-400',
    Done:          'border-l-green-500',
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('workProcesses.title')}</h1>
          <p className="text-slate-500 text-sm">{t('workProcesses.tasksTotal', { count: data?.total ?? 0 })}</p>
        </div>
        <button onClick={() => navigate('/work-processes/new')} className="btn-primary">
          <Plus className="w-4 h-4" /> {t('workProcesses.newTask')}
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={t('workProcesses.searchTasks')}
              value={search}
              onChange={(e) => setParam('search', e.target.value)}
              className="input-base pl-9"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={`btn-secondary ${filtersOpen ? 'bg-brand-50 border-brand-200 text-brand-700' : ''}`}
          >
            <Filter className="w-4 h-4" /> {t('workProcesses.filters')}
          </button>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <select value={statusFilter} onChange={(e) => setParam('status', e.target.value)} className="input-base">
              <option value="">{t('workProcesses.allStatuses')}</option>
              {['Not Started', 'Started', 'In Process', 'Done'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select value={priorityFilter} onChange={(e) => setParam('priority', e.target.value)} className="input-base">
              <option value="">{t('workProcesses.allPriorities')}</option>
              {['Low', 'Medium', 'High', 'Critical'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : workProcesses.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="w-8 h-8 text-slate-400" />}
          title={t('workProcesses.noTasks')}
          description={t('workProcesses.noTasksDesc')}
          action={
            <button onClick={() => navigate('/work-processes/new')} className="btn-primary">
              <Plus className="w-4 h-4" /> {t('workProcesses.newTask')}
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {workProcesses.map((wp: WorkProcess) => (
            <div
              key={wp.id}
              className={`card p-4 border-l-4 hover:shadow-md transition-shadow ${statusColors[wp.status] ?? 'border-l-slate-200'}`}
            >
              <div className="flex items-start justify-between gap-3">
                {/* Work process image thumbnail */}
                {wp.image_url && (
                  <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-slate-100">
                    <img src={mediaUrl(wp.image_url)} alt={wp.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold text-slate-800 truncate">{wp.title}</h3>
                    <StatusBadge status={wp.status} />
                    <PriorityBadge priority={wp.priority} />
                  </div>
                  {wp.description && (
                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">{wp.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                    {wp.assigned_user && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {wp.assigned_user.full_name}
                      </span>
                    )}
                    {wp.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {wp.location.name}
                      </span>
                    )}
                    {wp.due_date && (
                      <span className={`flex items-center gap-1 ${
                        new Date(wp.due_date) < new Date() && wp.status !== 'Done'
                          ? 'text-red-500 font-medium' : ''
                      }`}>
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(wp.due_date) < new Date() && wp.status !== 'Done'
                          ? t('workProcesses.dueOverdue')
                          : t('workProcesses.due')}{' '}
                        {format(new Date(wp.due_date), 'MMM d, yyyy')}
                      </span>
                    )}
                    {wp.product && (
                      <span className="flex items-center gap-1 text-slate-400">
                        📦 {wp.product.name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/work-processes/${wp.id}/edit`)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteId(wp.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {t('dashboard.page', { current: data.page, total: data.total_pages })}
          </p>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => setParam('page', String(page - 1))} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button disabled={page >= data.total_pages} onClick={() => setParam('page', String(page + 1))} className="btn-secondary py-1.5 px-2.5 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('workProcesses.deleteTitle')}
        message={t('workProcesses.deleteWarning')}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
