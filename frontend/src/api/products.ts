import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ApiError, getJson } from './client'
import { isArrayOf, isNullable, isNumber, isObject, isString } from './guards'

// Shapes of GET /api/products and GET /api/products/{slug} (docs/ARCHITECTURE.md › Store API).

export type Named = { slug: string; name: string }

export type ProductSummary = {
  id: number
  slug: string
  title: string
  cover_url: string
  platform: Named
  region: Named
  release_date: string | null
  msrp_cents: number
  currency: string
  /** Lowest price among active offers with stock; null when out of stock. */
  from_price_cents: number | null
  discount_percent: number | null
  in_stock: boolean
}

export type FacetOption = Named & { count: number }

export type ProductList = {
  data: ProductSummary[]
  meta: { page: number; per_page: number; total: number; last_page: number }
  facets: {
    platforms: FacetOption[]
    regions: FacetOption[]
    price: { min_cents: number | null; max_cents: number | null }
  }
}

export type Offer = {
  id: number
  seller: { id: number; name: string; rating: number }
  price_cents: number
  currency: string
  discount_percent: number | null
  stock: number
  in_stock: boolean
}

export type ProductDetail = ProductSummary & {
  description: string
  offers: Offer[]
}

const isNullableNumber = isNullable(isNumber)
const isNullableString = isNullable(isString)

function isNamed(value: unknown): value is Named {
  return isObject(value) && isString(value.slug) && isString(value.name)
}

function isFacetOption(value: unknown): value is FacetOption {
  // Check the plain-object fields before isNamed() narrows the type away from JsonObject.
  return isObject(value) && isNumber(value.count) && isNamed(value)
}

export function isProductSummary(value: unknown): value is ProductSummary {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isString(value.slug) &&
    isString(value.title) &&
    isString(value.cover_url) &&
    isNamed(value.platform) &&
    isNamed(value.region) &&
    isNullableString(value.release_date) &&
    isNumber(value.msrp_cents) &&
    isString(value.currency) &&
    isNullableNumber(value.from_price_cents) &&
    isNullableNumber(value.discount_percent) &&
    typeof value.in_stock === 'boolean'
  )
}

export function isProductList(value: unknown): value is ProductList {
  if (!isObject(value) || !isObject(value.meta) || !isObject(value.facets)) return false
  const { meta, facets } = value
  return (
    isArrayOf(value.data, isProductSummary) &&
    isNumber(meta.page) &&
    isNumber(meta.per_page) &&
    isNumber(meta.total) &&
    isNumber(meta.last_page) &&
    isArrayOf(facets.platforms, isFacetOption) &&
    isArrayOf(facets.regions, isFacetOption) &&
    isObject(facets.price) &&
    isNullableNumber(facets.price.min_cents) &&
    isNullableNumber(facets.price.max_cents)
  )
}

function isOffer(value: unknown): value is Offer {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isObject(value.seller) &&
    isNumber(value.seller.id) &&
    isString(value.seller.name) &&
    isNumber(value.seller.rating) &&
    isNumber(value.price_cents) &&
    isString(value.currency) &&
    isNullableNumber(value.discount_percent) &&
    isNumber(value.stock) &&
    typeof value.in_stock === 'boolean'
  )
}

export function isProductDetail(value: unknown): value is ProductDetail {
  return (
    isObject(value) &&
    isString(value.description) &&
    isArrayOf(value.offers, isOffer) &&
    isProductSummary(value)
  )
}

/** @param apiQuery a query string from `toApiQuery()`, without the leading "?" */
export async function fetchProducts(apiQuery: string, signal?: AbortSignal): Promise<ProductList> {
  const body = await getJson(`/api/products${apiQuery === '' ? '' : `?${apiQuery}`}`, signal)
  if (!isProductList(body)) {
    throw new Error('Unexpected product list response')
  }
  return body
}

export async function fetchProduct(slug: string, signal?: AbortSignal): Promise<ProductDetail> {
  const body = await getJson(`/api/products/${encodeURIComponent(slug)}`, signal)
  if (!isObject(body) || !isProductDetail(body.data)) {
    throw new Error('Unexpected product response')
  }
  return body.data
}

export function useProducts(apiQuery: string) {
  return useQuery({
    queryKey: ['products', apiQuery],
    queryFn: ({ signal }) => fetchProducts(apiQuery, signal),
    // Keep showing the previous grid while the next filter combination loads.
    placeholderData: keepPreviousData,
  })
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: ({ signal }) => fetchProduct(slug, signal),
    // A 404 is an answer, not a glitch: don't retry it.
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 1,
  })
}
