import { Link } from 'react-router'
import type { ProductSummary } from '../api/products'
import { RegionLabel } from './Badge'
import { MsrpDiscount, Price } from './Price'
import { Skeleton } from './Skeleton'

/** DESIGN.md › Product card. The whole card links to the product page. */
export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link
      to={`/product/${product.slug}`}
      className="group flex w-full flex-col overflow-hidden rounded-sm bg-surface-card outline-line-strong hover:outline"
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
        {/* DESIGN.md › Product card › Hover buttons: "View offers" only, since a card is a product,
            not an offer. It looks like a secondary button, but the whole card is already the link,
            so this is decoration (aria-hidden), not a second control. It sits over the cover, above
            the platform band, so showing it never changes the card's height. */}
        <span
          aria-hidden="true"
          className="absolute inset-x-3 bottom-9 hidden h-8 items-center justify-center rounded-sm border border-line-strong bg-surface-card text-sm font-bold text-fg group-hover:flex group-focus-visible:flex"
        >
          View offers
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
