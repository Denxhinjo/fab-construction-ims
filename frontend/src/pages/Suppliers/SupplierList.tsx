import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, Phone, Mail, MapPin, Edit2, Trash2, Package, User, EyeOff } from 'lucide-react'
import { suppliersApi } from '../../services/api'
import type { Supplier } from '../../types'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import Badge from '../../components/ui/Badge'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const emptyForm = {
  name: '', contact_name: '', email: '', phone: '',
  address: '', city: '', notes: '',
}

export default function SupplierList() {
  const qc = useQueryClient()
  const { t } = useTranslation()
  const { isAdmin } = useAuth()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Supplier | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: suppliers, isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => suppliersApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => suppliersApi.create(data),
    onSuccess: () => { toast.success(t('suppliers.created')); qc.invalidateQueries({ queryKey: ['suppliers'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? t('common.serverError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => suppliersApi.update(id, data),
    onSuccess: () => { toast.success(t('suppliers.updated')); qc.invalidateQueries({ queryKey: ['suppliers'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? t('common.serverError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => suppliersApi.delete(id),
    onSuccess: () => { toast.success(t('suppliers.deleted')); qc.invalidateQueries({ queryKey: ['suppliers'] }); setDeleteId(null) },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? t('common.serverError')),
  })

  const openCreate = () => { setForm(emptyForm); setErrors({}); setModal('create') }
  const openEdit = (s: Supplier) => {
    setEditTarget(s)
    setForm({ name: s.name, contact_name: s.contact_name ?? '', email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '', city: s.city ?? '', notes: s.notes ?? '' })
    setErrors({})
    setModal('edit')
  }
  const closeModal = () => { setModal(null); setEditTarget(null) }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = t('suppliers.nameRequired')
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    if (modal === 'create') createMutation.mutate(form)
    else if (modal === 'edit' && editTarget) updateMutation.mutate({ id: editTarget.id, data: form })
  }

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }))

  // Mask contact details for non-admin users
  const maskContact = (value: string | undefined) => {
    if (!value) return null
    if (isAdmin) return value
    if (value.includes('@')) return value.split('@')[0].slice(0, 2) + '***@***'
    return value.slice(0, 3) + '***'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('suppliers.title')}</h1>
          <p className="text-slate-500 text-sm">{t('suppliers.configured', { count: suppliers?.length ?? 0 })}</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('suppliers.addSupplier')}
          </button>
        )}
      </div>

      {/* Privacy notice for non-admins */}
      {!isAdmin && (
        <div className="flex items-center gap-2.5 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <EyeOff className="w-4 h-4 flex-shrink-0" />
          {t('suppliers.maskedContact')}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : (suppliers?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Truck className="w-8 h-8 text-slate-400" />}
          title={t('suppliers.noSuppliers')}
          description={t('suppliers.noSuppliersDesc')}
          action={isAdmin ? <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> {t('suppliers.addSupplier')}</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {suppliers?.map((s) => (
            <div key={s.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{s.name}</h3>
                    {s.city && <p className="text-xs text-slate-500">{s.city}</p>}
                  </div>
                </div>
                <Badge variant={s.is_active ? 'success' : 'gray'}>
                  {s.is_active ? t('suppliers.active') : t('suppliers.inactive')}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                {s.contact_name && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {s.contact_name}
                  </p>
                )}
                {s.phone && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className={!isAdmin ? 'font-mono text-slate-400' : ''}>{maskContact(s.phone)}</span>
                  </p>
                )}
                {s.email && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className={`truncate ${!isAdmin ? 'font-mono text-slate-400' : ''}`}>{maskContact(s.email)}</span>
                  </p>
                )}
                {s.address && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {s.address}
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('suppliers.products', { count: s.product_count })}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(s.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal open={modal !== null} onClose={closeModal} title={modal === 'create' ? t('suppliers.createSupplier') : t('suppliers.editSupplier')} size="lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <FormField label={t('suppliers.name')} required error={errors.name}>
              <input className="input-base" value={form.name} onChange={set('name')} placeholder={t('suppliers.namePlaceholder')} />
            </FormField>
          </div>
          <FormField label={t('suppliers.contactName')}>
            <input className="input-base" value={form.contact_name} onChange={set('contact_name')} placeholder={t('suppliers.contactNamePlaceholder')} />
          </FormField>
          <FormField label={t('suppliers.city')}>
            <input className="input-base" value={form.city} onChange={set('city')} placeholder={t('suppliers.cityPlaceholder')} />
          </FormField>
          <FormField label={t('suppliers.phone')}>
            <input className="input-base" value={form.phone} onChange={set('phone')} placeholder={t('suppliers.phonePlaceholder')} />
          </FormField>
          <FormField label={t('suppliers.email')}>
            <input className="input-base" type="email" value={form.email} onChange={set('email')} placeholder={t('suppliers.emailPlaceholder')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t('suppliers.address')}>
              <input className="input-base" value={form.address} onChange={set('address')} placeholder={t('suppliers.addressPlaceholder')} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label={t('suppliers.notes')}>
              <textarea className="input-base min-h-16 resize-y" value={form.notes} onChange={set('notes')} placeholder={t('suppliers.notesPlaceholder')} />
            </FormField>
          </div>
          <div className="sm:col-span-2 flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 btn-primary justify-center">
              {(createMutation.isPending || updateMutation.isPending) ? <Spinner size="sm" /> : null}
              {modal === 'create' ? t('suppliers.createSupplier') : t('suppliers.saveChanges')}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary">{t('suppliers.cancel')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('suppliers.deleteTitle')}
        message={t('suppliers.deleteWarning')}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
