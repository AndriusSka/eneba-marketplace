import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import type { HomeBlock } from '../api/home'
import { HomeBlockView } from './blockRegistry'

function renderBlock(block: HomeBlock) {
  const router = createMemoryRouter([{ path: '/', element: <HomeBlockView block={block} /> }])
  return render(<RouterProvider router={router} />)
}

const banner = { id: 1, title: 'Prices below retail', subtitle: null, image_url: '/b.svg', link_url: '/store' }

describe('HomeBlockView', () => {
  it('renders a known block type with its component', () => {
    renderBlock({ id: 1, type: 'hero_banner', title: 'Featured', link_url: null, data: [banner] })

    expect(screen.getByRole('heading', { name: 'Featured' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Prices below retail/ })).toHaveAttribute('href', '/store')
  })

  it('renders nothing for an unknown block type', () => {
    const { container } = renderBlock({ id: 2, type: 'countdown', title: 'Soon', link_url: null, data: [banner] })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing for a type that only exists on Object.prototype', () => {
    const { container } = renderBlock({ id: 3, type: 'toString', title: 'Proto', link_url: null, data: [] })

    expect(container).toBeEmptyDOMElement()
  })

  it('renders nothing when a known type sends data of the wrong shape', () => {
    const { container } = renderBlock({ id: 4, type: 'deals', title: 'Deals', link_url: null, data: [{ id: 'x' }] })

    expect(container).toBeEmptyDOMElement()
  })

  it('does not link a banner whose URL has an unsafe scheme', () => {
    renderBlock({
      id: 5,
      type: 'hero_banner',
      title: 'Featured',
      link_url: null,
      data: [{ ...banner, link_url: 'javascript:alert(1)' }],
    })

    expect(screen.getByText('Prices below retail')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
