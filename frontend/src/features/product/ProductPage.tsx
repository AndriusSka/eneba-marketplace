import { Link, useParams } from 'react-router'
import { ApiError } from '../../api/client'
import { useProduct, type ProductDetail } from '../../api/products'
import { PlatformPill, RegionLabel } from '../../components/Badge'
import { Button } from '../../components/Button'
import { CONTAINER } from '../../components/Layout'
import { MsrpDiscount, Price } from '../../components/Price'
import { Skeleton } from '../../components/Skeleton'
import { formatCents } from '../../lib/money'
import { NotFoundPage } from '../../pages/NotFoundPage'
import { OfferRow } from './OfferRow'

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

      <div className="flex flex-col gap-6 md:flex-row">
        <img
          src={product.cover_url}
          alt={`${product.title} cover`}
          className="aspect-3/4 w-full max-w-60 self-center rounded-sm object-cover md:self-start"
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

          <div className="rounded-sm bg-surface-raised p-4 md:max-w-sm">
            {product.from_price_cents === null ? (
              <p className="text-lg font-bold">Out of stock</p>
            ) : (
              <>
                <p className="flex items-center gap-2 text-xs">
                  From <MsrpDiscount msrpCents={product.msrp_cents} discountPercent={product.discount_percent} />
                </p>
                <Price cents={product.from_price_cents} size="price-lg" />
              </>
            )}
            <p className="mt-1 text-xs">
              {product.offers.length} {product.offers.length === 1 ? 'offer' : 'offers'} from sellers
            </p>
          </div>

          <p className="text-base whitespace-pre-line">{product.description}</p>
        </div>
      </div>

      <section aria-labelledby="offers-heading" className="mt-12">
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

function ProductSkeleton() {
  return (
    <main className={`${CONTAINER} py-6`} aria-busy="true">
      <Skeleton className="mb-4 h-4 w-40" />
      <div className="flex flex-col gap-6 md:flex-row">
        <Skeleton className="aspect-3/4 w-full max-w-60 self-center md:self-start" />
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-9 w-2/3" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-24 w-full md:max-w-sm" />
        </div>
      </div>
      <div className="mt-12 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </main>
  )
}
