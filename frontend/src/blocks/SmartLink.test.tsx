import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SmartLink } from './SmartLink'

function renderLink(href: string) {
  const router = createMemoryRouter([{ path: '/', element: <SmartLink href={href}>Shop now</SmartLink> }])
  render(<RouterProvider router={router} />)
}

describe('SmartLink', () => {
  it.each([
    ['/store?sort=bestselling', '/store?sort=bestselling'],
    ['/product/elden-ring#offers', '/product/elden-ring#offers'],
    ['https://example.com/sale', 'https://example.com/sale'],
  ])('links %s', (href, expected) => {
    renderLink(href)

    expect(screen.getByRole('link', { name: 'Shop now' })).toHaveAttribute('href', expected)
  })

  it.each([
    ['javascript:alert(1)'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['/\t/evil.example'],
    ['/\n/evil.example'],
    ['store'],
  ])('renders %j without a link', (href) => {
    renderLink(href)

    expect(screen.getByText('Shop now')).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})
