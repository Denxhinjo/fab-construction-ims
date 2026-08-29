import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Search, FolderOpen } from 'lucide-react'
import toast from 'react-hot-toast'
import { projectsApi, usersApi } from '../../services/api'
import type { Project, ProjectListOut, User } from '../../types'
import { useAuth } from '../../context/AuthContext'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'

const PROJECT_STATUSES = ['PLANNED', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'] as const

const STATUS_VARIANTS: Record<string, 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gray'> = {
  PLANNED: 'info',
  ACTIVE: 'success',
  ON_HOLD: 'warning',
  COMPLETED: 'gray',
  CANCELLED: 'danger',
}

const ALLOWED_CREATE_ROLES = new Set(['admin', 'warehouse_manager', 'procurement'])

interface ProjectForm {
  code: string
  name: string
  client: string
  address: string
  city: string
  status: string
  start_date: string
  end_date: string
  project_manager_id: string
  notes: string
}

const EMPTY_FORM: ProjectForm = {
  code: '',
  name: '',
  client: '',
  address: '',
  city: '',
  status: 'PLANNED',
  start_date: '',
  end_date: '',
  project_manager_id: '',
  notes: '',
}

export default function ProjectList() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Partial<ProjectForm>>({})
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const canCreate = ALLOWED_CREATE_ROLES.has(user?.role ?? '')

  const { data, isLoading } = useQuery<ProjectListOut>({
    queryKey: ['projects', page, search, statusFilter],
    queryFn: () =>
      projectsApi.list({ page, page_size: 20, ...(search && { search }), ...(statusFilter && { status: statusFilter }) })
        .then(r => r.data),
  })

  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data),
  })

  const createMut = useMutation({
    mutationFn: (payload: object) => editId ? projectsApi.update(editId, payload) : projectsApi.create(payload),
    onSuccess: () => {
      toast.success(editId ? t('common.updated') : t('common.created'))
      qc.invalidateQueries({ queryKey: ['projects'] })
      closeModal()
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => {
      toast.success(t('common.deleted'))
      qc.invalidateQueries({ queryKey: ['projects'] })
      setDeleteId(null)
    },
  })

  function openCreate() {
    setEditId(null)
    setForm(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  function openEdit(p: Project) {
    setEditId(p.id)
    setForm({
      code: p.code,
      name: p.name,
      client: p.client ?? '',
      address: p.address ?? '',
      city: p.city ?? '',
      status: p.status,
      start_date: p.start_date ?? '',
      end_date: p.end_date ?? '',
      project_manager_id: p.project_manager_id?.toString() ?? '',
      notes: p.notes ?? '',
    })
    setErrors({})
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditId(null)
    setForm(EMPTY_FORM)
  }

  function validate() {
    const e: Partial<ProjectForm> = {}
    if (!form.code.trim()) e.code = t('projects.codeRequired')
    if (!form.name.trim()) e.name = t('projects.nameRequired')
    if (form.status && !PROJECT_STATUSES.includes(form.status as typeof PROJECT_STATUSES[number])) e.status = t('projects.invalidStatus')
    setErrors(e)
    return Object.keys(e).length === 0
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      client: form.client || undefined,
      address: form.address || undefined,
      city: form.city || undefined,
      status: form.status,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
      project_manager_id: form.project_manager_id ? parseInt(form.project_manager_id) : undefined,
      notes: form.notes || undefined,
    }
    createMut.mutate(payload)
  }

  const projects = data?.items ?? []
  const totalPages = data?.total_pages ?? 1

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('projects.title')}</h1>
          <p className="text-slate-500 text-sm">{t('projects.subtitle')}</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            {t('projects.create')}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder={t('projects.search')}
            className="input-base pl-9 w-full"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="input-base w-auto"
        >
          <option value="">{t('common.allStatuses')}</option>
          {PROJECT_STATUSES.map(s => (
            <option key={s} value={s}>{t(`projects.status.${s}`, { defaultValue: s })}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12"><Spinner size="lg" /></div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={<FolderOpen className="w-10 h-10 text-slate-300" />}
            title={t('projects.empty')}
            description={t('projects.emptyDesc')}
            action={canCreate ? { label: t('projects.create'), onClick: openCreate } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  {[t('projects.code'), t('projects.name'), t('projects.client'), t('projects.status'), t('projects.manager'), t('common.actions')].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {projects.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600 font-semibold">{p.code}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.client ?? '—'}</td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[p.status] ?? 'gray'}>
                        {t(`projects.status.${p.status}`, { defaultValue: p.status })}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.project_manager?.full_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {canCreate && (
                          <button onClick={() => openEdit(p)} className="text-xs text-brand-600 hover:text-brand-700 font-medium">
                            {t('common.edit')}
                          </button>
                        )}
                        {user?.role === 'admin' && (
                          <button onClick={() => setDeleteId(p.id)} className="text-xs text-red-500 hover:text-red-600 font-medium">
                            {t('common.archive')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">
            {t('common.previous')}
          </button>
          <span className="text-sm text-slate-500 self-center">{page} / {totalPages}</span>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">
            {t('common.next')}
          </button>
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modalOpen} onClose={closeModal} title={editId ? t('projects.edit') : t('projects.create')} size="lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('projects.code')} required error={errors.code}>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="input-base" placeholder="PRJ-2026-001" />
            </FormField>
            <FormField label={t('projects.status')} required>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="input-base">
                {PROJECT_STATUSES.map(s => <option key={s} value={s}>{t(`projects.status.${s}`, { defaultValue: s })}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label={t('projects.name')} required error={errors.name}>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-base" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('projects.client')}>
              <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} className="input-base" />
            </FormField>
            <FormField label={t('projects.city')}>
              <input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className="input-base" />
            </FormField>
          </div>
          <FormField label={t('projects.address')}>
            <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className="input-base" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('projects.startDate')}>
              <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} className="input-base" />
            </FormField>
            <FormField label={t('projects.endDate')}>
              <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} className="input-base" />
            </FormField>
          </div>
          <FormField label={t('projects.manager')}>
            <select value={form.project_manager_id} onChange={e => setForm(f => ({ ...f, project_manager_id: e.target.value }))} className="input-base">
              <option value="">{t('common.none')}</option>
              {(users as User[] | undefined)?.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </FormField>
          <FormField label={t('common.notes')}>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input-base min-h-[80px]" />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={closeModal} className="btn-secondary">{t('common.cancel')}</button>
            <button type="submit" disabled={createMut.isPending} className="btn-primary">
              {createMut.isPending ? t('common.saving') : editId ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title={t('projects.archiveTitle')}
        description={t('projects.archiveDesc')}
        confirmLabel={t('common.archive')}
        onConfirm={() => deleteId !== null && deleteMut.mutate(deleteId)}
        onCancel={() => setDeleteId(null)}
        loading={deleteMut.isPending}
        danger
      />
    </div>
  )
}
