import { Link } from 'react-router'
import { toSearchParams, type StoreParams } from './storeParams'

type Props = { params: StoreParams; lastPage: number }

/** Real links, so pages work with middle-click, reload and Back. */
export function Pagination({ params, lastPage }: Props) {
  if (lastPage <= 1) return null

  const current = Math.min(params.page, lastPage)
  const href = (page: number) => ({ search: `?${toSearchParams({ ...params, page }).toString()}` })
  const base = 'inline-flex h-10 min-w-10 items-center justify-center rounded-sm px-3 text-sm font-bold'

  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
      {current > 1 && (
        <Link to={href(current - 1)} className={`${base} border border-line-strong text-fg`}>
          Previous
        </Link>
      )}
      {pageWindow(current, lastPage).map((page, index) =>
        page === null ? (
          <span key={`gap-${index}`} className="px-1 text-fg-muted">
            …
          </span>
        ) : (
          <Link
            key={page}
            to={href(page)}
            aria-current={page === current ? 'page' : undefined}
            className={`${base} ${page === current ? 'bg-accent text-on-accent' : 'border border-line-strong text-fg'}`}
          >
            {page}
          </Link>
        ),
      )}
      {current < lastPage && (
        <Link to={href(current + 1)} className={`${base} border border-line-strong text-fg`}>
          Next
        </Link>
      )}
    </nav>
  )
}

/** 1 … 4 5 6 … 10: first, last and neighbours of the current page; null marks a gap. */
function pageWindow(current: number, last: number): (number | null)[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last))
  const sorted = [...pages].sort((a, b) => a - b)
  const out: (number | null)[] = []
  sorted.forEach((page, i) => {
    if (i > 0 && page - sorted[i - 1] > 1) out.push(null)
    out.push(page)
  })
  return out
}
