import { isArrayOf, isObject, isString } from './guards'

export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  /** Laravel validation errors (422, and 429 on login), keyed by field. */
  readonly errors: FieldErrors

  constructor(status: number, message: string, errors: FieldErrors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

/**
 * GET a JSON endpoint on the same origin. Returns the parsed body as `unknown`
 * so every caller has to narrow it before use.
 */
export async function getJson(path: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(path, {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
  })
  return parseResponse(response)
}

export type MutatingMethod = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Send a state-changing request with Laravel's CSRF protection (ARCHITECTURE.md › Authentication).
 *
 * Auth is the session cookie, which is httpOnly: this code never sees it, the browser attaches it.
 * The only cookie read here is XSRF-TOKEN, which is not a credential: it is echoed back as the
 * X-XSRF-TOKEN header so Laravel knows the request came from our own page. If the cookie is missing
 * it is fetched first, and a 419 (token expired with the session) is retried once with a fresh one.
 * Returns the parsed body as `unknown`, or null for an empty response such as 204.
 */
export async function sendJson(
  method: MutatingMethod,
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
): Promise<unknown> {
  if (readCookie(XSRF_COOKIE) === undefined) {
    await refreshCsrfCookie()
  }

  let response = await send(method, path, body, headers)
  if (response.status === CSRF_MISMATCH) {
    await refreshCsrfCookie()
    response = await send(method, path, body, headers)
  }
  return parseResponse(response)
}

const XSRF_COOKIE = 'XSRF-TOKEN'
const CSRF_MISMATCH = 419

function send(method: MutatingMethod, path: string, body: unknown, headers: Record<string, string>): Promise<Response> {
  return fetch(path, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      'X-XSRF-TOKEN': readCookie(XSRF_COOKIE) ?? '',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  })
}

async function refreshCsrfCookie(): Promise<void> {
  const response = await fetch('/sanctum/csrf-cookie', {
    headers: { Accept: 'application/json' },
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new ApiError(response.status, `HTTP ${response.status}`)
  }
}

/** Laravel URL-encodes the XSRF-TOKEN cookie value. */
export function readCookie(name: string): string | undefined {
  for (const part of document.cookie.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) {
      return decodeURIComponent(rest.join('='))
    }
  }
  return undefined
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  let body: unknown = null
  if (text !== '') {
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(body) ?? `HTTP ${response.status}`, errorsFrom(body))
  }

  return body
}

function messageFrom(body: unknown): string | undefined {
  return isObject(body) && isString(body.message) ? body.message : undefined
}

function errorsFrom(body: unknown): FieldErrors {
  if (!isObject(body) || !isObject(body.errors)) {
    return {}
  }
  const errors: FieldErrors = {}
  for (const [field, messages] of Object.entries(body.errors)) {
    if (isArrayOf(messages, isString)) {
      errors[field] = messages
    }
  }
  return errors
}
