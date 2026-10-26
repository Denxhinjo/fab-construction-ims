import type { ReactNode } from 'react'

export type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'gray' | 'dark'

interface BadgeProps {
  variant?: Variant
  children: ReactNode
  className?: string
  dot?: boolean
}

const variantClasses: Record<Variant, string> = {
  default: 'bg-brand-100 text-brand-800',
  success: 'bg-emerald-50 text-emerald-800',
  warning: 'bg-amber-100 text-amber-900',
  danger:  'bg-red-50 text-red-700',
  info:    'bg-blue-50 text-blue-700',
  purple:  'bg-purple-50 text-purple-700',
  gray:    'bg-stone-100 text-stone-600',
  dark:    'bg-ink-900 text-white',
}

const dotColors: Record<Variant, string> = {
  default: 'bg-brand-500',
  success: 'bg-emerald-600',
  warning: 'bg-amber-600',
  danger:  'bg-red-600',
  info:    'bg-blue-600',
  purple:  'bg-purple-500',
  gray:    'bg-stone-400',
  dark:    'bg-white',
}

export function Badge({ variant = 'default', children, className = '', dot }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${variantClasses[variant]} ${className}`}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-sm ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}

export default Badge
