import { useState } from 'react'

export type IdempotencyKey = {
  /** The key of the current attempt, created on first use. */
  get: () => string
  /** Ends the attempt: the next get() creates a new key. */
  reset: () => void
}

/**
 * One Idempotency-Key per checkout attempt (ARCHITECTURE.md › Checkout transaction).
 *
 * - `get()` creates the key on the first Pay and returns the same one until `reset()`.
 * - Keep it after a network error or a 5xx: the payment may have gone through, and paying again
 *   with the same key replays that order instead of charging twice.
 * - `reset()` after any definite 4xx answer: that attempt is over and nothing was saved, so the
 *   next Pay (perhaps with a different cart) is a new attempt.
 */
export function useIdempotencyKey(): IdempotencyKey {
  // Created once per mounted page; the key lives in the closure, never in render output.
  const [api] = useState<IdempotencyKey>(() => {
    let key: string | null = null
    return {
      get: () => (key ??= crypto.randomUUID()),
      reset: () => {
        key = null
      },
    }
  })
  return api
}
