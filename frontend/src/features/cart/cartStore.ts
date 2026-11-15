import { useSyncExternalStore } from 'react'
import { isNumber, isObject } from '../../api/guards'

// The cart lives in the browser (SPEC.md › Checkout): offer ids and quantities only. Prices, titles
// and stock always come from the server (POST /api/cart/quote), never from here.

export type CartLine = { offerId: number; quantity: number }
export type Cart = readonly CartLine[]

/** Per line (the order_items CHECK) and per cart (the checkout validation). */
export const MAX_QUANTITY = 10
export const MAX_LINES = 20

export const STORAGE_KEY = 'cart:v1'

export type AddResult =
  | { ok: true; quantity: number; capped: boolean }
  | { ok: false; reason: 'cart_full' | 'max_reached' | 'out_of_stock' }

// ── Pure operations ────────────────────────────────────────────────────────────

/** 1–10, or the stock when it is lower. */
function clampQuantity(quantity: number, stock = MAX_QUANTITY): number {
  return Math.max(1, Math.min(Math.trunc(quantity), MAX_QUANTITY, stock))
}

/**
 * Adds `quantity` of an offer, merging with an existing line. `stock` is what the product page
 * knows; the server re-checks it anyway.
 */
export function addLine(cart: Cart, offerId: number, quantity = 1, stock = MAX_QUANTITY): [Cart, AddResult] {
  const limit = Math.min(MAX_QUANTITY, stock)
  if (limit < 1) return [cart, { ok: false, reason: 'out_of_stock' }]

  const existing = cart.find((line) => line.offerId === offerId)
  if (!existing) {
    if (cart.length >= MAX_LINES) return [cart, { ok: false, reason: 'cart_full' }]
    const added = clampQuantity(quantity, limit)
    return [[...cart, { offerId, quantity: added }], { ok: true, quantity: added, capped: added < quantity }]
  }

  if (existing.quantity >= limit) return [cart, { ok: false, reason: 'max_reached' }]
  const wanted = existing.quantity + quantity
  const next = clampQuantity(wanted, limit)
  return [
    cart.map((line) => (line.offerId === offerId ? { offerId, quantity: next } : line)),
    { ok: true, quantity: next, capped: next < wanted },
  ]
}

export function setLineQuantity(cart: Cart, offerId: number, quantity: number): Cart {
  return cart.map((line) => (line.offerId === offerId ? { offerId, quantity: clampQuantity(quantity) } : line))
}

export function removeLine(cart: Cart, offerId: number): Cart {
  return cart.filter((line) => line.offerId !== offerId)
}

/**
 * Applies the server's clamp: each line takes the quantity the quote says can be bought. Lines the
 * server can't sell at all (quantity 0) are kept, so the cart page can say why; the shopper
 * removes them.
 */
export function applyQuantities(cart: Cart, quantities: ReadonlyMap<number, number>): Cart {
  let changed = false
  const next = cart.map((line) => {
    const quantity = quantities.get(line.offerId)
    if (quantity === undefined || quantity < 1 || quantity === line.quantity) return line
    changed = true
    return { offerId: line.offerId, quantity: clampQuantity(quantity) }
  })
  return changed ? next : cart
}

export function itemCount(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0)
}

/**
 * Reads a stored cart leniently: anything that isn't a valid line is dropped, duplicates are
 * merged, quantities clamped and the line count capped. A corrupt value gives an empty cart.
 */
export function parseCart(raw: string | null): Cart {
  if (raw === null) return []
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(value)) return []

  let cart: Cart = []
  for (const item of value) {
    if (!isObject(item) || !isNumber(item.offerId) || !isNumber(item.quantity)) continue
    if (!Number.isInteger(item.offerId) || item.offerId < 1 || item.quantity < 1) continue
    cart = addLine(cart, item.offerId, item.quantity)[0]
  }
  return cart
}

// ── The store ──────────────────────────────────────────────────────────────────

let current: Cart = readStorage()
const listeners = new Set<() => void>()

function readStorage(): Cart {
  try {
    return parseCart(window.localStorage.getItem(STORAGE_KEY))
  } catch {
    // Storage blocked (private mode, a sandboxed iframe): start empty, keep the cart in memory.
    return []
  }
}

function commit(next: Cart): void {
  if (next === current) return
  current = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Full or blocked: the cart still works for this page session.
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

// Another tab changed the cart: pick it up here too.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return
    current = readStorage()
    listeners.forEach((listener) => listener())
  })
}

export const cartStore = {
  get: (): Cart => current,
  add(offerId: number, quantity = 1, stock = MAX_QUANTITY): AddResult {
    const [next, result] = addLine(current, offerId, quantity, stock)
    commit(next)
    return result
  },
  setQuantity: (offerId: number, quantity: number) => commit(setLineQuantity(current, offerId, quantity)),
  remove: (offerId: number) => commit(removeLine(current, offerId)),
  removeMany: (offerIds: ReadonlySet<number>) => commit(current.filter((line) => !offerIds.has(line.offerId))),
  applyQuantities: (quantities: ReadonlyMap<number, number>) => commit(applyQuantities(current, quantities)),
  clear: () => commit([]),
  /** Tests only: re-read storage, as a page load would. */
  reload(): void {
    current = readStorage()
    listeners.forEach((listener) => listener())
  },
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, cartStore.get, cartStore.get)
}
