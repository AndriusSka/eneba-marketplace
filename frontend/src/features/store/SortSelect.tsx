import type { Sort } from './storeParams'

const LABELS: Record<Sort, string> = {
  relevance: 'Relevance',
  bestselling: 'Best-selling',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  newest: 'Newest',
}

type Props = {
  value: Sort
  /** Relevance only makes sense with a name filter. */
  hasQuery: boolean
  onChange: (sort: Sort) => void
}

export function SortSelect({ value, hasQuery, onChange }: Props) {
  const options = (Object.keys(LABELS) as Sort[]).filter((sort) => sort !== 'relevance' || hasQuery)

  return (
    <label className="flex items-center gap-2 text-sm text-fg-muted">
      Sort by
      <select
        value={value}
        onChange={(event) => {
          const next = options.find((sort) => sort === event.target.value)
          if (next) onChange(next)
        }}
        className="h-10 rounded-sm border border-line-strong bg-page px-3 text-sm font-semibold text-fg"
      >
        {options.map((sort) => (
          <option key={sort} value={sort}>
            {LABELS[sort]}
          </option>
        ))}
      </select>
    </label>
  )
}
