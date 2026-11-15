import { useEffect, useState } from 'react'
import { useCartQuote, type CartQuote, type QuoteLine } from '../../api/cart'
import { cartStore, type Cart } from './cartStore'

export type ReducedLine = { offerId: number; title: string; quantity: number }

/**
 * The cart priced by the server, with the automatic clamp (SPEC.md › Checkout): when a quote says
 * fewer keys are left than the cart asks for, the stored quantity is lowered to match, and the
 * change is remembered so the page can say what happened.
 */
export function useSyncedQuote(cart: Cart) {
  const quote = useCartQuote(cart)
  // Only a quote for the current cart counts, never the previous one kept on screen meanwhile.
  const fresh = quote.isPlaceholderData ? undefined : quote.data

  // Remember what was lowered (React's "adjust state when a prop changes" pattern: no effect).
  const [seen, setSeen] = useState<CartQuote | undefined>(undefined)
  const [reduced, setReduced] = useState<ReducedLine[]>([])
  if (fresh !== undefined && fresh !== seen) {
    setSeen(fresh)
    const lowered = loweredLines(fresh)
    if (lowered.length > 0) {
      setReduced((previous) => [
        ...previous.filter((item) => !lowered.some((line) => line.offer_id === item.offerId)),
        ...lowered.map((line) => ({ offerId: line.offer_id, title: titleOf(line), quantity: line.quantity })),
      ])
    }
  }

  // The stored cart is an external system: bring it in line with the quote.
  useEffect(() => {
    if (fresh === undefined) return
    const lowered = loweredLines(fresh)
    if (lowered.length > 0) {
      cartStore.applyQuantities(new Map(lowered.map((line) => [line.offer_id, line.quantity])))
    }
  }, [fresh])

  return { quote, reduced }
}

function loweredLines(quote: CartQuote): QuoteLine[] {
  return quote.lines.filter((line) => line.warning === 'quantity_reduced' && line.quantity > 0)
}

export function titleOf(line: QuoteLine): string {
  if (!line.product) return 'An item that is no longer sold'
  return line.seller ? `${line.product.title} from ${line.seller.name}` : line.product.title
}
