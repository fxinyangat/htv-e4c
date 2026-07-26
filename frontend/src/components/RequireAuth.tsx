import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthContext } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { UserRole } from '../api'

function FullPageSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-ht-orange animate-spin" />
    </div>
  )
}

// Wraps the AppLayout route group — every page nested under this requires an approved account.
export function RequireAuth() {
  const { user, isLoading } = useAuthContext()

  if (isLoading) return <FullPageSpinner />
  if (!user) return <Navigate to="/login?auth=required" replace />
  return <Outlet />
}

// Nested one level deeper than RequireAuth, for the pages Investor can't see (Queue, Companies,
// Portfolio Metrics). Redirects to Inbound Stats — the one internal page every approved role
// can reach — rather than back to /login, since the user IS authenticated, just not permitted
// here.
export function RequireRole({ allowed }: { allowed: UserRole[] }) {
  const { user } = useAuthContext()
  const { showToast } = useToast()
  const location = useLocation()
  const isDenied = !!user && !allowed.includes(user.role)
  // Guards against showing the toast more than once for the same blocked path, regardless of
  // why a re-render happened (e.g. a parent re-render replaying this component before the
  // redirect commits) — keyed on pathname so a genuinely new denied attempt still toasts.
  const toastedForPath = useRef<string | null>(null)

  useEffect(() => {
    if (isDenied && toastedForPath.current !== location.pathname) {
      toastedForPath.current = location.pathname
      showToast('info', 'Access restricted', "You don't have access to that page.")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDenied, location.pathname])

  if (isDenied) return <Navigate to="/inbound" replace />
  return <Outlet />
}
