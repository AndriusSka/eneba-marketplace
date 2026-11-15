import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CART_QUOTE_KEY, isProductBrief, isSellerBrief, type ProductBrief } from './cart'
import { ApiError, getJson, sendJson } from './client'
import { isArrayOf, isNullable, isNumber, isObject, isString } from './guards'

// POST /api/checkout, GET /api/orders, GET /api/orders/{id} (ARCHITECTURE.md › API).

export type OrderKey = { id: number; code: string }

export type OrderItem = {
  id: number
  offer_id: number
  product: ProductBrief
  seller: { id: number; name: string }
  unit_price_cents: number
  quantity: number
  line_total_cents: number
  /** Only on a single order (and the checkout response), never in the history list. */
  keys?: OrderKey[]
}

export type Order = {
  id: number
  status: string
  total_cents: number
  currency: string
  paid_at: string | null
  item_count: number
  items: OrderItem[]
}

export type CheckoutInput = {
  items: { offer_id: number; quantity: number }[]
  card_number: string
  idempotencyKey: string
}

export const ORDERS_KEY = 'orders'
export const ORDER_KEY = 'order'

function isOrderKey(value: unknown): value is OrderKey {
  return isObject(value) && isNumber(value.id) && isString(value.code)
}

function isOrderItem(value: unknown): value is OrderItem {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isNumber(value.offer_id) &&
    isProductBrief(value.product) &&
    isSellerBrief(value.seller) &&
    isNumber(value.unit_price_cents) &&
    isNumber(value.quantity) &&
    isNumber(value.line_total_cents) &&
    (value.keys === undefined || isArrayOf(value.keys, isOrderKey))
  )
}

export function isOrder(value: unknown): value is Order {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isString(value.status) &&
    isNumber(value.total_cents) &&
    isString(value.currency) &&
    isNullable(isString)(value.paid_at) &&
    isNumber(value.item_count) &&
    isArrayOf(value.items, isOrderItem)
  )
}

function parseOrder(body: unknown): Order {
  if (isObject(body) && isOrder(body.data)) return body.data
  throw new Error('Unexpected order response')
}

export async function fetchOrders(signal?: AbortSignal): Promise<Order[]> {
  const body = await getJson('/api/orders', signal)
  if (!isObject(body) || !isArrayOf(body.data, isOrder)) {
    throw new Error('Unexpected orders response')
  }
  return body.data
}

export async function fetchOrder(id: string, signal?: AbortSignal): Promise<Order> {
  return parseOrder(await getJson(`/api/orders/${encodeURIComponent(id)}`, signal))
}

export function useOrders() {
  return useQuery({ queryKey: [ORDERS_KEY], queryFn: ({ signal }) => fetchOrders(signal) })
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: [ORDER_KEY, id],
    queryFn: ({ signal }) => fetchOrder(id, signal),
    // A 404 (not yours, or no such order) is an answer: don't retry it.
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
}

/** Sends only offer ids, quantities and the card: the server prices everything. */
export async function postCheckout({ items, card_number, idempotencyKey }: CheckoutInput): Promise<Order> {
  return parseOrder(await sendJson('POST', '/api/checkout', { items, card_number }, { 'Idempotency-Key': idempotencyKey }))
}

export function useCheckout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: postCheckout,
    onSuccess: (order) => {
      queryClient.setQueryData([ORDER_KEY, String(order.id)], order)
      void queryClient.invalidateQueries({ queryKey: [ORDERS_KEY] })
      // Stock changed: product pages, the Store and the homepage show fresh numbers next time.
      void queryClient.invalidateQueries({ queryKey: ['product'] })
      void queryClient.invalidateQueries({ queryKey: ['products'] })
      void queryClient.invalidateQueries({ queryKey: ['home'] })
      queryClient.removeQueries({ queryKey: [CART_QUOTE_KEY] })
    },
  })
}
