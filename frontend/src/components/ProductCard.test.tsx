import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import type { ProductSummary } from '../api/products'
import { cartStore } from '../features/cart/cartStore'
import { ProductCard } from './ProductCard'

const product: ProductSummary = {
  id: 12,
  slug: 'elden-ring-steam-global',
  title: 'Elden Ring',
  cover_url: '/covers/elden-ring.svg',
  platform: { slug: 'steam', name: 'Steam' },
  region: { slug: 'global', name: 'Global' },
  release_date: '2022-02-25',
  msrp_cents: 5999,
  currency: 'EUR',
  from_price_cents: 3449,
  from_offer_id: 41,
  discount_percent: 42,
  in_stock: true,
}

function renderCard(card: ProductSummary) {
  const router = createMemoryRouter([{ path: '/', element: <ProductCard product={card} /> }])
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  localStorage.clear()
  cartStore.reload()
})

describe('ProductCard', () => {
  it('links the whole card to the product page', () => {
    renderCard(product)

    expect(screen.getByRole('link', { name: /Elden Ring/ })).toHaveAttribute('href', '/product/elden-ring-steam-global')
  })

  it('adds the offer behind the shown price from the hover panel', () => {
    renderCard(product)

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }))

    expect(cartStore.get()).toEqual([{ offerId: 41, quantity: 1 }])
    expect(screen.getByText(/Added/)).toBeInTheDocument()
  })

  it('offers no Add to cart when nothing is in stock', () => {
    renderCard({ ...product, from_price_cents: null, from_offer_id: null, discount_percent: null, in_stock: false })

    expect(screen.getByText('Out of stock')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument()
  })
})
