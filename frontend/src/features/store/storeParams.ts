// Store state <-> URL. The URL is the single source of truth for filters, sort and page
// (SPEC › Store), so reload, shared links and back/forward all restore the same view.
//
// Browser URL: ?q=elden&platform=steam&platform=xbox&region=eu&min_price=1000&max_price=5000&sort=price_asc&page=2
// API query:   the same names and units (cents), except lists use PHP's `platform[]` form.

export const SORTS = ['relevance', 'price_asc', 'price_desc', 'newest', 'bestselling'] as const
export type Sort = (typeof SORTS)[number]

export const MAX_PRICE_CENTS = 1_000_000
export const MAX_QUERY_LENGTH = 100
const MAX_PAGE = 1000
const MAX_SLUGS = 10
const SLUG = /^[a-z0-9-]{1,100}$/
const DIGITS = /^\d{1,7}$/

export type StoreParams = {
  q: string
  platforms: string[]
  regions: string[]
  minPrice: number | null
  maxPrice: number | null
  /** null = let the server pick (relevance with a query, best-selling without). */
  sort: Sort | null
  page: number
}

export const DEFAULT_STORE_PARAMS: StoreParams = {
  q: '',
  platforms: [],
  regions: [],
  minPrice: null,
  maxPrice: null,
  sort: null,
  page: 1,
}

/** Lenient: anything invalid is dropped, so a hand-edited URL never reaches the API as a 422. */
export function parseStoreParams(search: URLSearchParams): StoreParams {
  let minPrice = parsePrice(search.get('min_price'))
  let maxPrice = parsePrice(search.get('max_price'))
  if (minPrice !== null && maxPrice !== null && maxPrice < minPrice) {
    ;[minPrice, maxPrice] = [maxPrice, minPrice]
  }

  const sort = search.get('sort')
  const page = search.get('page')
  const pageNumber = page !== null && DIGITS.test(page) ? Number(page) : 1

  return {
    q: (search.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    platforms: parseSlugs(search.getAll('platform')),
    regions: parseSlugs(search.getAll('region')),
    minPrice,
    maxPrice,
    sort: isSort(sort) ? sort : null,
    page: pageNumber >= 1 && pageNumber <= MAX_PAGE ? pageNumber : 1,
  }
}

/** Canonical: defaults are omitted and lists sorted, so equal states give equal URLs. */
export function toSearchParams(params: StoreParams): URLSearchParams {
  return build(params, 'platform', 'region')
}

/** The query string for GET /api/products (no leading "?"). */
export function toApiQuery(params: StoreParams): string {
  return build(params, 'platform[]', 'region[]').toString()
}

/** The sort the server applies, for showing in the sort dropdown. */
export function effectiveSort(params: StoreParams): Sort {
  const sort = params.sort ?? (params.q !== '' ? 'relevance' : 'bestselling')
  return sort === 'relevance' && params.q === '' ? 'bestselling' : sort
}

export function hasActiveFilters(params: StoreParams): boolean {
  return (
    params.q !== '' ||
    params.platforms.length > 0 ||
    params.regions.length > 0 ||
    params.minPrice !== null ||
    params.maxPrice !== null
  )
}

function build(params: StoreParams, platformKey: string, regionKey: string): URLSearchParams {
  const out = new URLSearchParams()
  if (params.q !== '') out.set('q', params.q)
  for (const slug of [...params.platforms].sort()) out.append(platformKey, slug)
  for (const slug of [...params.regions].sort()) out.append(regionKey, slug)
  if (params.minPrice !== null) out.set('min_price', String(params.minPrice))
  if (params.maxPrice !== null) out.set('max_price', String(params.maxPrice))
  if (params.sort !== null) out.set('sort', params.sort)
  if (params.page > 1) out.set('page', String(params.page))
  return out
}

function isSort(value: string | null): value is Sort {
  return SORTS.some((sort) => sort === value)
}

function parsePrice(value: string | null): number | null {
  if (value === null || !DIGITS.test(value)) return null
  const cents = Number(value)
  return cents <= MAX_PRICE_CENTS ? cents : null
}

function parseSlugs(values: string[]): string[] {
  return [...new Set(values.filter((value) => SLUG.test(value)))].sort().slice(0, MAX_SLUGS)
}
