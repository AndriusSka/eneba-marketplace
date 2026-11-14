import type { Offer } from '../../api/products'
import { BestPricePill } from '../../components/Badge'
import { Button } from '../../components/Button'
import { MsrpDiscount, Price } from '../../components/Price'

type Props = {
  offer: Offer
  msrpCents: number
  best?: boolean
}

/** DESIGN.md › Offer row. Out-of-stock offers stay visible but can't be added. */
export function OfferRow({ offer, msrpCents, best = false }: Props) {
  const soldOut = !offer.in_stock

  return (
    <li
      data-testid="offer-row"
      className={`flex flex-col gap-4 rounded-sm bg-surface px-6 py-4 sm:flex-row sm:items-center sm:justify-between ${soldOut ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-raised text-sm font-bold"
        >
          {initials(offer.seller.name)}
        </span>
        <div>
          <p className="text-base font-semibold">{offer.seller.name}</p>
          <p className="flex items-center gap-1 text-xs">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 fill-accent">
              <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
            </svg>
            <span className="font-bold">{offer.seller.rating.toFixed(1)}</span>
            <span className="text-fg-muted">seller rating</span>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-6 sm:justify-end">
        <div className="flex flex-col items-start gap-0.5 sm:items-end">
          {best && <BestPricePill />}
          <MsrpDiscount msrpCents={msrpCents} discountPercent={offer.discount_percent} />
          <Price cents={offer.price_cents} />
          <span className="text-xs text-fg-muted">{soldOut ? 'No keys left' : `${offer.stock} in stock`}</span>
        </div>
        {/* Wired to the cart in M6. */}
        <Button variant="secondary" disabled={soldOut}>
          {soldOut ? 'Out of stock' : 'Add to cart'}
        </Button>
      </div>
    </li>
  )
}

/** "PixelVault" → "PI", "Key Hub" → "KH" (we have no seller images). */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.trim().slice(0, 2)
  return letters.toUpperCase()
}
