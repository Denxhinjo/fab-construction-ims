import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { format } from 'date-fns'
import { workProcessesApi, productsApi, locationsApi, usersApi } from '../../services/api'
import type { WorkProcess, ProductListOut, Location, User } from '../../types'
import FormField from '../../components/ui/FormField'
import Spinner from '../../components/ui/Spinner'
import toast from 'react-hot-toast'

const emptyForm = {
  title: '',
  description: '',
  product_id: '',
  assigned_user_id: '',
  location_id: '',
  status: 'Not Started',
  priority: 'Medium',
  start_date: '',
  due_date: '',
  completion_date: '',
  notes: '',
}

export default function AddEditWorkProcess() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { t } = useTranslation()
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: wp, isLoading } = useQuery<WorkProcess>({
    queryKey: ['work-process', id],
    queryFn: () => workProcessesApi.get(Number(id)).then((r) => r.data),
    enabled: isEdit,
  })

  const { data: productsData } = useQuery<ProductListOut>({
    queryKey: ['products-all'],
    queryFn: () => productsApi.list({ page_size: 100 }).then((r) => r.data),
  })
  const { data: locations } = useQuery<Location[]>({
    queryKey: ['locations'],
    queryFn: () => locationsApi.list().then((r) => r.data),
  })
  const { data: users } = useQuery<User[]>({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  useEffect(() => {
    if (wp && isEdit) {
      setForm({
        title: wp.title,
        description: wp.description ?? '',
        product_id: wp.product_id?.toString() ?? '',
        assigned_user_id: wp.assigned_user_id?.toString() ?? '',
        location_id: wp.location_id?.toString() ?? '',
        status: wp.status,
        priority: wp.priority,
        start_date: wp.start_date ? format(new Date(wp.start_date), 'yyyy-MM-dd') : '',
        due_date: wp.due_date ? format(new Date(wp.due_date), 'yyyy-MM-dd') : '',
        completion_date: wp.completion_date ? format(new Date(wp.completion_date), 'yyyy-MM-dd') : '',
        notes: wp.notes ?? '',
      })
    }
  }, [wp, isEdit])

  const mutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      isEdit
        ? workProcessesApi.update(Number(id), payload)
        : workProcessesApi.create(payload),
    onSuccess: () => {
      toast.success(isEdit ? t('workProcesses.updated') : t('workProcesses.created'))
      qc.invalidateQueries({ queryKey: ['work-processes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('/work-processes')
    },
    onError: (e: { response?: { data?: { detail?: string } } }) =>
      toast.error(e?.response?.data?.detail ?? t('workProcesses.failedToSave')),
  })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.title.trim()) e.title = t('workProcesses.titleRequired')
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      status: form.status,
      priority: form.priority,
      notes: form.notes || undefined,
      product_id: form.product_id ? Number(form.product_id) : null,
      assigned_user_id: form.assigned_user_id ? Number(form.assigned_user_id) : null,
      location_id: form.location_id ? Number(form.location_id) : null,
      start_date: form.start_date || null,
      due_date: form.due_date || null,
      completion_date: form.completion_date || null,
    }
    mutation.mutate(payload)
  }

  const set = (field: string) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [field]: e.target.value }))

  if (isEdit && isLoading) return <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-secondary py-2 px-3">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            {isEdit ? t('workProcesses.editTitle') : t('workProcesses.addTitle')}
          </h1>
          <p className="text-slate-500 text-sm">{t('workProcesses.subtitle')}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">{t('workProcesses.taskInfo')}</h2>
          <FormField label={t('workProcesses.titleField')} required error={errors.title}>
            <input className="input-base" value={form.title} onChange={set('title')} placeholder={t('workProcesses.titlePlaceholder')} />
          </FormField>
          <FormField label={t('workProcesses.description')}>
            <textarea className="input-base min-h-24 resize-y" value={form.description} onChange={set('description')} placeholder={t('workProcesses.descriptionPlaceholder')} />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label={t('workProcesses.status')}>
              <select className="input-base" value={form.status} onChange={set('status')}>
                {['Not Started', 'Started', 'In Process', 'Done'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </FormField>
            <FormField label={t('workProcesses.priority')}>
              <select className="input-base" value={form.priority} onChange={set('priority')}>
                {['Low', 'Medium', 'High', 'Critical'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </FormField>
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">{t('workProcesses.assignment')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label={t('workProcesses.assignedTo')}>
              <select className="input-base" value={form.assigned_user_id} onChange={set('assigned_user_id')}>
                <option value="">{t('workProcesses.unassigned')}</option>
                {users?.map((u) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            </FormField>
            <FormField label={t('workProcesses.location')}>
              <select className="input-base" value={form.location_id} onChange={set('location_id')}>
                <option value="">{t('workProcesses.noLocation')}</option>
                {locations?.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </FormField>
          </div>
          <FormField label={t('workProcesses.relatedProduct')}>
            <select className="input-base" value={form.product_id} onChange={set('product_id')}>
              <option value="">{t('workProcesses.noProduct')}</option>
              {productsData?.items?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </FormField>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="text-sm font-semibold text-slate-700 border-b border-slate-100 pb-3">{t('workProcesses.timeline')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label={t('workProcesses.startDate')}>
              <input type="date" className="input-base" value={form.start_date} onChange={set('start_date')} />
            </FormField>
            <FormField label={t('workProcesses.dueDate')}>
              <input type="date" className="input-base" value={form.due_date} onChange={set('due_date')} />
            </FormField>
            <FormField label={t('workProcesses.completionDate')}>
              <input type="date" className="input-base" value={form.completion_date} onChange={set('completion_date')} />
            </FormField>
          </div>
          <FormField label={t('workProcesses.notes')}>
            <textarea className="input-base min-h-16 resize-y" value={form.notes} onChange={set('notes')} placeholder={t('workProcesses.notesPlaceholder')} />
          </FormField>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={mutation.isPending} className="btn-primary">
            {mutation.isPending ? <Spinner size="sm" /> : null}
            {mutation.isPending ? t('workProcesses.saving') : isEdit ? t('workProcesses.saveChanges') : t('workProcesses.createTask')}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">{t('workProcesses.cancel')}</button>
        </div>
      </form>
    </div>
  )
}
