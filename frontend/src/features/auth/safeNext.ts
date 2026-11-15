// The `?next=` parameter on /login and /register: where to go after signing in.

const AUTH_PAGES = new Set(['/login', '/register'])
// A throwaway base: anything that resolves to another origin is not one of our pages.
const BASE = 'https://app.invalid'

/**
 * Returns `next` only if it is a path on this site, otherwise '/'. This blocks open redirects such as
 * `//evil.com`, `/\evil.com`, `https://evil.com` or `javascript:`, which the URL parser resolves to
 * another origin. The auth pages themselves are not a destination.
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/')) {
    return '/'
  }

  let url: URL
  try {
    url = new URL(next, BASE)
  } catch {
    return '/'
  }

  if (url.origin !== BASE || AUTH_PAGES.has(url.pathname)) {
    return '/'
  }
  return `${url.pathname}${url.search}${url.hash}`
}

/** Link to /login or /register that comes back to `returnTo` afterwards. */
export function authHref(page: 'login' | 'register', returnTo: string): string {
  const next = safeNext(returnTo)
  return next === '/' ? `/${page}` : `/${page}?next=${encodeURIComponent(next)}`
}
