import { vi } from 'vitest'

// Test helpers for code that calls fetch(): route stubs by "METHOD /path" and cookie cleanup.

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

export function json(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Stubs the global fetch. Keys are "GET /api/me" (exact path with query) or the path without its
 * query. An unexpected request fails the test.
 */
export function stubRoutes(routes: Record<string, Handler>) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? 'GET'
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const path = url.replace(/^https?:\/\/[^/]+/, '')
    const handler = routes[`${method} ${path}`] ?? routes[`${method} ${path.split('?')[0]}`]
    if (!handler) {
      throw new Error(`Unexpected request: ${method} ${path}`)
    }
    return handler(init)
  })
  vi.stubGlobal('fetch', mock)
  return mock
}

export function headersOf(init: RequestInit | undefined): Record<string, string> {
  const headers = init?.headers
  return headers && !(headers instanceof Headers) && !Array.isArray(headers) ? headers : {}
}

export function clearCookies(): void {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim()
    if (name) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
    }
  }
}
