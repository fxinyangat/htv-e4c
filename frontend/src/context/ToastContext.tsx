import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { Check, AlertTriangle, Info, X } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: number
  type: ToastType
  title: string
  message: string
}

interface ToastContextType {
  showToast: (type: ToastType, title: string, message: string) => void
}

const ToastContext = createContext<ToastContextType | undefined>(undefined)

const TOAST_META: Record<ToastType, { border: string; bg: string; iconBg: string; iconColor: string; titleColor: string; icon: typeof Check }> = {
  success: { border: 'border-emerald-500', bg: 'bg-emerald-50/95', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600', titleColor: 'text-emerald-800', icon: Check },
  error: { border: 'border-red-500', bg: 'bg-red-50/95', iconBg: 'bg-red-100', iconColor: 'text-red-600', titleColor: 'text-red-800', icon: AlertTriangle },
  info: { border: 'border-ht-blue', bg: 'bg-white/95', iconBg: 'bg-ht-blue/10', iconColor: 'text-ht-blue', titleColor: 'text-ht-blue', icon: Info },
}

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((type: ToastType, title: string, message: string) => {
    const id = nextId++
    setToasts(prev => [...prev, { id, type, title, message }])
    setTimeout(() => dismiss(id), 4000)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-6 right-6 z-[100] flex flex-col gap-3 w-full max-w-sm">
        {toasts.map(toast => {
          const meta = TOAST_META[toast.type]
          const Icon = meta.icon
          return (
            <div
              key={toast.id}
              className={`${meta.bg} backdrop-blur-sm rounded-2xl shadow-lg border-l-4 ${meta.border} p-4 flex items-start gap-3`}
            >
              <span className={`w-6 h-6 rounded-full ${meta.iconBg} flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon className={`w-3.5 h-3.5 ${meta.iconColor}`} />
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${meta.titleColor}`}>{toast.title}</p>
                <p className="text-sm text-ht-blue/60 mt-0.5">{toast.message}</p>
              </div>
              <button onClick={() => dismiss(toast.id)} className="text-ht-blue/30 hover:text-ht-blue/60 transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
