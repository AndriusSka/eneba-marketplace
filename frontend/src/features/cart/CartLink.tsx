import { Link } from 'react-router'
import { itemCount, useCart } from './cartStore'

/** DESIGN.md › Header: the cart icon with a `danger` count dot. */
export function CartLink() {
  const count = itemCount(useCart())
  const label = count === 0 ? 'Cart, empty' : `Cart, ${count} ${count === 1 ? 'item' : 'items'}`

  return (
    <Link to="/cart" aria-label={label} className="relative inline-flex size-10 items-center justify-center text-fg hover:text-accent">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
        <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.76L21 8H6.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="9.5" cy="20" r="1.25" />
        <circle cx="17.5" cy="20" r="1.25" />
      </svg>
      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0 right-0 flex min-w-5 items-center justify-center rounded-full bg-danger px-1 text-xs font-bold text-fg"
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
