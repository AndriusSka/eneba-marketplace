import { useQuery } from '@tanstack/react-query'
import { getJson } from './client'
import { isArrayOf, isNullable, isNumber, isObject, isString } from './guards'

// Shape of GET /api/home (docs/ARCHITECTURE.md › Homepage block design).

export type HomeBlock = {
  id: number
  /** The provider key, e.g. "best_sellers". The frontend maps it to a component in blockRegistry. */
  type: string
  title: string
  /** A same-site path for a "View all" link, or null. */
  link_url: string | null
  /** Block-specific. Each block component narrows it with its own guard. */
  data: unknown
}

export type Banner = {
  id: number
  title: string
  subtitle: string | null
  image_url: string
  link_url: string
}

const isNullableString = isNullable(isString)

function isHomeBlock(value: unknown): value is HomeBlock {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isString(value.type) &&
    isString(value.title) &&
    isNullableString(value.link_url) &&
    'data' in value
  )
}

export function isBanner(value: unknown): value is Banner {
  return (
    isObject(value) &&
    isNumber(value.id) &&
    isString(value.title) &&
    isNullableString(value.subtitle) &&
    isString(value.image_url) &&
    isString(value.link_url)
  )
}

export async function fetchHome(signal?: AbortSignal): Promise<HomeBlock[]> {
  const body = await getJson('/api/home', signal)
  // Only the envelope is checked here: one block with bad data must not fail the whole page.
  if (!isObject(body) || !isArrayOf(body.data, isHomeBlock)) {
    throw new Error('Unexpected homepage response')
  }
  return body.data
}

export function useHome() {
  return useQuery({
    queryKey: ['home'],
    queryFn: ({ signal }) => fetchHome(signal),
  })
}
