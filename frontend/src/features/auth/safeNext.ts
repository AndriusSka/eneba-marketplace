import { sameSitePath } from '../../lib/sameSitePath'

// The `?next=` parameter on /login and /register: where to go after signing in.

const AUTH_PAGES = new Set(['/login', '/register'])

/**
 * Returns `next` only if it is a path on this site, otherwise '/'. This blocks open redirects such as
 * `//evil.com`, `/\evil.com`, `https://evil.com` or `javascript:` (see sameSitePath). The auth pages
 * themselves are not a destination.
 */
export function safeNext(next: string | null | undefined): string {
  const path = next ? sameSitePath(next) : null
  // The pathname is the part before any query or hash.
  if (path === null || AUTH_PAGES.has(path.split(/[?#]/, 1)[0])) {
    return '/'
  }
  return path
}

/** Link to /login or /register that comes back to `returnTo` afterwards. */
export function authHref(page: 'login' | 'register', returnTo: string): string {
  const next = safeNext(returnTo)
  return next === '/' ? `/${page}` : `/${page}?next=${encodeURIComponent(next)}`
}
