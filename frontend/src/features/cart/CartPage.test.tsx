import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { itemsOf, quoteFor } from '../../test/cartQuote'
import { clearCookies, json, stubRoutes } from '../../test/fetchRoutes'
import { CartLink } from './CartLink'
import { CartPage } from './CartPage'
import { cartStore } from './cartStore'

function stubQuote() {
  return stubRoutes({
    'POST /api/cart/quote': (init) => json(200, quoteFor(itemsOf(init))),
  })
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderCart() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/cart', element: <><CartLink /><CartPage /></> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: ['/cart'] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  localStorage.clear()
  cartStore.reload()
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearCookies()
})

describe('CartPage', () => {
  it('shows an empty cart without asking the server', () => {
    const fetchMock = stubQuote()
    renderCart()

    expect(screen.getByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('shows the server prices and total, and sends only ids and quantities', async () => {
    const fetchMock = stubQuote()
    cartStore.add(1, 2)
    cartStore.add(2, 1)
    renderCart()

    const lines = await screen.findAllByTestId('cart-line')
    expect(within(lines[0]).getByText('Elden Ring')).toBeInTheDocument()
    expect(within(lines[0]).getByText('€30.00')).toBeInTheDocument()
    expect(within(lines[0]).getByText('2 × €15.00')).toBeInTheDocument()
    expect(screen.getByText('€39.99')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Cart, 3 items' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeEnabled()

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toEqual({
      items: [
        { offer_id: 1, quantity: 2 },
        { offer_id: 2, quantity: 1 },
      ],
    })
  })

  it('changes quantities and removes lines', async () => {
    stubQuote()
    cartStore.add(1, 1)
    cartStore.add(2, 1)
    renderCart()

    const [elden] = await screen.findAllByTestId('cart-line')
    fireEvent.click(within(elden).getByRole('button', { name: 'Increase quantity' }))
    expect(cartStore.get()[0]).toEqual({ offerId: 1, quantity: 2 })
    expect(await within(elden).findByText('€30.00')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remove Hades from the cart' }))
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 2 }])
  })

  it('lowers a quantity to the stock and says so', async () => {
    stubQuote()
    cartStore.add(2, 5) // Hades has 2 keys left
    renderCart()

    expect(await screen.findByText('Hades from PixelVault: 2 keys left')).toBeInTheDocument()
    expect(cartStore.get()).toEqual([{ offerId: 2, quantity: 2 }])
    // The stepper can't go past the stock.
    expect(screen.getByRole('button', { name: 'Increase quantity' })).toBeDisabled()
    expect(await within(screen.getByTestId('cart-line')).findByText('€19.98')).toBeInTheDocument()
  })

  it('blocks checkout while a line can not be bought, until it is removed', async () => {
    stubQuote()
    cartStore.add(1, 1)
    cartStore.add(3, 1) // out of stock
    cartStore.add(4, 1) // inactive
    cartStore.add(99, 1) // no longer exists
    renderCart()

    expect(await screen.findByText('Out of stock. Remove it to continue.')).toBeInTheDocument()
    expect(screen.getByText('No longer sold by this seller. Remove it to continue.')).toBeInTheDocument()
    expect(screen.getByText('This offer no longer exists. Remove it to continue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Checkout' })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove unavailable items' }))

    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 1 }])
    await vi.waitFor(() => expect(screen.getByRole('button', { name: 'Checkout' })).toBeEnabled())
  })

  it('goes to checkout', async () => {
    stubQuote()
    cartStore.add(1)
    const router = renderCart()

    fireEvent.click(await screen.findByRole('button', { name: 'Checkout' }))
    expect(router.state.location.pathname).toBe('/checkout')
  })

  it('keeps the cart and offers a retry when prices can not be loaded', async () => {
    let fail = true
    stubRoutes({
      'POST /api/cart/quote': (init) => (fail ? json(500, { message: 'Server Error' }) : json(200, quoteFor(itemsOf(init)))),
    })
    cartStore.add(1)
    renderCart()

    expect(await screen.findByText('We couldn’t load current prices for your cart.')).toBeInTheDocument()
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 1 }])

    fail = false
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Elden Ring')).toBeInTheDocument()
  })
})
