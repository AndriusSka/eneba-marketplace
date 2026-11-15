import type { CartQuote, QuoteLine } from '../api/cart'
import { isArrayOf, isNumber, isObject } from '../api/guards'

// A stand-in for POST /api/cart/quote that prices whatever cart it is sent, from a small catalog.

export type FakeOffer = { price: number; stock: number; title: string; active?: boolean }

export const fakeCatalog = new Map<number, FakeOffer>([
  [1, { price: 1500, stock: 10, title: 'Elden Ring' }],
  [2, { price: 999, stock: 2, title: 'Hades' }],
  [3, { price: 700, stock: 0, title: 'Celeste' }],
  [4, { price: 500, stock: 5, title: 'Inside', active: false }],
])

type Item = { offer_id: number; quantity: number }

function isItem(value: unknown): value is Item {
  return isObject(value) && isNumber(value.offer_id) && isNumber(value.quantity)
}

/** The request's items, from a fetch `init.body`. */
export function itemsOf(init: RequestInit | undefined): Item[] {
  const body: unknown = JSON.parse(String(init?.body))
  if (!isObject(body) || !isArrayOf(body.items, isItem)) throw new Error('Not a cart body')
  return body.items
}

export function quoteFor(items: Item[], catalog: ReadonlyMap<number, FakeOffer> = fakeCatalog): { data: CartQuote } {
  const lines: QuoteLine[] = items.map(({ offer_id, quantity }) => {
    const offer = catalog.get(offer_id)
    if (!offer) {
      return {
        offer_id,
        requested_quantity: quantity,
        quantity: 0,
        stock: 0,
        unit_price_cents: null,
        line_total_cents: 0,
        warning: 'unavailable',
        product: null,
        seller: null,
      }
    }
    const warning =
      offer.active === false ? 'inactive' : offer.stock === 0 ? 'out_of_stock' : quantity > offer.stock ? 'quantity_reduced' : null
    const buyable = warning === null ? quantity : warning === 'quantity_reduced' ? offer.stock : 0
    return {
      offer_id,
      requested_quantity: quantity,
      quantity: buyable,
      stock: offer.stock,
      unit_price_cents: offer.price,
      line_total_cents: offer.price * buyable,
      warning,
      product: {
        id: offer_id,
        slug: `product-${offer_id}`,
        title: offer.title,
        cover_url: '/placeholders/cover-1.svg',
        platform: { slug: 'steam', name: 'Steam' },
        region: { slug: 'global', name: 'Global' },
      },
      seller: { id: 1, name: 'PixelVault' },
    }
  })
  return {
    data: {
      lines,
      total_cents: lines.reduce((sum, line) => sum + line.line_total_cents, 0),
      currency: 'EUR',
      checkout_ready: lines.length > 0 && lines.every((line) => line.warning === null || line.warning === 'quantity_reduced'),
    },
  }
}
