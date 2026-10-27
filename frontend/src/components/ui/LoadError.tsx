import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

//this component is shown instead of a page when its data couldn't be loaded
export default function LoadError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
      <AlertTriangle className="w-8 h-8 text-red-500" />
      <p className="text-sm text-slate-600">{t('common.loadError')}</p>
      <button onClick={onRetry} className="btn-secondary">{t('common.retry')}</button>
    </div>
  )
}
