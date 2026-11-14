import { formatCents } from '../lib/money'
import { DiscountBadge } from './Badge'

const SIZES = {
  price: 'text-price',
  'price-lg': 'text-price-lg',
} as const

export function Price({ cents, size = 'price' }: { cents: number; size?: keyof typeof SIZES }) {
  return <span className={`${SIZES[size]} font-bold text-fg`}>{formatCents(cents)}</span>
}

/** The struck-through MSRP and the discount, shown only when the price is below MSRP. */
export function MsrpDiscount({ msrpCents, discountPercent }: { msrpCents: number; discountPercent: number | null }) {
  if (discountPercent === null) return null
  return (
    <span className="inline-flex items-center gap-1.5">
      <s className="text-xs text-fg-muted">
        <span className="sr-only">Was </span>
        {formatCents(msrpCents)}
      </s>
      <DiscountBadge percent={discountPercent} />
    </span>
  )
}
