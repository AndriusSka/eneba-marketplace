import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ProductSummary } from '../../api/products'
import { SearchBox, SUGGEST_DEBOUNCE_MS } from './SearchBox'

function product(id: number, slug: string, title: string): ProductSummary {
  return {
    id,
    slug,
    title,
    cover_url: '/placeholders/cover-1.svg',
    platform: { slug: 'steam', name: 'Steam' },
    region: { slug: 'global', name: 'Global' },
    release_date: '2015-05-19',
    msrp_cents: 2999,
    currency: 'EUR',
    from_price_cents: 1499,
    from_offer_id: id * 10,
    discount_percent: 50,
    in_stock: true,
  }
}

const witcherSteam = product(1, 'the-witcher-3-steam-global', 'The Witcher 3: Wild Hunt')
const witcherXbox = product(2, 'the-witcher-3-xbox-eu', 'The Witcher 3: Wild Hunt')

/** Answers /api/search/suggest with `results[q]`, or nothing. */
function stubSuggest(results: Record<string, ProductSummary[]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const q = new URL(String(input), 'http://localhost').searchParams.get('q') ?? ''
    return new Response(JSON.stringify({ data: results[q] ?? [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function CurrentLocation() {
  const { pathname, search } = useLocation()
  return <p data-testid="location">{pathname + search}</p>
}

function renderSearch(initialEntry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const page = (
    <>
      <SearchBox />
      <CurrentLocation />
    </>
  )
  const router = createMemoryRouter([{ path: '*', element: page }], { initialEntries: [initialEntry] })
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return screen.getByRole('combobox', { name: 'Search games and gift cards' })
}

function type(input: HTMLElement, value: string) {
  fireEvent.focus(input)
  fireEvent.change(input, { target: { value } })
}

const location = () => screen.getByTestId('location').textContent

describe('SearchBox', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows suggestions after the debounce', async () => {
    stubSuggest({ wticher: [witcherSteam, witcherXbox] })
    const input = renderSearch()

    type(input, 'wticher')

    const options = await screen.findAllByRole('option')
    expect(options).toHaveLength(2)
    expect(options[0]).toHaveTextContent('The Witcher 3: Wild Hunt')
    expect(options[0]).toHaveTextContent('Steam · Global')
    expect(options[0]).toHaveTextContent('€14.99')
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('sends one request for a burst of keystrokes, and none below 2 characters', async () => {
    const fetchMock = stubSuggest({ elden: [product(3, 'elden-ring', 'Elden Ring')] })
    const input = renderSearch()

    type(input, 'e')
    await new Promise((resolve) => setTimeout(resolve, SUGGEST_DEBOUNCE_MS + 100))
    expect(fetchMock).not.toHaveBeenCalled()

    type(input, 'el')
    type(input, 'eld')
    type(input, 'elden')
    await screen.findByRole('option')

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/search/suggest?q=elden')
  })

  it('opens the product picked with the arrow keys', async () => {
    stubSuggest({ witcher: [witcherSteam, witcherXbox] })
    const input = renderSearch()
    type(input, 'witcher')
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveAttribute('aria-activedescendant', screen.getAllByRole('option')[1].id)

    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(location()).toBe('/product/the-witcher-3-xbox-eu'))
    expect(input).toHaveValue('')
  })

  it('wraps from the first row to the last with ArrowUp', async () => {
    stubSuggest({ witcher: [witcherSteam, witcherXbox] })
    const input = renderSearch()
    type(input, 'witcher')
    await screen.findAllByRole('option')

    fireEvent.keyDown(input, { key: 'ArrowUp' })

    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('opens the full results with only the query when Enter is pressed without a picked row', async () => {
    stubSuggest({})
    const input = renderSearch('/store?platform=xbox&q=old&sort=price_asc')
    expect(input).toHaveValue('old')

    type(input, '  wticher ')
    fireEvent.submit(screen.getByRole('search'))

    await waitFor(() => expect(location()).toBe('/store?q=wticher'))
    expect(input).toHaveValue('wticher')
  })

  it('does nothing when submitted empty', () => {
    stubSuggest({})
    const input = renderSearch('/product/elden-ring')

    type(input, '   ')
    fireEvent.submit(screen.getByRole('search'))

    expect(location()).toBe('/product/elden-ring')
  })

  it('closes the list on Escape', async () => {
    stubSuggest({ witcher: [witcherSteam] })
    const input = renderSearch()
    type(input, 'witcher')
    await screen.findByRole('option')

    fireEvent.keyDown(input, { key: 'Escape' })

    expect(screen.queryByRole('listbox')).toBeNull()
    expect(input).toHaveAttribute('aria-expanded', 'false')
    expect(input).toHaveValue('witcher')
  })

  it('says so when nothing matches', async () => {
    stubSuggest({})
    const input = renderSearch()

    type(input, 'qwerty')

    expect(await screen.findByRole('option')).toHaveTextContent('No results for “qwerty”')
  })

  it('shows the Store query while on /store', () => {
    stubSuggest({})
    expect(renderSearch('/store?q=elden')).toHaveValue('elden')
  })

  it('stays empty on other pages', () => {
    stubSuggest({})
    expect(renderSearch('/product/elden-ring?q=elden')).toHaveValue('')
  })
})
