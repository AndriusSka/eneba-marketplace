import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getJson } from './client'
import { isArrayOf, isObject } from './guards'
import { isProductSummary, type ProductSummary } from './products'

// GET /api/search/suggest?q= → {data: ProductSummary[]}, at most 6, in the Store's relevance order
// (docs/ARCHITECTURE.md › Search approach).

/** Shorter queries match too much to be useful as suggestions. */
export const MIN_SUGGEST_LENGTH = 2

export async function fetchSuggestions(q: string, signal?: AbortSignal): Promise<ProductSummary[]> {
  const body = await getJson(`/api/search/suggest?${new URLSearchParams({ q }).toString()}`, signal)
  if (!isObject(body) || !isArrayOf(body.data, isProductSummary)) {
    throw new Error('Unexpected suggestions response')
  }
  return body.data
}

/** @param q the debounced, trimmed query */
export function useSuggestions(q: string) {
  return useQuery({
    queryKey: ['suggest', q],
    queryFn: ({ signal }) => fetchSuggestions(q, signal),
    enabled: q.length >= MIN_SUGGEST_LENGTH,
    // Keep the previous rows while the next keystroke's results load, so the list doesn't flicker.
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  })
}
