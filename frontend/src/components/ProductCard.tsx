import { useState } from 'react'
import { Link } from 'react-router'
import type { ProductSummary } from '../api/products'
import { AddedMessage } from '../features/cart/AddedMessage'
import { cartStore, type AddResult } from '../features/cart/cartStore'
import { RegionLabel } from './Badge'
import { Button } from './Button'
import { buttonClasses } from './buttonClasses'
import { MsrpDiscount, Price } from './Price'
import { Skeleton } from './Skeleton'

/**
 * DESIGN.md › Product card. The card links to the product page. On hover or keyboard focus, a panel
 * opens under it, like Eneba's: a primary "Add to cart" for the offer behind the shown price
 * (`from_offer_id`), and "View offers". The panel is absolutely positioned, so it covers whatever
 * is below instead of pushing the grid down.
 */
export function ProductCard({ product }: { product: ProductSummary }) {
  const [added, setAdded] = useState<AddResult | null>(null)
  const offerId = product.from_offer_id
  const href = `/product/${product.slug}`

  return (
    <div className="group relative flex w-full hover:z-10 focus-within:z-10" onMouseLeave={() => setAdded(null)}>
      <Link
        to={href}
        className="flex w-full flex-col overflow-hidden rounded-sm bg-surface-card outline-line-strong group-focus-within:outline group-hover:outline"
      >
        <div className="relative aspect-3/4">
          <img
            src={product.cover_url}
            alt=""
            loading="lazy"
            className={`h-full w-full object-cover ${product.in_stock ? '' : 'opacity-50'}`}
          />
          <span className="absolute inset-x-0 bottom-0 bg-scrim py-1 text-center text-xs font-semibold text-fg">
            {product.platform.name}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-1 p-3">
          <h3 className="line-clamp-2 text-sm font-semibold text-fg">{product.title}</h3>
          <RegionLabel region={product.region} />

          <div className="mt-auto pt-2">
            {product.from_price_cents === null ? (
              <p className="text-sm text-fg-muted">Out of stock</p>
            ) : (
              <>
                <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-fg-muted">
                  From <MsrpDiscount msrpCents={product.msrp_cents} discountPercent={product.discount_percent} />
                </p>
                <Price cents={product.from_price_cents} />
              </>
            )}
          </div>
        </div>
      </Link>

      {/* -inset-x-px with a 1px side border lines the panel up with the card's 1px outline, which is
          drawn just outside the card. The panel's top edge covers the outline's bottom line, so card
          and panel read as one box. */}
      <div className="absolute -inset-x-px top-full hidden flex-col gap-2 rounded-b-sm border-x border-b border-line-strong bg-surface-card px-3 pb-3 group-focus-within:flex group-hover:flex">
        {offerId !== null && (
          <Button size="sm" className="w-full" onClick={() => setAdded(cartStore.add(offerId))}>
            Add to cart
          </Button>
        )}
        {/* The card itself is already this link for keyboards and screen readers. */}
        <Link to={href} tabIndex={-1} aria-hidden="true" className={buttonClasses('secondary', 'sm', 'w-full')}>
          View offers
        </Link>
        <p aria-live="polite" className="text-xs empty:hidden">
          {added && <AddedMessage result={added} />}
        </p>
      </div>
    </div>
  )
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-sm bg-surface-card">
      <Skeleton className="aspect-3/4 rounded-none" />
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="mt-2 h-6 w-1/2" />
      </div>
    </div>
  )
}
