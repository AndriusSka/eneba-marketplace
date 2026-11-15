import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ORDER_KEY, ORDERS_KEY, type Order } from '../../api/orders'
import { itemsOf, quoteFor } from '../../test/cartQuote'
import { clearCookies, headersOf, json, stubRoutes } from '../../test/fetchRoutes'
import { RequireAuth } from '../auth/RequireAuth'
import { CartPage } from '../cart/CartPage'
import { cartStore } from '../cart/cartStore'
import { CheckoutPage } from './CheckoutPage'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const order: Order = {
  id: 41,
  status: 'paid',
  total_cents: 3000,
  currency: 'EUR',
  paid_at: '2026-11-15T12:00:00+00:00',
  item_count: 2,
  items: [
    {
      id: 1,
      offer_id: 1,
      product: {
        id: 1, slug: 'product-1', title: 'Elden Ring', cover_url: '/placeholders/cover-1.svg',
        platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
      },
      seller: { id: 1, name: 'PixelVault' },
      unit_price_cents: 1500,
      quantity: 2,
      line_total_cents: 3000,
      keys: [{ id: 1, code: 'AAAAA-BBBBB-CCCCC' }, { id: 2, code: 'DDDDD-EEEEE-FFFFF' }],
    },
  ],
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

function newClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

function renderCheckout(client = newClient()) {
  const router = createMemoryRouter(
    [
      { element: <RequireAuth />, children: [{ path: '/checkout', element: <CheckoutPage /> }] },
      { path: '/cart', element: <CartPage /> },
      { path: '*', element: <Where /> },
    ],
    { initialEntries: ['/checkout'] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return router
}

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>

function stubCheckout(checkout: Handler) {
  return stubRoutes({
    'GET /api/me': () => json(200, { data: { id: 7, name: 'Ada', email: 'ada@example.com' } }),
    'POST /api/cart/quote': (init) => json(200, quoteFor(itemsOf(init))),
    'POST /api/checkout': checkout,
  })
}

function checkoutCalls(fetchMock: ReturnType<typeof stubRoutes>) {
  return fetchMock.mock.calls.filter(([url]) => String(url) === '/api/checkout').map(([, init]) => init)
}

async function payWith(card: string) {
  fireEvent.change(await screen.findByLabelText('Card number'), { target: { value: card } })
  fireEvent.click(screen.getByRole('button', { name: /^Pay / }))
}

beforeEach(() => {
  document.cookie = 'XSRF-TOKEN=t; path=/'
  localStorage.clear()
  cartStore.reload()
  cartStore.add(1, 2)
})
afterEach(() => {
  vi.unstubAllGlobals()
  clearCookies()
})

describe('CheckoutPage', () => {
  it('shows the server-priced summary and pays with ids, quantities and the card only', async () => {
    const fetchMock = stubCheckout(() => json(201, { data: order }))
    const router = renderCheckout()

    expect(await screen.findByRole('button', { name: 'Pay €30.00' })).toBeDisabled() // no card yet
    await payWith('4242 4242 4242 4242')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/orders/41'))
    expect(router.state.location.state).toEqual({ justPaid: true })
    expect(cartStore.get()).toEqual([])

    const [init] = checkoutCalls(fetchMock)
    expect(JSON.parse(String(init?.body))).toEqual({
      items: [{ offer_id: 1, quantity: 2 }],
      card_number: '4242 4242 4242 4242',
    })
    expect(headersOf(init)['Idempotency-Key']).toMatch(UUID)
  })

  it('fills in a test card from the list', async () => {
    stubCheckout(() => json(201, { data: order }))
    renderCheckout()

    fireEvent.click(await screen.findByRole('button', { name: '4000 0000 0000 0002' }))
    expect(screen.getByLabelText('Card number')).toHaveValue('4000 0000 0000 0002')
  })

  it('sends one request when Pay is clicked twice', async () => {
    let answer: (response: Response) => void = () => {}
    const fetchMock = stubCheckout(() => new Promise<Response>((resolve) => (answer = resolve)))
    const router = renderCheckout()

    fireEvent.change(await screen.findByLabelText('Card number'), { target: { value: '4242424242424242' } })
    const pay = screen.getByRole('button', { name: /^Pay / })
    fireEvent.click(pay)
    fireEvent.click(pay)
    await vi.waitFor(() => expect(checkoutCalls(fetchMock)).toHaveLength(1))
    expect(pay).toBeDisabled()

    answer(json(201, { data: order }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/orders/41'))
    expect(checkoutCalls(fetchMock)).toHaveLength(1)
  })

  it('keeps the Idempotency-Key after a network error, so the retry is a replay', async () => {
    let attempt = 0
    const fetchMock = stubCheckout(() => {
      attempt += 1
      if (attempt === 1) throw new TypeError('Failed to fetch')
      return json(200, { data: order })
    })
    const router = renderCheckout()

    await payWith('4242424242424242')
    expect(await screen.findByText(/you won’t be charged twice/)).toBeInTheDocument()
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 2 }])

    fireEvent.click(screen.getByRole('button', { name: /^Pay / }))
    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/orders/41'))

    const [first, second] = checkoutCalls(fetchMock)
    expect(headersOf(second)['Idempotency-Key']).toBe(headersOf(first)['Idempotency-Key'])
  })

  it('shows a declined card on the field, keeps the cart and uses a new key next time', async () => {
    const fetchMock = stubCheckout(() =>
      json(402, { message: 'Your card was declined. You have not been charged.', code: 'card_declined' }),
    )
    renderCheckout()

    await payWith('4000 0000 0000 0002')

    expect(await screen.findByText('Your card was declined. You have not been charged.')).toBeInTheDocument()
    expect(screen.getByLabelText('Card number')).toHaveAttribute('aria-invalid', 'true')
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 2 }])

    fireEvent.click(screen.getByRole('button', { name: /^Pay / }))
    await vi.waitFor(() => expect(checkoutCalls(fetchMock)).toHaveLength(2))
    const [first, second] = checkoutCalls(fetchMock)
    expect(headersOf(second)['Idempotency-Key']).not.toBe(headersOf(first)['Idempotency-Key'])
  })

  it('shows a 422 on the card field', async () => {
    stubCheckout(() =>
      json(422, { message: 'Invalid', errors: { card_number: ['Use test card 4242 4242 4242 4242.'] } }),
    )
    renderCheckout()

    await payWith('1234')

    expect(await screen.findByText('Use test card 4242 4242 4242 4242.')).toBeInTheDocument()
  })

  it('on a 409 goes back to the refreshed cart and names the offer', async () => {
    stubCheckout(() =>
      json(409, { message: 'Elden Ring from PixelVault has only 1 key left.', code: 'out_of_stock', offer_id: 1 }),
    )
    const router = renderCheckout()

    await payWith('4242424242424242')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/cart'))
    expect(
      await screen.findByText('Elden Ring from PixelVault has only 1 key left. Your cart has been updated.'),
    ).toBeInTheDocument()
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 2 }])
  })

  it('sends a guest whose session expired back to sign in, keeping the cart but not the cached orders', async () => {
    stubCheckout(() => json(401, { message: 'Unauthenticated.' }))
    const client = newClient()
    client.setQueryData([ORDER_KEY, '41'], order)
    client.setQueryData([ORDERS_KEY], [order])
    const router = renderCheckout(client)

    await payWith('4242424242424242')

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(router.state.location.search).toBe('?next=%2Fcheckout')
    expect(cartStore.get()).toEqual([{ offerId: 1, quantity: 2 }])
    expect(client.getQueryData([ORDER_KEY, '41'])).toBeUndefined()
    expect(client.getQueryData([ORDERS_KEY])).toBeUndefined()
  })

  it('sends an empty cart to the cart page', async () => {
    cartStore.clear()
    stubCheckout(() => json(201, { data: order }))
    const router = renderCheckout()

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/cart'))
  })

  it('sends a cart with an unbuyable line to the cart page', async () => {
    cartStore.add(3, 1) // out of stock
    stubCheckout(() => json(201, { data: order }))
    const router = renderCheckout()

    await vi.waitFor(() => expect(router.state.location.pathname).toBe('/cart'))
  })
})
