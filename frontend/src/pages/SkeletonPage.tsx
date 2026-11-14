import { HealthStatus } from '../features/health/HealthStatus'

// Temporary M0 page. M7 replaces it with the homepage rendered from GET /api/home.
export function SkeletonPage() {
  return (
    <main className="p-4">
      <h1>Eneba marketplace</h1>
      <HealthStatus />
    </main>
  )
}
