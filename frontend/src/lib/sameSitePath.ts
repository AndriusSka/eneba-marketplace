// A throwaway origin to resolve against: anything that resolves to another origin is not on this site.
const BASE = 'https://app.invalid'

/**
 * Returns `value` as a path on this site (path, query and hash), or null.
 *
 * It asks the URL parser instead of checking the string, because the parser is what the browser
 * follows. It drops tabs and newlines and reads "\" as "/", so "/\t/evil.example" and
 * "/\evil.example" both lead to another site even though they start with a single "/".
 */
export function sameSitePath(value: string): string | null {
  if (!value.startsWith('/')) {
    return null
  }

  let url: URL
  try {
    url = new URL(value, BASE)
  } catch {
    return null
  }

  return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : null
}
