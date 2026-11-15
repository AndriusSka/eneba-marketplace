import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type { Cart } from '../features/cart/cartStore'
import { sendJson } from './client'
import { isArrayOf, isNullable, isNumber, isObject, isString } from './guards'
import type { Named } from './products'

// POST /api/cart/quote (ARCHITECTURE.md › API): the cart priced from the database.

export type ProductBrief = {
  id: number
  slug: string
  title: string
  cover_url: string
  platform: Named
  region: Named
}

export type QuoteWarning = 'out_of_stock' | 'quantity_reduced' | 'inactive' | 'unavailable'

export type QuoteLine = {
  offer_id: number
  requested_quantity: number
  /** What can be bought now; 0 when the line can't be bought at all. */
  quantity: number
  stock: number
  unit_price_cents: number | null
  line_total_cents: number
  warning: QuoteWarning | null
  /** null for an offer that no longer exists */
  product: ProductBrief | null
  seller: { id: number; name: string } | null
}

export type CartQuote = {
  lines: QuoteLine[]
  total_cents: number
  currency: string
  checkout_ready: boolean
}

const WARNINGS: ReadonlySet<string> = new Set<QuoteWarning>(['out_of_stock', 'quantity_reduced', 'inactive', 'unavailable'])

/** The line can't be bought and blocks checkout (a reduced quantity can still be bought). */
export function blocksCheckout(line: QuoteLine): boolean {
  return line.warning !== null && line.warning !== 'quantity_reduced'
}

function isNamed(value: unknown): value is Named {
  return isObject(value) && isString(value.slug) && isString(value.name)
}

export function isProductBrief(value: unknown): value is ProductBrief {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isString(value.slug) &&
    isString(value.title) &&
    isString(value.cover_url) &&
    isNamed(value.platform) &&
    isNamed(value.region)
  )
}

export function isSellerBrief(value: unknown): value is { id: number; name: string } {
  return isObject(value) && isNumber(value.id) && isString(value.name)
}

function isWarning(value: unknown): value is QuoteWarning | null {
  return value === null || (isString(value) && WARNINGS.has(value))
}

function isQuoteLine(value: unknown): value is QuoteLine {
  return (
    isObject(value) &&
    isNumber(value.offer_id) &&
    isNumber(value.requested_quantity) &&
    isNumber(value.quantity) &&
    isNumber(value.stock) &&
    isNullable(isNumber)(value.unit_price_cents) &&
    isNumber(value.line_total_cents) &&
    isWarning(value.warning) &&
    isNullable(isProductBrief)(value.product) &&
    isNullable(isSellerBrief)(value.seller)
  )
}

function isCartQuote(value: unknown): value is CartQuote {
  return (
    isObject(value) &&
    isArrayOf(value.lines, isQuoteLine) &&
    isNumber(value.total_cents) &&
    isString(value.currency) &&
    typeof value.checkout_ready === 'boolean'
  )
}

/** The request body for the quote and for checkout: ids and quantities, nothing else. */
export function toItems(cart: Cart): { offer_id: number; quantity: number }[] {
  return cart.map((line) => ({ offer_id: line.offerId, quantity: line.quantity }))
}

export async function fetchCartQuote(cart: Cart): Promise<CartQuote> {
  const body = await sendJson('POST', '/api/cart/quote', { items: toItems(cart) })
  if (!isObject(body) || !isCartQuote(body.data)) {
    throw new Error('Unexpected cart quote response')
  }
  return body.data
}

export const CART_QUOTE_KEY = 'cart-quote'

export function useCartQuote(cart: Cart) {
  return useQuery({
    queryKey: [CART_QUOTE_KEY, toItems(cart)],
    queryFn: () => fetchCartQuote(cart),
    enabled: cart.length > 0,
    // Keep the last quote on screen while a quantity change is re-priced.
    placeholderData: keepPreviousData,
  })
}
