import { Navigate, Outlet, useLocation } from 'react-router'
import { useMe } from '../../api/auth'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'
import { Skeleton } from '../../components/Skeleton'
import { authHref } from './safeNext'

/**
 * Route wrapper for signed-in pages (checkout and orders, M6). A guest is sent to
 * /login?next=<this page>, and comes back here after signing in. The backend enforces the same
 * rule with 401s; this only decides what to render.
 */
export function RequireAuth() {
  const location = useLocation()
  const me = useMe()

  if (me.isPending) {
    return (
      <div className={`${CONTAINER} py-8`} aria-busy="true">
        <Skeleton className="h-40" />
      </div>
    )
  }

  // Not a 401 (that is `null`): the API is down or slow. Sending the user to the login form would
  // be misleading, so offer a retry instead.
  if (me.isError) {
    return (
      <div className={`${CONTAINER} flex flex-col items-start gap-4 py-8`}>
        <p role="alert" className="text-fg">
          We couldn't check whether you're signed in.
        </p>
        <Button variant="secondary" onClick={() => void me.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  if (me.data === null) {
    return <Navigate to={authHref('login', `${location.pathname}${location.search}`)} replace />
  }

  return <Outlet />
}
