import type { ProductSummary } from '../../api/products'
import { formatCents } from '../../lib/money'

/** DESIGN.md › Header with search › Dropdown: cover, title, platform · region, "From" price. */
export function SuggestionRow({ product }: { product: ProductSummary }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <img
        src={product.cover_url}
        alt=""
        className={`h-14 w-10 shrink-0 rounded-sm object-cover ${product.in_stock ? '' : 'opacity-50'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold text-fg">{product.title}</p>
        <p className="text-xs text-fg-muted">
          {product.platform.name} · {product.region.name}
        </p>
      </div>
      <div className="shrink-0 text-right">
        {product.from_price_cents === null ? (
          <p className="text-xs text-fg-muted">Out of stock</p>
        ) : (
          <>
            <p className="text-xs text-fg-muted">From</p>
            <p className="text-sm font-bold text-fg">{formatCents(product.from_price_cents)}</p>
          </>
        )}
      </div>
    </div>
  )
}
