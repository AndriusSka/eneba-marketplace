import { useHealth } from '../../api/health'

export function HealthStatus() {
  const { data, error, isPending } = useHealth()

  if (isPending) {
    return <p role="status">Checking API…</p>
  }

  if (error) {
    return <p role="alert">API error: {error.message}</p>
  }

  const healthy = data.status === 'ok' && data.db === 'ok'
  return <p role="status">{healthy ? 'API OK' : `API degraded (db: ${data.db})`}</p>
}
