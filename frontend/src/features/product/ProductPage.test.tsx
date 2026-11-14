import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Offer, ProductDetail } from '../../api/products'
import { ProductPage } from './ProductPage'

function offer(overrides: Partial<Offer>): Offer {
  return {
    id: 1,
    seller: { id: 1, name: 'Pixel Vault', rating: 4.8 },
    price_cents: 3449,
    currency: 'EUR',
    discount_percent: 42,
    stock: 3,
    in_stock: true,
    ...overrides,
  }
}

const product: ProductDetail = {
  id: 12,
  slug: 'elden-ring-steam-global',
  title: 'Elden Ring',
  description: 'An action RPG.',
  cover_url: '/placeholders/cover-1.svg',
  platform: { slug: 'steam', name: 'Steam' },
  region: { slug: 'global', name: 'Global' },
  release_date: '2022-02-25',
  msrp_cents: 5999,
  currency: 'EUR',
  from_price_cents: 3449,
  discount_percent: 42,
  in_stock: true,
  // API order: in stock first, then by price.
  offers: [
    offer({ id: 1, seller: { id: 1, name: 'Pixel Vault', rating: 4.8 }, price_cents: 3449 }),
    offer({ id: 2, seller: { id: 2, name: 'KeyHub', rating: 4.1 }, price_cents: 4500, discount_percent: 24, stock: 2 }),
    offer({ id: 3, seller: { id: 3, name: 'Old Stock', rating: 3.9 }, price_cents: 2999, discount_percent: 50, stock: 0, in_stock: false }),
  ],
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })),
  )
}

function renderProduct(slug = product.slug) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/product/:slug', element: <ProductPage /> }], {
    initialEntries: [`/product/${slug}`],
  })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ProductPage', () => {
  it('shows the not-found page for an unknown slug', async () => {
    stubFetch(404, { message: 'Not found.' })

    renderProduct('does-not-exist')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('shows the product and highlights the first in-stock offer as the best', async () => {
    stubFetch(200, { data: product })

    renderProduct()

    expect(await screen.findByRole('heading', { name: 'Elden Ring', level: 1 })).toBeInTheDocument()
    const [best, ...others] = screen.getAllByTestId('offer-row')
    expect(within(best).getByText('Pixel Vault')).toBeInTheDocument()
    expect(within(best).getByText('Best price')).toBeInTheDocument()
    expect(within(best).getByText('€34.49')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Other offers (2)' })).toBeInTheDocument()
    expect(others.map((row) => within(row).queryByText('Best price'))).toEqual([null, null])
  })

  it('disables the add button on an offer with no keys left', async () => {
    stubFetch(200, { data: product })

    renderProduct()

    const rows = await screen.findAllByTestId('offer-row')
    const soldOut = rows[2]
    expect(within(soldOut).getByRole('button', { name: 'Out of stock' })).toBeDisabled()
    expect(within(rows[0]).getByRole('button', { name: 'Add to cart' })).toBeEnabled()
  })

  it('has no best offer when every offer is sold out', async () => {
    stubFetch(200, {
      data: {
        ...product,
        from_price_cents: null,
        discount_percent: null,
        in_stock: false,
        offers: [offer({ id: 9, stock: 0, in_stock: false })],
      },
    })

    renderProduct()

    expect(await screen.findByRole('heading', { name: 'Offers (1)' })).toBeInTheDocument()
    expect(screen.queryByText('Best price')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  })
})
