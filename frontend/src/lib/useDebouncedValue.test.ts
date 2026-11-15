import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('only takes the latest value once it has been stable for the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 250), {
      initialProps: { value: 'w' },
    })

    rerender({ value: 'wi' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'wit' })
    act(() => vi.advanceTimersByTime(200))
    // 400 ms since the first change, but only 200 ms since the last one.
    expect(result.current).toBe('w')

    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('wit')
  })
})
