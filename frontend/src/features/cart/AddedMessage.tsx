import { Link } from 'react-router'
import { MAX_LINES, type AddResult } from './cartStore'

/** What happened after "Add to cart": shared by product cards, offer rows and the buy box. */
export function AddedMessage({ result }: { result: AddResult }) {
  if (!result.ok) {
    const message = {
      cart_full: `Your cart is full (${MAX_LINES} items).`,
      max_reached: 'You already have the most you can buy in your cart.',
      out_of_stock: 'Out of stock.',
    }[result.reason]
    return <span className="text-danger">{message}</span>
  }
  return (
    <span className="text-teal">
      {result.quantity === 1 ? 'Added' : `${result.quantity} in cart`} ·{' '}
      <Link to="/cart" className="font-semibold text-fg underline hover:text-accent">
        View cart
      </Link>
    </span>
  )
}
