import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './useAuth'

export function ProtectedRoute() {
  const auth = useAuth()
  const location = useLocation()

  if (auth.isLoading) {
    return <div className="bc-session-screen"><span className="bc-session-screen__mark" /><strong>BillCompass</strong><p>Restoring your session…</p></div>
  }

  if (!auth.isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

export function PublicOnlyRoute() {
  const auth = useAuth()

  if (auth.isLoading) {
    return <div className="bc-session-screen"><span className="bc-session-screen__mark" /><strong>BillCompass</strong><p>Restoring your session…</p></div>
  }

  if (auth.isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
