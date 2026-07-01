import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
  dot?: boolean
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-brand-100 text-brand-800',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  danger:  'bg-red-100 text-red-800',
  info:    'bg-blue-100 text-blue-800',
  purple:  'bg-purple-100 text-purple-800',
  gray:    'bg-slate-100 text-slate-600',
}

const dotColors: Record<Variant, string> = {
  default: 'bg-brand-500',
  success: 'bg-green-500',
  warning: 'bg-amber-500',
  danger:  'bg-red-500',
  info:    'bg-blue-500',
  purple:  'bg-purple-500',
  gray:    'bg-slate-400',
}

export default function Badge({ variant = 'default', children, className = '', dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}

// Helpers for common domain statuses
export function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { label: string; variant: Variant }> = {
    active:        { label: t('status.active'),        variant: 'success' },
    inactive:      { label: t('status.inactive'),      variant: 'gray'    },
    discontinued:  { label: t('status.discontinued'),  variant: 'danger'  },
    'Not Started': { label: t('status.notStarted'),    variant: 'gray'    },
    Started:       { label: t('status.started'),       variant: 'info'    },
    'In Process':  { label: t('status.inProcess'),     variant: 'warning' },
    Done:          { label: t('status.done'),          variant: 'success' },
    'Stock In':    { label: t('status.stockIn'),       variant: 'success' },
    'Stock Out':   { label: t('status.stockOut'),      variant: 'danger'  },
    Adjustment:    { label: t('status.adjustment'),    variant: 'info'    },
  }
  const cfg = map[status] ?? { label: status, variant: 'gray' as Variant }
  return <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
}

export function PriorityBadge({ priority }: { priority: string }) {
  const { t } = useTranslation()
  const map: Record<string, { label: string; variant: Variant }> = {
    Low:      { label: t('priority.low'),      variant: 'gray'    },
    Medium:   { label: t('priority.medium'),   variant: 'info'    },
    High:     { label: t('priority.high'),     variant: 'warning' },
    Critical: { label: t('priority.critical'), variant: 'danger'  },
  }
  const cfg = map[priority] ?? { label: priority, variant: 'gray' as Variant }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
