import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { useProducts } from '../../api/products'
import { Button } from '../../components/Button'
import { buttonClasses } from '../../components/buttonClasses'
import { CONTAINER } from '../../components/Layout'
import { ProductCard, ProductCardSkeleton } from '../../components/ProductCard'
import { FilterSidebar } from './FilterSidebar'
import { Pagination } from './Pagination'
import { SortSelect } from './SortSelect'
import { effectiveSort, hasActiveFilters, MAX_QUERY_LENGTH, toApiQuery, toSearchParams } from './storeParams'
import { useStoreParams } from './useStoreParams'

const SKELETON_CARDS = 12

export function StorePage() {
  const { params, update, clear } = useStoreParams()
  const { data, isPending, isError, isPlaceholderData, refetch } = useProducts(toApiQuery(params))
  const [drawerOpen, setDrawerOpen] = useState(false)

  useScrollToTopOnPageChange(params.page)

  useEffect(() => {
    if (!drawerOpen) return
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawerOpen])

  function submitName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = new FormData(event.currentTarget).get('q')
    update({ q: typeof value === 'string' ? value.trim() : '' })
  }

  return (
    <main className={`${CONTAINER} py-6`}>
      <title>Store | KeyMarket</title>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <h1 className="text-h1 font-bold">{params.q === '' ? 'Store' : `Results for “${params.q}”`}</h1>

        {/* Name filter. The header search box (M3) will open /store?q=… too. */}
        <form role="search" onSubmit={submitName} className="flex w-full gap-2 md:max-w-sm">
          <label htmlFor="store-q" className="sr-only">
            Filter by name
          </label>
          <input
            // Remount when the URL changes (Back, Clear filters) so the box shows the restored query.
            key={params.q}
            id="store-q"
            name="q"
            type="search"
            defaultValue={params.q}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Filter by name"
            className="h-10 min-w-0 flex-1 rounded-sm border border-line-strong bg-transparent px-3 text-sm text-fg placeholder:text-fg-muted focus:bg-field-focus"
          />
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      <div className="mt-6 flex gap-6">
        {drawerOpen && (
          <div aria-hidden="true" className="fixed inset-0 z-30 bg-scrim lg:hidden" onClick={() => setDrawerOpen(false)} />
        )}
        <aside
          id="store-filters"
          aria-label="Filters"
          className={`${drawerOpen ? 'fixed inset-y-0 left-0 z-40 flex w-72' : 'hidden'} flex-col overflow-y-auto bg-surface-raised lg:static lg:z-auto lg:flex lg:w-50 lg:shrink-0 lg:self-start lg:overflow-visible lg:rounded-sm`}
        >
          <div className="flex items-center justify-between border-b border-line p-4 lg:hidden">
            <span className="text-lg font-bold">Filters</span>
            <Button variant="icon" aria-label="Close filters" onClick={() => setDrawerOpen(false)}>
              <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </Button>
          </div>
          <FilterSidebar params={params} facets={data?.facets} onChange={update} />
        </aside>

        <section aria-label="Products" className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                className="lg:hidden"
                aria-controls="store-filters"
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen(true)}
              >
                Filters
              </Button>
              <p className="text-sm text-fg-muted" aria-live="polite">
                {data ? `${data.meta.total} ${data.meta.total === 1 ? 'result' : 'results'}` : ''}
              </p>
            </div>
            <SortSelect value={effectiveSort(params)} hasQuery={params.q !== ''} onChange={(sort) => update({ sort })} />
          </div>

          {isPending ? (
            <Grid busy>
              {Array.from({ length: SKELETON_CARDS }, (_, i) => (
                <li key={i}>
                  <ProductCardSkeleton />
                </li>
              ))}
            </Grid>
          ) : isError && !data ? (
            <div role="alert" className="rounded-sm bg-surface p-6 text-center">
              <p className="text-base">The products couldn’t be loaded.</p>
              <Button className="mt-4" onClick={() => void refetch()}>
                Try again
              </Button>
            </div>
          ) : data.meta.total === 0 ? (
            <div className="rounded-sm bg-surface p-6 text-center">
              <p className="text-base">
                {params.q === '' ? 'No products match your filters.' : `No results for “${params.q}”.`}
              </p>
              {hasActiveFilters(params) && (
                <Button className="mt-4" onClick={clear}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : data.data.length === 0 ? (
            <div className="rounded-sm bg-surface p-6 text-center">
              <p className="text-base">There are no products on page {params.page}.</p>
              <Link
                to={{ search: `?${toSearchParams({ ...params, page: 1 }).toString()}` }}
                className={buttonClasses('primary', 'md', 'mt-4')}
              >
                Go to the first page
              </Link>
            </div>
          ) : (
            <>
              <Grid busy={isPlaceholderData}>
                {data.data.map((product) => (
                  <li key={product.id} className="flex">
                    <ProductCard product={product} />
                  </li>
                ))}
              </Grid>
              <Pagination params={params} lastPage={data.meta.last_page} />
            </>
          )}
        </section>
      </div>
    </main>
  )
}

function Grid({ busy, children }: { busy: boolean; children: ReactNode }) {
  return (
    <ul
      aria-busy={busy}
      className={`grid grid-cols-2 gap-4 transition-opacity sm:grid-cols-3 xl:grid-cols-4 *:min-w-0 ${busy ? 'opacity-60' : ''}`}
    >
      {children}
    </ul>
  )
}

/** Paging lands at the top of the grid; filter changes and Back keep the scroll position. */
function useScrollToTopOnPageChange(page: number) {
  const previous = useRef(page)
  useEffect(() => {
    if (previous.current !== page) {
      previous.current = page
      window.scrollTo({ top: 0 })
    }
  }, [page])
}
