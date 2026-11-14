export class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
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
  const body: unknown = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(response.status, messageFrom(body) ?? `HTTP ${response.status}`)
  }

  return body
}

function messageFrom(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message
  }
  return undefined
}
