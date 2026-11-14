import { useQuery } from '@tanstack/react-query'
import { getJson } from './client'

export type Health = {
  status: string
  db: string
}

export function isHealth(value: unknown): value is Health {
  return (
    typeof value === 'object' &&
    value !== null &&
    'status' in value &&
    'db' in value &&
    typeof value.status === 'string' &&
    typeof value.db === 'string'
  )
}

export async function fetchHealth(signal?: AbortSignal): Promise<Health> {
  const body = await getJson('/api/health', signal)
  if (!isHealth(body)) {
    throw new Error('Unexpected health response')
  }
  return body
}

export function useHealth() {
  return useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
  })
}
