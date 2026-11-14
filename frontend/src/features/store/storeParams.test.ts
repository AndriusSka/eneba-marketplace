import { describe, expect, it } from 'vitest'
import {
  DEFAULT_STORE_PARAMS,
  effectiveSort,
  parseStoreParams,
  toApiQuery,
  toSearchParams,
  type StoreParams,
} from './storeParams'

const parse = (query: string) => parseStoreParams(new URLSearchParams(query))

describe('parseStoreParams', () => {
  it('returns the defaults for an empty URL', () => {
    expect(parse('')).toEqual(DEFAULT_STORE_PARAMS)
  })

  it('reads every parameter', () => {
    expect(
      parse('q=elden&platform=steam&platform=xbox&region=eu&min_price=1000&max_price=5000&sort=price_asc&page=2'),
    ).toEqual({
      q: 'elden',
      platforms: ['steam', 'xbox'],
      regions: ['eu'],
      minPrice: 1000,
      maxPrice: 5000,
      sort: 'price_asc',
      page: 2,
    } satisfies StoreParams)
  })

  it.each([
    ['page=-1', { page: 1 }],
    ['page=0', { page: 1 }],
    ['page=abc', { page: 1 }],
    ['page=1001', { page: 1 }],
    ['sort=cheapest', { sort: null }],
    ['min_price=abc', { minPrice: null }],
    ['min_price=9.99', { minPrice: null }],
    ['max_price=-5', { maxPrice: null }],
    ['max_price=1000001', { maxPrice: null }],
    ['platform=STEAM&platform=a%20b', { platforms: [] }],
  ])('drops the invalid value in %s', (query, expected) => {
    expect(parse(query)).toEqual({ ...DEFAULT_STORE_PARAMS, ...expected })
  })

  it('de-duplicates and sorts slug lists', () => {
    expect(parse('platform=xbox&platform=steam&platform=xbox').platforms).toEqual(['steam', 'xbox'])
  })

  it('swaps a reversed price range', () => {
    expect(parse('min_price=5000&max_price=1000')).toMatchObject({ minPrice: 1000, maxPrice: 5000 })
  })

  it('trims the name filter', () => {
    expect(parse('q=%20%20elden%20').q).toBe('elden')
  })
})

describe('toSearchParams', () => {
  it('omits defaults', () => {
    expect(toSearchParams(DEFAULT_STORE_PARAMS).toString()).toBe('')
  })

  it('gives the same URL for the same state regardless of order', () => {
    const a = toSearchParams({ ...DEFAULT_STORE_PARAMS, platforms: ['xbox', 'steam'] })
    const b = toSearchParams({ ...DEFAULT_STORE_PARAMS, platforms: ['steam', 'xbox'] })
    expect(a.toString()).toBe(b.toString())
    expect(a.toString()).toBe('platform=steam&platform=xbox')
  })

  it('round-trips through the URL', () => {
    const state: StoreParams = {
      q: 'elden ring',
      platforms: ['steam'],
      regions: ['eu', 'global'],
      minPrice: 0,
      maxPrice: 4999,
      sort: 'newest',
      page: 3,
    }
    expect(parseStoreParams(toSearchParams(state))).toEqual(state)
  })
})

describe('toApiQuery', () => {
  it('uses the API names, with PHP list syntax', () => {
    const query = toApiQuery({ ...DEFAULT_STORE_PARAMS, platforms: ['steam', 'xbox'], minPrice: 1000 })
    expect(new URLSearchParams(query).getAll('platform[]')).toEqual(['steam', 'xbox'])
    expect(new URLSearchParams(query).get('min_price')).toBe('1000')
  })
})

describe('effectiveSort', () => {
  it('is best-selling without a query and relevance with one', () => {
    expect(effectiveSort(DEFAULT_STORE_PARAMS)).toBe('bestselling')
    expect(effectiveSort({ ...DEFAULT_STORE_PARAMS, q: 'ring' })).toBe('relevance')
  })

  it('falls back from relevance to best-selling when the query is cleared', () => {
    expect(effectiveSort({ ...DEFAULT_STORE_PARAMS, sort: 'relevance' })).toBe('bestselling')
  })
})
