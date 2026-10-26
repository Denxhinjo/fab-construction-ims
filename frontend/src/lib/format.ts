import i18n from '../i18n'
import type { StockMovement } from '../types'
import type { Variant } from '../components/ui/Badge'

// The currency stock is valued in. Albanian supplier invoices are in Lekë.
export const APP_CURRENCY: string = import.meta.env.VITE_CURRENCY || 'ALL'

const grouping = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

/** 1055 -> "1,055"; 20.9167 -> "20.92" */
export function fmtNum(value: number | null | undefined, maxFractionDigits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  if (maxFractionDigits === 2) return grouping.format(value)
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: maxFractionDigits }).format(value)
}

const SYMBOLS: Record<string, { symbol: string; prefix: boolean }> = {
  EUR: { symbol: '€', prefix: true },
  USD: { symbol: '$', prefix: true },
  ALL: { symbol: 'L', prefix: false },
}

/** Money with its symbol: "€84,120", "134,308 L". Whole amounts drop the decimals. */
export function fmtMoney(value: number | null | undefined, currency = APP_CURRENCY, decimals?: number): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const digits = decimals ?? (Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2)
  const text = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
  const cfg = SYMBOLS[currency] ?? { symbol: currency, prefix: false }
  return cfg.prefix ? `${cfg.symbol}${text}` : `${text} ${cfg.symbol}`
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`
}

/** "Today 09:42", "Yesterday 16:30", or "22.10" for older timestamps. */
export function fmtWhen(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value)
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return `${i18n.t('time.today')} ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `${i18n.t('time.yesterday')} ${time}`
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Spelled out here because browsers ship incomplete Albanian locale data.
const SQ_DAYS = ['e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë']
const SQ_MONTHS = ['janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor', 'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor']

/** "E hënë, 26 tetor" / "Monday 26 October" */
export function fmtLongToday(): string {
  const d = new Date()
  if (i18n.language === 'sq') return `${SQ_DAYS[d.getDay()]}, ${d.getDate()} ${SQ_MONTHS[d.getMonth()]}`
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).format(d)
}

export function fmtBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// ─── Movements ────────────────────────────────────────────────────────────────
type MovementKind = 'in' | 'transfer' | 'adjustment' | 'out'

const KIND_BY_TYPE: Record<string, MovementKind> = {
  'Purchase Receipt': 'in',
  'Stock In': 'in',
  'Opening Balance': 'in',
  'Warehouse Transfer Out': 'transfer',
  'Warehouse Transfer In': 'transfer',
  Adjustment: 'adjustment',
  'Adjustment In': 'adjustment',
  'Adjustment Out': 'adjustment',
  'Stock Out': 'out',
}

const KIND_VARIANT: Record<MovementKind, Variant> = {
  in: 'success',
  transfer: 'info',
  adjustment: 'gray',
  out: 'danger',
}

export function movementKind(m: StockMovement): MovementKind {
  return KIND_BY_TYPE[m.movement_type] ?? 'out'
}

export function movementBadge(m: StockMovement): { label: string; variant: Variant } {
  const kind = movementKind(m)
  return { label: i18n.t(`movement.${kind}`), variant: KIND_VARIANT[kind] }
}

/** Signed quantity for a movement: adjustments and outgoing stock show a minus. */
export function movementQty(m: StockMovement): string {
  const negative = m.movement_type === 'Adjustment Out' || m.movement_type === 'Stock Out'
  return `${negative ? '−' : ''}${fmtNum(m.quantity)}`
}

/** "Beton-Mix → Depo Qendrore", "Depo Qendrore → Depo Veri", "Depo Jug · physical count" */
export function movementRoute(m: StockMovement): string {
  const src = m.source_location?.name
  const dst = m.destination_location?.name
  switch (movementKind(m)) {
    case 'transfer':
      return `${src ?? '?'} → ${dst ?? '?'}`
    case 'adjustment':
      return `${src ?? dst ?? ''} · ${m.reason || i18n.t('movement.count')}`
    case 'in':
      if (m.movement_type === 'Opening Balance') return `${i18n.t('movement.opening')} · ${dst ?? ''}`
      return m.reason || dst || ''
    default:
      return src ?? ''
  }
}
