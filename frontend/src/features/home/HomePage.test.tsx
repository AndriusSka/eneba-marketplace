import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HomeBlock } from '../../api/home'
import type { ProductSummary } from '../../api/products'
import { HomePage } from './HomePage'

// Lets one test make the hero block throw while rendering.
const hero = vi.hoisted(() => ({ throws: false }))
vi.mock('../../blocks/HeroBanner', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../blocks/HeroBanner')>()
  return {
    HeroBanner: (props: Parameters<typeof actual.HeroBanner>[0]) => {
      if (hero.throws) throw new Error('hero broke')
      return actual.HeroBanner(props)
    },
  }
})

function product(id: number, title: string): ProductSummary {
  return {
    id,
    slug: `product-${id}`,
    title,
    cover_url: '/placeholders/cover-1.svg',
    platform: { slug: 'steam', name: 'Steam' },
    region: { slug: 'global', name: 'Global' },
    release_date: null,
    msrp_cents: 5999,
    currency: 'EUR',
    from_price_cents: 3449,
    discount_percent: 42,
    in_stock: true,
  }
}

const blocks: HomeBlock[] = [
  { id: 3, type: 'deals', title: 'Hot deals', link_url: null, data: [product(1, 'Elden Ring')] },
  {
    id: 1,
    type: 'hero_banner',
    title: 'Featured',
    link_url: null,
    data: [{ id: 1, title: 'Gift cards, delivered instantly', subtitle: 'Steam and more', image_url: '/b.svg', link_url: '/store' }],
  },
  { id: 9, type: 'countdown', title: 'Unknown block', link_url: null, data: [] },
  {
    id: 2,
    type: 'best_sellers',
    title: 'Top sellers',
    link_url: '/store?sort=bestselling',
    data: [product(2, 'Cyberpunk 2077'), product(3, 'Hollow Knight')],
  },
]

function renderHome(body: unknown = { data: blocks }) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })),
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createMemoryRouter([{ path: '/', element: <HomePage /> }])
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
}

/** Section headings in document order (the h1 is the visually hidden brand). */
async function sectionTitles() {
  await screen.findByRole('heading', { level: 2, name: 'Top sellers' })
  return screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
}

describe('HomePage', () => {
  afterEach(() => {
    hero.throws = false
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the blocks in API order with their API titles, skipping unknown types', async () => {
    renderHome()

    expect(await sectionTitles()).toEqual(['Hot deals', 'Featured', 'Top sellers'])
    expect(screen.queryByText('Unknown block')).not.toBeInTheDocument()
  })

  it('shows "View all" only on blocks that send a link', async () => {
    renderHome()

    const best = (await screen.findByRole('heading', { name: 'Top sellers' })).closest('section')
    const deals = screen.getByRole('heading', { name: 'Hot deals' }).closest('section')

    expect(within(best!).getByRole('link', { name: 'View all' })).toHaveAttribute('href', '/store?sort=bestselling')
    expect(within(deals!).queryByRole('link', { name: 'View all' })).not.toBeInTheDocument()
  })

  it('keeps the other blocks when one block throws while rendering', async () => {
    hero.throws = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    renderHome()

    expect(await sectionTitles()).toEqual(['Hot deals', 'Top sellers'])
    expect(screen.queryByText('Gift cards, delivered instantly')).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
  })

  it('offers the Store when no block is active', async () => {
    renderHome({ data: [] })

    expect(await screen.findByRole('link', { name: 'Browse the store' })).toHaveAttribute('href', '/store')
  })
})
