import { Link, useLocation, useNavigate } from 'react-router'
import { blocksCheckout, type CartQuote, type QuoteLine } from '../../api/cart'
import { isObject, isString } from '../../api/guards'
import { PlatformPill, RegionLabel } from '../../components/Badge'
import { Button } from '../../components/Button'
import { buttonClasses } from '../../components/buttonClasses'
import { CONTAINER } from '../../components/Layout'
import { Price } from '../../components/Price'
import { Skeleton } from '../../components/Skeleton'
import { formatCents } from '../../lib/money'
import { CheckoutSteps } from '../checkout/CheckoutSteps'
import { cartStore, itemCount, MAX_QUANTITY, useCart, type CartLine } from './cartStore'
import { QuantityStepper } from './QuantityStepper'
import { useSyncedQuote, type ReducedLine } from './useSyncedQuote'

const WARNING_TEXT = {
  out_of_stock: 'Out of stock. Remove it to continue.',
  inactive: 'No longer sold by this seller. Remove it to continue.',
  unavailable: 'This offer no longer exists. Remove it to continue.',
} as const

/** `/cart`: the browser cart with server prices (SPEC.md › Checkout). Anyone can use it. */
export function CartPage() {
  const cart = useCart()
  const { quote, reduced } = useSyncedQuote(cart)
  const notice = noticeFrom(useLocation().state)

  return (
    <main className={`${CONTAINER} py-6`}>
      <title>Cart | Market</title>
      <CheckoutSteps active="cart" />

      {notice && (
        <p role="alert" className="mb-4 rounded-sm border border-danger bg-surface-panel p-4 text-sm">
          {notice}
        </p>
      )}
      <ReducedNotice reduced={reduced} />

      {cart.length === 0 ? (
        <EmptyCart />
      ) : quote.isError ? (
        <div role="alert" className="rounded-sm bg-surface-panel p-6 text-center">
          <p className="text-base">We couldn’t load current prices for your cart.</p>
          <p className="mt-1 text-sm text-fg-muted">Your items are still saved.</p>
          <Button className="mt-4" onClick={() => void quote.refetch()}>
            Try again
          </Button>
        </div>
      ) : !quote.data ? (
        <CartSkeleton lines={cart.length} />
      ) : (
        <CartView cart={cart} quote={quote.data} updating={quote.isPlaceholderData || quote.isFetching} />
      )}
    </main>
  )
}

function CartView({ cart, quote, updating }: { cart: readonly CartLine[]; quote: CartQuote; updating: boolean }) {
  const navigate = useNavigate()
  const byOffer = new Map(quote.lines.map((line) => [line.offer_id, line]))
  const blocked = quote.lines.filter((line) => cart.some((item) => item.offerId === line.offer_id) && blocksCheckout(line))
  const count = itemCount(cart)

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <section aria-labelledby="cart-heading" className="flex-1 rounded-sm bg-surface-panel p-4 md:p-6">
        <h1 id="cart-heading" className="mb-4 text-lg font-bold">
          My cart
        </h1>
        <ul className="flex flex-col gap-3">
          {cart.map((item) => {
            const line = byOffer.get(item.offerId)
            return line ? (
              <CartLineRow key={item.offerId} item={item} line={line} />
            ) : (
              <li key={item.offerId}>
                <Skeleton className="h-24 w-full" />
              </li>
            )
          })}
        </ul>
      </section>

      <aside aria-labelledby="summary-heading" className="rounded-sm bg-surface-panel p-4 md:p-6 lg:w-80">
        <h2 id="summary-heading" className="mb-4 text-lg font-bold">
          Summary
        </h2>
        <p className="text-sm">
          {count} {count === 1 ? 'item' : 'items'}
        </p>
        <p className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
          <span className="text-base font-bold">Total</span>
          <span aria-busy={updating || undefined}>
            <Price cents={quote.total_cents} size="price-lg" />
          </span>
        </p>

        {blocked.length > 0 && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-sm text-danger">
              {blocked.length === 1 ? 'One item' : `${blocked.length} items`} can’t be bought right now.
            </p>
            <Button
              variant="secondary"
              onClick={() => cartStore.removeMany(new Set(blocked.map((line) => line.offer_id)))}
            >
              Remove unavailable items
            </Button>
          </div>
        )}

        <Button
          className="mt-4 w-full"
          disabled={!quote.checkout_ready || blocked.length > 0 || updating}
          onClick={() => navigate('/checkout')}
        >
          Checkout
        </Button>
        <p className="mt-2 text-xs text-fg-muted">Prices are checked again when you pay.</p>
      </aside>
    </div>
  )
}

function CartLineRow({ item, line }: { item: CartLine; line: QuoteLine }) {
  const title = line.product?.title ?? 'Unavailable item'
  const max = Math.max(1, Math.min(MAX_QUANTITY, line.stock))

  return (
    <li data-testid="cart-line" className="flex gap-4 rounded-sm bg-surface-inset p-3 md:p-4">
      {line.product ? (
        <img src={line.product.cover_url} alt="" className="aspect-3/4 w-16 shrink-0 rounded-sm object-cover" />
      ) : (
        <span aria-hidden="true" className="aspect-3/4 w-16 shrink-0 rounded-sm bg-surface" />
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {line.seller && <p className="text-xs text-fg-muted">Sold by {line.seller.name}</p>}
            {line.product ? (
              <Link to={`/product/${line.product.slug}`} className="text-sm font-bold hover:text-accent">
                {title}
              </Link>
            ) : (
              <p className="text-sm font-bold">{title}</p>
            )}
            {line.product && (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <PlatformPill platform={line.product.platform} />
                <RegionLabel region={line.product.region} />
              </div>
            )}
          </div>
          <button
            type="button"
            aria-label={`Remove ${title} from the cart`}
            onClick={() => cartStore.remove(item.offerId)}
            className="flex size-8 shrink-0 items-center justify-center rounded-sm text-fg hover:bg-surface-raised"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
              <path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {line.warning !== null && line.warning !== 'quantity_reduced' ? (
          <p className="text-sm text-danger">{WARNING_TEXT[line.warning]}</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <QuantityStepper
              value={item.quantity}
              max={max}
              label={title}
              onChange={(quantity) => cartStore.setQuantity(item.offerId, quantity)}
            />
            <div className="text-right">
              {line.unit_price_cents !== null && item.quantity > 1 && (
                <p className="text-xs text-fg-muted">
                  {item.quantity} × {formatCents(line.unit_price_cents)}
                </p>
              )}
              <p className="text-base font-bold">{formatCents(line.line_total_cents)}</p>
              {line.stock <= 3 && <p className="text-xs text-fg-muted">Only {line.stock} left</p>}
            </div>
          </div>
        )}
      </div>
    </li>
  )
}

function ReducedNotice({ reduced }: { reduced: ReducedLine[] }) {
  if (reduced.length === 0) return null
  return (
    <div role="status" className="mb-4 rounded-sm bg-surface-panel p-4 text-sm">
      <p className="font-semibold">Some quantities were lowered to what is in stock:</p>
      <ul className="mt-1 list-disc pl-5">
        {reduced.map((item) => (
          <li key={item.offerId}>
            {item.title}: {item.quantity} {item.quantity === 1 ? 'key' : 'keys'} left
          </li>
        ))}
      </ul>
    </div>
  )
}

function EmptyCart() {
  return (
    <div className="rounded-sm bg-surface-panel p-8 text-center">
      <h1 className="text-lg font-bold">Your cart is empty</h1>
      <p className="mt-2 text-base text-fg-muted">Find a game and add an offer to your cart.</p>
      <Link to="/store" className={buttonClasses('primary', 'md', 'mt-6')}>
        Browse the store
      </Link>
    </div>
  )
}

function CartSkeleton({ lines }: { lines: number }) {
  return (
    <div aria-busy="true" className="flex flex-col gap-6 lg:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        {Array.from({ length: Math.min(lines, 5) }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-48 lg:w-80" />
    </div>
  )
}

/** A message passed by the checkout page after a 409 (navigation state, so it never sticks in the URL). */
function noticeFrom(state: unknown): string | null {
  return isObject(state) && isString(state.notice) ? state.notice : null
}
