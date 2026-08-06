import { AlertTriangle, RefreshCw } from 'lucide-react'

interface Props {
  title: string
  message: string
  confirmLabel: string
  confirmingLabel?: string
  tone?: 'danger' | 'default'
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}

// Generic confirm dialog — ConfirmDeleteModal keeps its own hardcoded copy for company deletes
// (used in more places, not worth touching), this is for every other "are you sure" prompt
// (e.g. Re-tag) that isn't a destructive delete but still shouldn't fire on a single misclick.
export default function ConfirmModal({ title, message, confirmLabel, confirmingLabel, tone = 'default', onCancel, onConfirm, loading }: Props) {
  const iconWrapCls = tone === 'danger' ? 'bg-red-50' : 'bg-amber-50'
  const iconCls = tone === 'danger' ? 'text-red-500' : 'text-amber-500'
  const confirmBtnCls = tone === 'danger'
    ? 'bg-red-600 hover:bg-red-700'
    : 'bg-ht-blue hover:bg-ht-blue/90'

  return (
    <div className="fixed inset-0 bg-ht-blue/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
        <div className={`w-14 h-14 mx-auto rounded-full flex items-center justify-center ${iconWrapCls}`}>
          <AlertTriangle className={`w-7 h-7 ${iconCls}`} />
        </div>
        <h3 className="text-lg font-display font-semibold text-ht-blue">{title}</h3>
        <p className="text-sm text-ht-blue/60 leading-relaxed">{message}</p>
        <div className="space-y-2 pt-2">
          <button
            onClick={onCancel}
            disabled={loading}
            className="w-full py-2.5 bg-white border border-ht-blue/10 text-ht-blue text-sm font-semibold rounded-xl hover:bg-ht-blue/5 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full py-2.5 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${confirmBtnCls}`}
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            {loading ? (confirmingLabel ?? confirmLabel) : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
