import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { format } from 'date-fns'
import { Plus, Edit2, Trash2, Users, Shield, UserCheck, UserX, Mail, Phone } from 'lucide-react'
import { usersApi } from '../../services/api'
import type { User, UserCreate, UserUpdate } from '../../types'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const emptyCreate: UserCreate = {
  email: '', username: '', full_name: '', password: '', role: 'user', phone: '',
}

export default function UserManagement() {
  const qc = useQueryClient()
  const { user: currentUser } = useAuth()
  const { t } = useTranslation()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<User | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [createForm, setCreateForm] = useState<UserCreate>(emptyCreate)
  const [editForm, setEditForm] = useState<UserUpdate>({})
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: UserCreate) => usersApi.create(data),
    onSuccess: () => { toast.success(t('users.created')); qc.invalidateQueries({ queryKey: ['users'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdate }) => usersApi.update(id, data),
    onSuccess: () => { toast.success(t('users.updated')); qc.invalidateQueries({ queryKey: ['users'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { toast.success(t('users.deleted')); qc.invalidateQueries({ queryKey: ['users'] }); setDeleteId(null) },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const openEdit = (u: User) => {
    setEditTarget(u)
    setEditForm({ email: u.email, full_name: u.full_name, role: u.role, phone: u.phone ?? '', is_active: u.is_active })
    setErrors({})
    setModal('edit')
  }

  const closeModal = () => { setModal(null); setEditTarget(null); setErrors({}) }

  const validateCreate = () => {
    const e: Record<string, string> = {}
    if (!createForm.email) e.email = t('users.emailRequired')
    if (!createForm.username) e.username = t('users.usernameRequired')
    if (!createForm.full_name) e.full_name = t('users.fullNameRequired')
    if (!createForm.password || createForm.password.length < 8) e.password = t('users.passwordMinLength')
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateCreate()) return
    createMutation.mutate(createForm)
  }

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTarget) return
    updateMutation.mutate({ id: editTarget.id, data: editForm })
  }

  const adminCount = users?.filter((u) => u.role === 'admin').length ?? 0
  const activeCount = users?.filter((u) => u.is_active).length ?? 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('users.title')}</h1>
          <p className="text-slate-500 text-sm">
            {t('users.summary', { total: users?.length ?? 0, admins: adminCount, active: activeCount })}
          </p>
        </div>
        <button onClick={() => { setCreateForm(emptyCreate); setErrors({}); setModal('create') }} className="btn-primary">
          <Plus className="w-4 h-4" /> {t('users.addUser')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('users.totalUsers'), value: users?.length ?? 0, icon: <Users className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-100' },
          { label: t('users.admins'), value: adminCount, icon: <Shield className="w-5 h-5 text-purple-600" />, bg: 'bg-purple-100' },
          { label: t('users.active'), value: activeCount, icon: <UserCheck className="w-5 h-5 text-green-600" />, bg: 'bg-green-100' },
          { label: t('users.inactive'), value: (users?.length ?? 0) - activeCount, icon: <UserX className="w-5 h-5 text-slate-500" />, bg: 'bg-slate-100' },
        ].map((s) => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-xs text-slate-500">{s.label}</p>
              <p className="text-xl font-bold text-slate-800">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner size="lg" /></div>
        ) : (users?.length ?? 0) === 0 ? (
          <EmptyState icon={<Users className="w-8 h-8 text-slate-400" />} title={t('users.noUsers')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('users.userCol')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">{t('users.contact')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('users.role')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('users.status')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden lg:table-cell">{t('users.joined')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{t('users.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users?.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-700 text-sm font-bold">
                            {u.full_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-700">
                            {u.full_name}
                            {u.id === currentUser?.id && (
                              <span className="ml-1.5 text-xs font-normal text-brand-600">{t('users.you')}</span>
                            )}
                          </p>
                          <p className="text-xs text-slate-400 font-mono">@{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <p className="flex items-center gap-1 text-slate-600"><Mail className="w-3.5 h-3.5 text-slate-400" />{u.email}</p>
                      {u.phone && <p className="flex items-center gap-1 text-slate-500 text-xs mt-0.5"><Phone className="w-3.5 h-3.5 text-slate-400" />{u.phone}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.role === 'admin' ? 'purple' : 'info'}>
                        {u.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={u.is_active ? 'success' : 'gray'} dot>
                        {u.is_active ? t('users.statusActive') : t('users.statusInactive')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs hidden lg:table-cell">
                      {format(new Date(u.created_at), 'MMM d, yyyy')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => openEdit(u)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {u.id !== currentUser?.id && (
                          <button onClick={() => setDeleteId(u.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            <Trash2 className="w-4 h-4" />
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

      {/* Create Modal */}
      <Modal open={modal === 'create'} onClose={closeModal} title={t('users.addNewUser')} size="md">
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('users.fullName')} required error={errors.full_name}>
              <input className="input-base" value={createForm.full_name} onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })} placeholder="John Smith" />
            </FormField>
            <FormField label={t('users.username')} required error={errors.username}>
              <input className="input-base" value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} placeholder="jsmith" />
            </FormField>
          </div>
          <FormField label={t('users.email')} required error={errors.email}>
            <input className="input-base" type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} placeholder="jsmith@fabconstruction.com" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('users.password')} required error={errors.password}>
              <input className="input-base" type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder={t('users.passwordHint')} />
            </FormField>
            <FormField label={t('users.role')}>
              <select className="input-base" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })}>
                <option value="user">{t('users.roleUser')}</option>
                <option value="admin">{t('users.roleAdmin')}</option>
              </select>
            </FormField>
          </div>
          <FormField label={t('users.phone')}>
            <input className="input-base" value={createForm.phone ?? ''} onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })} placeholder="+1-555-0100" />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending} className="flex-1 btn-primary justify-center">
              {createMutation.isPending ? <Spinner size="sm" /> : null}
              {t('users.createUser')}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary">{t('users.cancel')}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={modal === 'edit'} onClose={closeModal} title={`${t('users.editUser')} ${editTarget?.full_name}`} size="md">
        <form onSubmit={handleEditSubmit} className="space-y-4">
          <FormField label={t('users.fullName')}>
            <input className="input-base" value={editForm.full_name ?? ''} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
          </FormField>
          <FormField label={t('users.email')}>
            <input className="input-base" type="email" value={editForm.email ?? ''} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('users.role')}>
              <select className="input-base" value={editForm.role ?? 'user'} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                <option value="user">{t('users.roleUser')}</option>
                <option value="admin">{t('users.roleAdmin')}</option>
              </select>
            </FormField>
            <FormField label={t('users.status')}>
              <select className="input-base" value={editForm.is_active ? 'true' : 'false'} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.value === 'true' })}>
                <option value="true">{t('users.statusActive')}</option>
                <option value="false">{t('users.statusInactive')}</option>
              </select>
            </FormField>
          </div>
          <FormField label={t('users.phone')}>
            <input className="input-base" value={editForm.phone ?? ''} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
          </FormField>
          <FormField label={t('users.newPassword')}>
            <input className="input-base" type="password" placeholder={t('users.newPasswordPlaceholder')} onChange={(e) => setEditForm({ ...editForm, password: e.target.value || undefined })} />
          </FormField>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={updateMutation.isPending} className="flex-1 btn-primary justify-center">
              {updateMutation.isPending ? <Spinner size="sm" /> : null}
              {t('users.saveChanges')}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary">{t('users.cancel')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('users.deleteTitle')}
        message={t('users.deleteWarning')}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
