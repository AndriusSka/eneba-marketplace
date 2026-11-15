import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, getJson, sendJson } from './client'
import { isNumber, isObject, isString } from './guards'
import { ORDER_KEY, ORDERS_KEY } from './orders'

// POST /api/register, /api/login, /api/logout and GET /api/me (ARCHITECTURE.md › Authentication).
// The signed-in state is the ['me'] query: a User, or null for a guest. Nothing about the session is
// stored in JavaScript; a page reload simply asks /api/me again and the browser sends the cookie.

export type User = { id: number; name: string; email: string }

export type LoginInput = { email: string; password: string }

export type RegisterInput = { name: string; email: string; password: string; password_confirmation: string }

export const ME_QUERY_KEY = ['me'] as const

function isUser(value: unknown): value is User {
  return isObject(value) && isNumber(value.id) && isString(value.name) && isString(value.email)
}

function parseUser(body: unknown): User {
  if (isObject(body) && isUser(body.data)) {
    return body.data
  }
  throw new Error('Unexpected user response')
}

/** The current user, or null when signed out (a 401 is an answer here, not an error). */
export async function fetchMe(signal?: AbortSignal): Promise<User | null> {
  try {
    return parseUser(await getJson('/api/me', signal))
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null
    }
    throw error
  }
}

export function useMe() {
  return useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: ({ signal }) => fetchMe(signal),
    staleTime: 5 * 60_000,
  })
}

export function useLogin() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LoginInput) => parseUser(await sendJson('POST', '/api/login', input)),
    onSuccess: (user) => queryClient.setQueryData(ME_QUERY_KEY, user),
  })
}

export function useRegister() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RegisterInput) => parseUser(await sendJson('POST', '/api/register', input)),
    onSuccess: (user) => queryClient.setQueryData(ME_QUERY_KEY, user),
  })
}

export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      try {
        await sendJson('POST', '/api/logout')
      } catch (error) {
        // Already signed out on the server (the session expired): the goal is reached.
        if (!(error instanceof ApiError && error.status === 401)) {
          throw error
        }
      }
    },
    // Per-user data goes with the session, so the next person on this browser never sees it.
    // The cart stays: guests have carts too.
    onSuccess: () => {
      queryClient.setQueryData(ME_QUERY_KEY, null)
      queryClient.removeQueries({ queryKey: [ORDERS_KEY] })
      queryClient.removeQueries({ queryKey: [ORDER_KEY] })
    },
  })
}
