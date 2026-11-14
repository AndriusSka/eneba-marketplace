import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="p-4">
      <h1>Page not found</h1>
      <Link to="/">Back to the homepage</Link>
    </main>
  )
}
