import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addLine,
  applyQuantities,
  cartStore,
  itemCount,
  MAX_LINES,
  parseCart,
  removeLine,
  setLineQuantity,
  STORAGE_KEY,
  useCart,
  type Cart,
} from './cartStore'

beforeEach(() => {
  localStorage.clear()
  cartStore.reload()
})
afterEach(() => {
  vi.restoreAllMocks()
})

describe('pure operations', () => {
  it('adds a new line', () => {
    const [cart, result] = addLine([], 5)
    expect(cart).toEqual([{ offerId: 5, quantity: 1 }])
    expect(result).toEqual({ ok: true, quantity: 1, capped: false })
  })

  it('merges the same offer into one line', () => {
    const [cart, result] = addLine([{ offerId: 5, quantity: 2 }], 5, 3)
    expect(cart).toEqual([{ offerId: 5, quantity: 5 }])
    expect(result).toEqual({ ok: true, quantity: 5, capped: false })
  })

  it('caps a line at 10 keys', () => {
    expect(addLine([{ offerId: 5, quantity: 9 }], 5, 3)).toEqual([
      [{ offerId: 5, quantity: 10 }],
      { ok: true, quantity: 10, capped: true },
    ])
    expect(addLine([{ offerId: 5, quantity: 10 }], 5)[1]).toEqual({ ok: false, reason: 'max_reached' })
  })

  it('caps a line at the stock the product page knows', () => {
    expect(addLine([], 5, 4, 2)).toEqual([[{ offerId: 5, quantity: 2 }], { ok: true, quantity: 2, capped: true }])
    expect(addLine([{ offerId: 5, quantity: 2 }], 5, 1, 2)[1]).toEqual({ ok: false, reason: 'max_reached' })
    expect(addLine([], 5, 1, 0)[1]).toEqual({ ok: false, reason: 'out_of_stock' })
  })

  it('refuses a 21st line but still merges into an existing one', () => {
    const full: Cart = Array.from({ length: MAX_LINES }, (_, i) => ({ offerId: i + 1, quantity: 1 }))
    expect(addLine(full, 99)).toEqual([full, { ok: false, reason: 'cart_full' }])
    expect(addLine(full, 1)[1]).toEqual({ ok: true, quantity: 2, capped: false })
  })

  it('sets a quantity within 1–10 and removes a line', () => {
    const cart: Cart = [
      { offerId: 1, quantity: 1 },
      { offerId: 2, quantity: 3 },
    ]
    expect(setLineQuantity(cart, 2, 0)).toEqual([cart[0], { offerId: 2, quantity: 1 }])
    expect(setLineQuantity(cart, 2, 50)).toEqual([cart[0], { offerId: 2, quantity: 10 }])
    expect(removeLine(cart, 1)).toEqual([{ offerId: 2, quantity: 3 }])
    expect(itemCount(cart)).toBe(4)
  })

  it('applies the server quantities, keeping unbuyable lines and the same object when nothing changes', () => {
    const cart: Cart = [
      { offerId: 1, quantity: 5 },
      { offerId: 2, quantity: 1 },
    ]
    expect(applyQuantities(cart, new Map([[1, 2]]))).toEqual([{ offerId: 1, quantity: 2 }, cart[1]])
    expect(applyQuantities(cart, new Map([[2, 0]]))).toBe(cart)
    expect(applyQuantities(cart, new Map([[1, 5]]))).toBe(cart)
  })

  it('parses a stored cart leniently', () => {
    expect(parseCart(null)).toEqual([])
    expect(parseCart('not json')).toEqual([])
    expect(parseCart('{"offerId":1}')).toEqual([])
    expect(
      parseCart(
        JSON.stringify([
          { offerId: 1, quantity: 2 },
          { offerId: 1, quantity: 3 }, // duplicate: merged
          { offerId: 2, quantity: 40 }, // clamped to 10
          { offerId: '3', quantity: 1 }, // wrong type
          { offerId: 4, quantity: 0 }, // not a quantity
          { offerId: -1, quantity: 1 },
          { offerId: 5.5, quantity: 1 },
          { offerId: 6, quantity: 1, price_cents: 1 }, // extra fields are not kept
          null,
        ]),
      ),
    ).toEqual([
      { offerId: 1, quantity: 5 },
      { offerId: 2, quantity: 10 },
      { offerId: 6, quantity: 1 },
    ])
  })
})

describe('the store', () => {
  it('persists ids and quantities only, and survives a reload', () => {
    cartStore.add(7, 2)
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toEqual([{ offerId: 7, quantity: 2 }])

    cartStore.reload()
    expect(cartStore.get()).toEqual([{ offerId: 7, quantity: 2 }])

    cartStore.clear()
    expect(localStorage.getItem(STORAGE_KEY)).toBe('[]')
  })

  it('keeps working in memory when storage refuses writes', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })

    expect(cartStore.add(7)).toEqual({ ok: true, quantity: 1, capped: false })
    expect(cartStore.get()).toEqual([{ offerId: 7, quantity: 1 }])
  })

  it('starts empty when storage can not be read', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([{ offerId: 1, quantity: 1 }]))
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Blocked', 'SecurityError')
    })

    cartStore.reload()
    expect(cartStore.get()).toEqual([])
  })

  it('re-renders subscribers, and picks up a change made in another tab', () => {
    const { result } = renderHook(() => useCart())
    expect(result.current).toEqual([])

    act(() => {
      cartStore.add(3)
    })
    expect(result.current).toEqual([{ offerId: 3, quantity: 1 }])

    act(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([{ offerId: 9, quantity: 4 }]))
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }))
    })
    expect(result.current).toEqual([{ offerId: 9, quantity: 4 }])
  })
})
