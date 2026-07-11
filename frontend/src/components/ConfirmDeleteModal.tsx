import { AlertTriangle } from 'lucide-react'

interface Props {
  name: string
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
}

export default function ConfirmDeleteModal({ name, onCancel, onConfirm, loading }: Props) {
  return (
    <div className="fixed inset-0 bg-ht-blue/40 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-full bg-amber-50 flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="text-lg font-display font-semibold text-ht-blue">Delete {name}?</h3>
        <p className="text-sm text-ht-blue/60 leading-relaxed">
          This will permanently remove this company from the database. This action cannot be undone.
        </p>
        <div className="space-y-2 pt-2">
          <button
            onClick={onCancel}
            className="w-full py-2.5 bg-white border border-ht-blue/10 text-ht-blue text-sm font-semibold rounded-xl hover:bg-ht-blue/5 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="w-full py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}
