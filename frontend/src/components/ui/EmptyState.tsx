import { PackageSearch } from 'lucide-react'
import type { ReactNode } from 'react'

interface ActionObject { label: string; onClick: () => void }

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode | ActionObject
}

function isActionObject(a: unknown): a is ActionObject {
  return typeof a === 'object' && a !== null && 'label' in a && 'onClick' in a
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
        {icon ?? <PackageSearch className="w-8 h-8 text-slate-400" />}
      </div>
      <h3 className="text-base font-semibold text-slate-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>}
      {isActionObject(action)
        ? <button onClick={action.onClick} className="btn-primary text-sm">{action.label}</button>
        : action}
    </div>
  )
}
