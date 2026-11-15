import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductList } from '../../api/products'
import { StorePage } from './StorePage'

const empty: ProductList = {
  data: [],
  meta: { page: 1, per_page: 24, total: 0, last_page: 1 },
  facets: { platforms: [], regions: [], price: { min_cents: null, max_cents: null } },
}

function renderStore(initialEntry: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(empty), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/store', element: <StorePage /> }], { initialEntries: [initialEntry] })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

describe('StorePage search results', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('names the query when nothing matches and offers to clear it', async () => {
    const router = renderStore('/store?q=qwerty')

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Results for “qwerty”')
    expect(await screen.findByText('No results for “qwerty”.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))

    expect(router.state.location.search).toBe('')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Store')
  })
})
