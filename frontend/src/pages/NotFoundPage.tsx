import { Link } from 'react-router'
import { buttonClasses } from '../components/buttonClasses'
import { CONTAINER } from '../components/Layout'

/** Unknown routes and unknown product slugs. */
export function NotFoundPage() {
  return (
    <main className={`${CONTAINER} py-16 text-center`}>
      <title>Not found | KeyMarket</title>
      <p className="text-price-lg font-bold text-accent">404</p>
      <h1 className="mt-2 text-h1 font-bold">Page not found</h1>
      <p className="mt-2 text-base">The page or product you’re looking for doesn’t exist.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link to="/store" className={buttonClasses('primary')}>
          Browse the store
        </Link>
        <Link to="/" className={buttonClasses('secondary')}>
          Back to the homepage
        </Link>
      </div>
    </main>
  )
}
