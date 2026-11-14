import { Link } from 'react-router'
import { buttonClasses } from '../components/buttonClasses'
import { CONTAINER } from '../components/Layout'
import { HealthStatus } from '../features/health/HealthStatus'

// Temporary M0 page. M7 replaces it with the homepage rendered from GET /api/home.
export function SkeletonPage() {
  return (
    <main className={`${CONTAINER} py-6`}>
      <h1 className="text-h1 font-bold">Eneba marketplace</h1>
      <HealthStatus />
      <Link to="/store" className={buttonClasses('primary', 'md', 'mt-4')}>
        Browse the store
      </Link>
    </main>
  )
}
