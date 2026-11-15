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

/**
 * Like Eneba's Store (docs/design/03): a sort icon and the current choice as plain text, not a boxed
 * field, so it doesn't compete with the filter panel. It stays a native <select> for the keyboard
 * and screen readers. The open list takes the `page` colour, because a transparent select would
 * leave the browser's white list under white text.
 */
export function SortSelect({ value, hasQuery, onChange }: Props) {
  const options = (Object.keys(LABELS) as Sort[]).filter((sort) => sort !== 'relevance' || hasQuery)

  return (
    <label className="flex items-center gap-1 text-sm text-fg">
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 fill-none stroke-current stroke-2">
        <path d="M7 4v16M3 16l4 4 4-4M14 6h7M14 12h5M14 18h3" />
      </svg>
      <span className="sr-only">Sort by</span>
      <select
        value={value}
        onChange={(event) => {
          const next = options.find((sort) => sort === event.target.value)
          if (next) onChange(next)
        }}
        className="h-10 cursor-pointer bg-transparent text-sm font-semibold text-fg hover:text-accent [&>option]:bg-page [&>option]:text-fg"
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
