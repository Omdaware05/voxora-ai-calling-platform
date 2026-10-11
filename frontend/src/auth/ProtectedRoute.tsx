import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { Skeleton } from '../components/ui/skeleton'

interface ProtectedRouteProps {
  children: React.JSX.Element
  roles?: string[]
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps): React.JSX.Element {
  const { isAuthenticated, isLoading, hasRole } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm space-y-3 p-6">
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/" replace />
  }

  return children
}
