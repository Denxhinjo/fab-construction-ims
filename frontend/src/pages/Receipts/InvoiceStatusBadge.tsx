import { useTranslation } from 'react-i18next'
import Badge, { type Variant } from '../../components/ui/Badge'
import type { InvoiceStatus } from '../../types'

const VARIANTS: Record<InvoiceStatus, Variant> = {
  review: 'warning',
  failed: 'danger',
  accepted: 'success',
  rejected: 'gray',
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation()
  return <Badge variant={VARIANTS[status]} dot>{t(`receipts.status.${status}`)}</Badge>
}
