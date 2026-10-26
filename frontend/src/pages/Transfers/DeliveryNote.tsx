import { useTranslation } from 'react-i18next'
import { fmtDate, fmtNum } from '../../lib/format'

export interface NoteData {
  reference?: string
  date: string
  from: string
  to: string
  driver?: string
  notes?: string
  items: { name: string; sku?: string; quantity: number; unit: string }[]
}

/** Printable delivery note ("fletëdërgesë"). Rendered only when printing. */
export default function DeliveryNote({ note }: { note: NoteData }) {
  const { t } = useTranslation()
  return (
    <div className="hidden print:block text-black text-sm p-8">
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        <div>
          <p className="text-xl font-bold">{t('app.name')}</p>
          <p className="text-xs">{t('app.subtitle')}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold uppercase">{t('note.title')}</p>
          <p className="font-mono">{note.reference ?? t('note.draft')}</p>
          <p>{fmtDate(note.date)}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div><p className="text-xs uppercase font-semibold">{t('transfers.from')}</p><p className="font-semibold">{note.from}</p></div>
        <div><p className="text-xs uppercase font-semibold">{t('transfers.to')}</p><p className="font-semibold">{note.to}</p></div>
        <div><p className="text-xs uppercase font-semibold">{t('transfers.driver')}</p><p>{note.driver || '—'}</p></div>
      </div>
      <table className="w-full border-collapse mb-6">
        <thead>
          <tr className="border-b border-black text-left">
            <th className="py-2 w-8">#</th><th className="py-2">{t('transfers.material')}</th>
            <th className="py-2">SKU</th><th className="py-2 text-right">{t('transfers.quantity')}</th>
            <th className="py-2 pl-2">{t('stock.unit')}</th><th className="py-2 pl-6">{t('note.received')}</th>
          </tr>
        </thead>
        <tbody>
          {note.items.map((it, i) => (
            <tr key={i} className="border-b border-gray-300">
              <td className="py-2">{i + 1}</td><td className="py-2">{it.name}</td>
              <td className="py-2 font-mono text-xs">{it.sku ?? ''}</td>
              <td className="py-2 text-right font-mono">{fmtNum(it.quantity)}</td>
              <td className="py-2 pl-2">{it.unit}</td><td className="py-2 pl-6">______</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note.notes && <p className="mb-8"><b>{t('transfers.note')}:</b> {note.notes}</p>}
      <div className="grid grid-cols-3 gap-8 mt-16">
        {['note.sentBy', 'note.driverSign', 'note.receivedBy'].map((k) => (
          <div key={k} className="border-t border-black pt-2 text-xs">{t(k)}</div>
        ))}
      </div>
    </div>
  )
}
