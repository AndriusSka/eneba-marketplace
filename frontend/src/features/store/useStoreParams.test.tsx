import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { useStoreParams } from './useStoreParams'

function Probe() {
  const { params, update, clear } = useStoreParams()
  return (
    <div>
      <output data-testid="params">{JSON.stringify(params)}</output>
      <button onClick={() => update({ platforms: [...params.platforms, 'steam'] })}>steam</button>
      <button onClick={() => update({ regions: ['eu'] })}>eu</button>
      <button onClick={() => update({ page: 2 })}>page 2</button>
      <button onClick={() => update({ sort: 'newest' })}>newest</button>
      <button onClick={clear}>clear</button>
    </div>
  )
}

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/store', element: <Probe /> }], { initialEntries: [url] })
  render(<RouterProvider router={router} />)
  const params = () => JSON.parse(screen.getByTestId('params').textContent ?? '{}') as Record<string, unknown>
  return { router, params }
}

describe('useStoreParams', () => {
  it('reads the state from the URL', () => {
    const { params } = renderAt('/store?platform=xbox&page=3')
    expect(params()).toMatchObject({ platforms: ['xbox'], page: 3 })
  })

  it('writes changes to the URL and resets the page', () => {
    const { router, params } = renderAt('/store?page=3')

    fireEvent.click(screen.getByText('eu'))

    expect(router.state.location.search).toBe('?region=eu')
    expect(params()).toMatchObject({ regions: ['eu'], page: 1 })
  })

  it('keeps an explicit page change', () => {
    const { router } = renderAt('/store?region=eu')

    fireEvent.click(screen.getByText('page 2'))

    expect(router.state.location.search).toBe('?region=eu&page=2')
  })

  it('pushes a history entry per change, so Back restores the previous filters', async () => {
    const { router, params } = renderAt('/store')

    fireEvent.click(screen.getByText('steam'))
    fireEvent.click(screen.getByText('eu'))
    fireEvent.click(screen.getByText('page 2'))
    expect(params()).toMatchObject({ platforms: ['steam'], regions: ['eu'], page: 2 })

    await act(() => router.navigate(-1))
    expect(params()).toMatchObject({ platforms: ['steam'], regions: ['eu'], page: 1 })

    await act(() => router.navigate(-1))
    expect(params()).toMatchObject({ platforms: ['steam'], regions: [], page: 1 })

    await act(() => router.navigate(-1))
    expect(params()).toMatchObject({ platforms: [], regions: [] })
  })

  it('does not push a duplicate entry when nothing changed', () => {
    const { router } = renderAt('/store?sort=newest')
    const key = router.state.location.key

    fireEvent.click(screen.getByText('newest'))

    expect(router.state.location.key).toBe(key)
  })

  it('clears filters but keeps the sort', () => {
    const { router } = renderAt('/store?q=ring&platform=steam&min_price=100&sort=newest&page=2')

    fireEvent.click(screen.getByText('clear'))

    expect(router.state.location.search).toBe('?sort=newest')
  })
})
