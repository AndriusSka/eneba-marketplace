import { Link, useLocation, useSearchParams } from 'react-router'
import { useLogout, useMe } from '../../api/auth'
import { Button } from '../../components/Button'
import { authHref } from './safeNext'

const AUTH_PAGES = new Set(['/login', '/register'])

/** Header, right side (DESIGN.md › Header): the user's name and "Sign out", or "Sign in | Register". */
export function UserMenu() {
  const location = useLocation()
  const [params] = useSearchParams()
  const me = useMe()
  const logout = useLogout()

  // Unknown yet: render nothing rather than flashing "Sign in" at a signed-in user.
  if (me.isPending) {
    return null
  }

  if (me.data) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="max-w-40 truncate font-semibold text-fg" title={me.data.email}>
          {me.data.name}
        </span>
        <Button variant="secondary" size="sm" disabled={logout.isPending} onClick={() => logout.mutate()}>
          Sign out
        </Button>
      </div>
    )
  }

  // Come back to this page after signing in. On the auth pages themselves, keep their `next`.
  const returnTo = AUTH_PAGES.has(location.pathname)
    ? (params.get('next') ?? '/')
    : `${location.pathname}${location.search}`

  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      <Link to={authHref('login', returnTo)} className="text-fg hover:text-accent">
        Sign in
      </Link>
      <span aria-hidden="true" className="text-fg-muted">
        |
      </span>
      <Link to={authHref('register', returnTo)} className="text-fg hover:text-accent">
        Register
      </Link>
    </div>
  )
}
