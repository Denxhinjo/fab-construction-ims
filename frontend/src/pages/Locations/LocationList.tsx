import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Phone, Mail, Edit2, Trash2, Package, User } from 'lucide-react'
import { locationsApi } from '../../services/api'
import type { Location } from '../../types'
import Modal from '../../components/ui/Modal'
import FormField from '../../components/ui/FormField'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import EmptyState from '../../components/ui/EmptyState'
import Spinner from '../../components/ui/Spinner'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const emptyForm = {
  name: '', address: '', city: '', manager_name: '',
  contact_email: '', contact_phone: '', notes: '',
}

export default function LocationList() {
  const qc = useQueryClient()
  const { isAdmin } = useAuth()
  const { t } = useTranslation()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editTarget, setEditTarget] = useState<Location | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: locations, isLoading } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: typeof emptyForm) => locationsApi.create(data),
    onSuccess: () => { toast.success(t('locations.created')); qc.invalidateQueries({ queryKey: ['locations'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: typeof emptyForm }) => locationsApi.update(id, data),
    onSuccess: () => { toast.success(t('locations.updated')); qc.invalidateQueries({ queryKey: ['locations'] }); closeModal() },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => locationsApi.delete(id),
    onSuccess: () => { toast.success(t('locations.deleted')); qc.invalidateQueries({ queryKey: ['locations'] }); setDeleteId(null) },
    onError: (e: { response?: { data?: { detail?: string } } }) => toast.error(e?.response?.data?.detail ?? 'Failed'),
  })

  const openCreate = () => { setForm(emptyForm); setErrors({}); setModal('create') }
  const openEdit = (loc: Location) => {
    setEditTarget(loc)
    setForm({
      name: loc.name, address: loc.address ?? '', city: loc.city ?? '',
      manager_name: loc.manager_name ?? '', contact_email: loc.contact_email ?? '',
      contact_phone: loc.contact_phone ?? '', notes: loc.notes ?? '',
    })
    setErrors({})
    setModal('edit')
  }
  const closeModal = () => { setModal(null); setEditTarget(null) }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = t('locations.nameRequired')
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('locations.title')}</h1>
          <p className="text-slate-500 text-sm">{t('locations.configured', { count: locations?.length ?? 0 })}</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="btn-primary">
            <Plus className="w-4 h-4" /> {t('locations.addLocation')}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>
      ) : (locations?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<MapPin className="w-8 h-8 text-slate-400" />}
          title={t('locations.noLocations')}
          description={t('locations.noLocationsDesc')}
          action={isAdmin ? <button onClick={openCreate} className="btn-primary"><Plus className="w-4 h-4" /> {t('locations.addLocation')}</button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {locations?.map((loc) => (
            <div key={loc.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">{loc.name}</h3>
                    {loc.city && <p className="text-xs text-slate-500">{loc.city}</p>}
                  </div>
                </div>
                <Badge variant={loc.is_active ? 'success' : 'gray'}>
                  {loc.is_active ? t('locations.active') : t('locations.inactive')}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                {loc.address && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {loc.address}
                  </p>
                )}
                {loc.manager_name && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {loc.manager_name}
                  </p>
                )}
                {loc.contact_phone && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    {loc.contact_phone}
                  </p>
                )}
                {loc.contact_email && (
                  <p className="text-slate-600 flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{loc.contact_email}</span>
                  </p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Package className="w-4 h-4" />
                  <span className="text-sm font-medium">{t('locations.products', { count: loc.product_count })}</span>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(loc)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteId(loc.id)} className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal !== null} onClose={closeModal} title={modal === 'create' ? t('locations.createLocation') : t('locations.editLocation')} size="lg">
        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label={t('locations.name')} required error={errors.name}>
            <input className="input-base" value={form.name} onChange={set('name')} placeholder={t('locations.namePlaceholder')} />
          </FormField>
          <FormField label={t('locations.city')}>
            <input className="input-base" value={form.city} onChange={set('city')} placeholder={t('locations.cityPlaceholder')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t('locations.address')}>
              <input className="input-base" value={form.address} onChange={set('address')} placeholder={t('locations.addressPlaceholder')} />
            </FormField>
          </div>
          <FormField label={t('locations.manager')}>
            <input className="input-base" value={form.manager_name} onChange={set('manager_name')} placeholder={t('locations.managerPlaceholder')} />
          </FormField>
          <FormField label={t('locations.contactPhone')}>
            <input className="input-base" value={form.contact_phone} onChange={set('contact_phone')} placeholder={t('locations.phonePlaceholder')} />
          </FormField>
          <div className="sm:col-span-2">
            <FormField label={t('locations.contactEmail')}>
              <input className="input-base" type="email" value={form.contact_email} onChange={set('contact_email')} placeholder={t('locations.emailPlaceholder')} />
            </FormField>
          </div>
          <div className="sm:col-span-2">
            <FormField label={t('locations.notes')}>
              <textarea className="input-base min-h-16 resize-y" value={form.notes} onChange={set('notes')} placeholder={t('locations.notesPlaceholder')} />
            </FormField>
          </div>
          <div className="sm:col-span-2 flex gap-3 pt-2">
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 btn-primary justify-center">
              {(createMutation.isPending || updateMutation.isPending) ? <Spinner size="sm" /> : null}
              {modal === 'create' ? t('locations.createLocation') : t('locations.saveChanges')}
            </button>
            <button type="button" onClick={closeModal} className="btn-secondary">{t('locations.cancel')}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
        title={t('locations.deleteTitle')}
        message={t('locations.deleteWarning')}
        loading={deleteMutation.isPending}
      />
    </div>
  )
}
