import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { DEFAULT_STORE_PARAMS, parseStoreParams, toSearchParams, type StoreParams } from './storeParams'

/**
 * The one hook that reads and writes Store state in the URL.
 *
 * Every committed change pushes a history entry, so Back steps through previous filter states.
 * Any change except an explicit page change goes back to page 1.
 */
export function useStoreParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseStoreParams(searchParams), [searchParams])

  const update = useCallback(
    (patch: Partial<StoreParams>) => {
      const next = toSearchParams({ ...params, ...patch, page: patch.page ?? 1 })
      // Don't push a duplicate entry (e.g. blurring a price input without changing it).
      if (next.toString() !== toSearchParams(params).toString()) {
        setSearchParams(next)
      }
    },
    [params, setSearchParams],
  )

  /** Drop every filter (including the name filter) but keep the chosen sort. */
  const clear = useCallback(() => update({ ...DEFAULT_STORE_PARAMS, sort: params.sort }), [update, params.sort])

  return { params, update, clear }
}
