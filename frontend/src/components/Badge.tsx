import type { Named } from '../api/products'

// DESIGN.md › Badges.

/** Eneba colours a region by whether the key works for the shopper; we assume GLOBAL and EU do. */
const REGIONS_THAT_WORK = new Set(['global', 'eu', 'europe'])

export function RegionLabel({ region }: { region: Named }) {
  const tone = REGIONS_THAT_WORK.has(region.slug) ? 'text-region-ok' : 'text-region-limited'
  return <span className={`text-xs font-bold uppercase ${tone}`}>{region.name}</span>
}

export function PlatformPill({ platform }: { platform: Named }) {
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong px-3 py-0.5 text-xs font-semibold text-fg">
      {platform.name}
    </span>
  )
}

export function DiscountBadge({ percent }: { percent: number }) {
  return <span className="text-xs font-bold text-discount">-{percent}%</span>
}

export function BestPricePill() {
  return (
    <span className="inline-flex items-center rounded-full border border-discount px-2 py-0.5 text-xs font-semibold text-discount">
      Best price
    </span>
  )
}

export function OutOfStockPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-line-strong px-2 py-0.5 text-xs text-fg-muted">
      Out of stock
    </span>
  )
}
