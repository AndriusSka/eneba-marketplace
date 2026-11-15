import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useProduct, type Offer, type ProductDetail } from '../../api/products'
import { PlatformPill, RegionLabel } from '../../components/Badge'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'
import { MsrpDiscount, Price } from '../../components/Price'
import { Skeleton } from '../../components/Skeleton'
import { formatCents } from '../../lib/money'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { cartStore, type AddResult } from '../cart/cartStore'
import { AddedMessage, OfferRow } from './OfferRow'

const releaseFormat = new Intl.DateTimeFormat('en-IE', { dateStyle: 'long', timeZone: 'UTC' })

export function ProductPage() {
  const { slug = '' } = useParams()
  const { data: product, isPending, error, refetch } = useProduct(slug)

  if (isPending) return <ProductSkeleton />

  if (error) {
    if (error instanceof ApiError && error.status === 404) return <NotFoundPage />
    return (
      <main className={`${CONTAINER} py-12`}>
        <div role="alert" className="rounded-sm bg-surface p-6 text-center">
          <p className="text-base">The product couldn’t be loaded.</p>
          <Button className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </main>
    )
  }

  return <ProductView product={product} />
}

function ProductView({ product }: { product: ProductDetail }) {
  // The API orders offers in stock first, then by price, so the first one is the best if it has stock.
  const [first, ...rest] = product.offers
  const best = first?.in_stock ? first : undefined
  const others = best ? rest : product.offers

  return (
    <main className={`${CONTAINER} py-6`}>
      <title>{`${product.title} | Market`}</title>

      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-fg-muted">
        <Link to="/store" className="hover:text-fg">
          Store
        </Link>
        <span aria-hidden="true"> / </span>
        <span className="text-fg">{product.title}</span>
      </nav>

      {/* Like Eneba's product page (docs/design/05): cover | details | buy box from lg. At md the buy
          box wraps onto its own row, and on phones everything stacks. */}
      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap lg:flex-nowrap">
        <img
          src={product.cover_url}
          alt={`${product.title} cover`}
          className="aspect-3/4 w-full max-w-60 shrink-0 self-center rounded-sm object-cover md:self-start"
        />

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <h1 className="text-h2 font-bold">{product.title}</h1>
          <div className="flex flex-wrap items-center gap-3">
            <PlatformPill platform={product.platform} />
            <RegionLabel region={product.region} />
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-fg-muted">Release date</dt>
            <dd>{product.release_date === null ? '—' : releaseFormat.format(new Date(product.release_date))}</dd>
            <dt className="text-fg-muted">MSRP</dt>
            <dd>{formatCents(product.msrp_cents)}</dd>
          </dl>

          <p className="text-base whitespace-pre-line">{product.description}</p>
        </div>

        <BuyBox product={product} best={best} />
      </div>

      <section id="offers" aria-labelledby="offers-heading" className="mt-12 scroll-mt-6">
        <h2 id="offers-heading" className="sr-only">
          Offers
        </h2>

        {product.offers.length === 0 && <p className="text-base text-fg-muted">No sellers offer this product right now.</p>}

        {best && (
          <>
            <h3 className="mb-3 text-lg font-bold">Best offer</h3>
            <ul className="flex flex-col gap-3">
              <OfferRow offer={best} msrpCents={product.msrp_cents} best />
            </ul>
          </>
        )}

        {others.length > 0 && (
          <>
            <h3 className={`mb-3 text-lg font-bold ${best ? 'mt-8' : ''}`}>
              {best ? `Other offers (${others.length})` : `Offers (${others.length})`}
            </h3>
            <ul className="flex flex-col gap-3">
              {others.map((offer) => (
                <OfferRow key={offer.id} offer={offer} msrpCents={product.msrp_cents} />
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  )
}

/**
 * The buy box (DESIGN.md › surface-raised "product buy box"): the best offer's price and a primary
 * button that adds that offer, the same action as "Add to cart" on the Best offer row below.
 * With nothing in stock it says so and has no button.
 */
function BuyBox({ product, best }: { product: ProductDetail; best: Offer | undefined }) {
  const [added, setAdded] = useState<AddResult | null>(null)
  const count = product.offers.length

  return (
    <aside
      aria-label="Best price"
      className="flex flex-col gap-3 rounded-sm bg-surface-raised p-4 md:basis-full lg:w-72 lg:shrink-0 lg:basis-auto lg:self-start"
    >
      {best ? (
        <>
          <div className="flex flex-col items-start gap-0.5">
            <MsrpDiscount msrpCents={product.msrp_cents} discountPercent={best.discount_percent} />
            <Price cents={best.price_cents} size="price-lg" />
            <p className="text-xs">
              Sold by <span className="font-semibold">{best.seller.name}</span>
            </p>
          </div>
          <Button className="w-full" onClick={() => setAdded(cartStore.add(best.id, 1, best.stock))}>
            Add to cart
          </Button>
          <p aria-live="polite" className="min-h-4 text-xs">
            {added && <AddedMessage result={added} />}
          </p>
        </>
      ) : (
        <p className="text-lg font-bold">Out of stock</p>
      )}

      {count > 0 && (
        <button
          type="button"
          className="border-t border-line pt-3 text-sm font-semibold text-accent hover:text-accent-hover"
          onClick={() => document.getElementById('offers')?.scrollIntoView({ behavior: 'smooth' })}
        >
          {count === 1 ? 'See the offer' : `Compare ${count} offers`}
        </button>
      )}
    </aside>
  )
}

function ProductSkeleton() {
  return (
    <main className={`${CONTAINER} py-6`} aria-busy="true">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="flex flex-col gap-6 md:flex-row md:flex-wrap lg:flex-nowrap">
        <Skeleton className="aspect-3/4 w-full max-w-60 self-center md:self-start" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-48 w-full lg:w-72 lg:shrink-0" />
      </div>
      <div className="mt-12 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </main>
  )
}
