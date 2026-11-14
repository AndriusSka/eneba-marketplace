import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HealthStatus } from './HealthStatus'

function renderWithClient() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <HealthStatus />
    </QueryClientProvider>,
  )
}

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
  )
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('HealthStatus', () => {
  it('shows "API OK" when the API and the database are up', async () => {
    const fetchMock = stubFetch(200, { status: 'ok', db: 'ok' })

    renderWithClient()

    expect(await screen.findByText('API OK')).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/health', expect.anything())
  })

  it('shows an error when the API answers 503', async () => {
    stubFetch(503, { status: 'error', db: 'error' })

    renderWithClient()

    expect(await screen.findByRole('alert')).toHaveTextContent('API error: HTTP 503')
  })

  it('shows an error when the response has an unexpected shape', async () => {
    stubFetch(200, { hello: 'world' })

    renderWithClient()

    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected health response')
  })
})
