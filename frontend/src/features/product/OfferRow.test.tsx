import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Offer } from '../../api/products'
import { CartLink } from '../cart/CartLink'
import { cartStore, MAX_LINES } from '../cart/cartStore'
import { OfferRow } from './OfferRow'

const offer: Offer = {
  id: 8,
  seller: { id: 1, name: 'PixelVault', rating: 4.8 },
  price_cents: 3449,
  currency: 'EUR',
  discount_percent: 42,
  stock: 2,
  in_stock: true,
}

function renderRow(row: Offer = offer) {
  const router = createMemoryRouter(
    [{ path: '/', element: <><CartLink /><ul><OfferRow offer={row} msrpCents={5999} /></ul></> }],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

beforeEach(() => {
  localStorage.clear()
  cartStore.reload()
})

describe('OfferRow › Add to cart', () => {
  it('adds the offer, updates the header badge and links to the cart', () => {
    renderRow()

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }))

    expect(cartStore.get()).toEqual([{ offerId: 8, quantity: 1 }])
    expect(screen.getByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart')
  })

  it('stops at the stock shown on the page', () => {
    renderRow()
    const add = screen.getByRole('button', { name: 'Add to cart' })

    fireEvent.click(add)
    fireEvent.click(add)
    expect(screen.getByText(/2 in cart/)).toBeInTheDocument()

    fireEvent.click(add)
    expect(screen.getByText('You already have the most you can buy in your cart.')).toBeInTheDocument()
    expect(cartStore.get()).toEqual([{ offerId: 8, quantity: 2 }])
  })

  it('says so when the cart is full', () => {
    for (let id = 100; id < 100 + MAX_LINES; id++) cartStore.add(id)
    renderRow()

    fireEvent.click(screen.getByRole('button', { name: 'Add to cart' }))

    expect(screen.getByText(`Your cart is full (${MAX_LINES} items).`)).toBeInTheDocument()
  })

  it('can not add a sold-out offer', () => {
    renderRow({ ...offer, stock: 0, in_stock: false })

    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled()
  })
})
