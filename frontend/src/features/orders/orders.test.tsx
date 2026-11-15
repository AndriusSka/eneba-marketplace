import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, type InitialEntry } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Order } from '../../api/orders'
import { json, stubRoutes } from '../../test/fetchRoutes'
import { OrderPage } from './OrderPage'
import { OrdersPage } from './OrdersPage'

const product = {
  id: 1, slug: 'elden-ring', title: 'Elden Ring', cover_url: '/placeholders/cover-1.svg',
  platform: { slug: 'steam', name: 'Steam' }, region: { slug: 'global', name: 'Global' },
}

const order: Order = {
  id: 41,
  status: 'paid',
  total_cents: 3000,
  currency: 'EUR',
  paid_at: '2026-11-15T12:00:00+00:00',
  item_count: 2,
  items: [
    {
      id: 1, offer_id: 1, product, seller: { id: 1, name: 'PixelVault' },
      unit_price_cents: 1500, quantity: 2, line_total_cents: 3000,
      keys: [{ id: 1, code: 'AAAAA-BBBBB-CCCCC' }, { id: 2, code: 'DDDDD-EEEEE-FFFFF' }],
    },
  ],
}

function renderAt(entry: InitialEntry) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter(
    [
      { path: '/orders', element: <OrdersPage /> },
      { path: '/orders/:id', element: <OrderPage /> },
    ],
    { initialEntries: [entry] },
  )
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('OrderPage', () => {
  it('shows each key with a copy button, and the confirmation right after paying', async () => {
    stubRoutes({ 'GET /api/orders/41': () => json(200, { data: order }) })
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    renderAt({ pathname: '/orders/41', state: { justPaid: true } })

    expect(await screen.findByText('Payment received')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Order #41' })).toBeInTheDocument()
    expect(screen.getByText('AAAAA-BBBBB-CCCCC')).toBeInTheDocument()
    expect(screen.getByText('DDDDD-EEEEE-FFFFF')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Copy key AAAAA-BBBBB-CCCCC' }))
    expect(await screen.findByText('Copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('AAAAA-BBBBB-CCCCC')
  })

  it('has no confirmation banner when opened from history', async () => {
    stubRoutes({ 'GET /api/orders/41': () => json(200, { data: order }) })
    renderAt('/orders/41')

    expect(await screen.findByRole('heading', { name: 'Order #41' })).toBeInTheDocument()
    expect(screen.queryByText('Payment received')).not.toBeInTheDocument()
  })

  it('tells the user to select the code when copying fails', async () => {
    stubRoutes({ 'GET /api/orders/41': () => json(200, { data: order }) })
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined })
    renderAt('/orders/41')

    fireEvent.click(await screen.findByRole('button', { name: 'Copy key AAAAA-BBBBB-CCCCC' }))
    expect(await screen.findByText('Couldn’t copy. Select the code instead.')).toBeInTheDocument()
  })

  it('shows the not-found page for someone else\'s order', async () => {
    stubRoutes({ 'GET /api/orders/7': () => json(404, { message: 'Not found.' }) })
    renderAt('/orders/7')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('OrdersPage', () => {
  it('lists orders in the API order and links each one', async () => {
    const older: Order = { ...order, id: 40, total_cents: 999, item_count: 1, items: [{ ...order.items[0], keys: undefined }] }
    stubRoutes({ 'GET /api/orders': () => json(200, { data: [{ ...order, items: [{ ...order.items[0], keys: undefined }] }, older] }) })
    renderAt('/orders')

    const links = await screen.findAllByRole('link', { name: /Order #/ })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/orders/41', '/orders/40'])
    expect(within(links[0]).getByText('€30.00')).toBeInTheDocument()
    expect(within(links[0]).getByText(/2 keys/)).toBeInTheDocument()
  })

  it('has an empty state', async () => {
    stubRoutes({ 'GET /api/orders': () => json(200, { data: [] }) })
    renderAt('/orders')

    expect(await screen.findByText('No orders yet')).toBeInTheDocument()
  })
})
