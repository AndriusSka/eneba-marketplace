import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'
import { UserMenu } from '../features/auth/UserMenu'
import { CartLink } from '../features/cart/CartLink'
import { SearchBox } from '../features/search/SearchBox'

/** Content column: 1072px max (DESIGN.md › Spacing), 16px gutter below 768px, 24px from 768px. */
export const CONTAINER = 'mx-auto w-full max-w-268 px-4 md:px-6'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-page">
        {/* One 80px row from md; below md the search wraps onto its own full-width row (DESIGN.md › Header). */}
        <div className={`${CONTAINER} flex flex-wrap items-center gap-x-6 gap-y-3 py-4 md:h-20 md:flex-nowrap md:py-0`}>
          {/* Our own wordmark: Eneba's logo is not used (SPEC). */}
          <Link to="/" className="text-lg font-bold tracking-tight text-fg">
            Key<span className="text-accent">Market</span>
          </Link>
          <nav aria-label="Main">
            <NavLink
              to="/store"
              className={({ isActive }) => `text-sm font-semibold ${isActive ? 'text-accent' : 'text-fg hover:text-accent'}`}
            >
              Store
            </NavLink>
          </nav>
          <div className="order-last w-full md:order-0 md:max-w-122.5 md:flex-1">
            <SearchBox />
          </div>
          {/* Below md the search wraps to its own row, so this stays top-right. */}
          <div className="ml-auto flex items-center gap-3">
            <CartLink />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="flex-1">
        <Outlet />
      </div>

      <footer className="mt-12 bg-surface">
        <p className={`${CONTAINER} py-6 text-sm text-fg-muted`}>
          Assignment demo. Not affiliated with Eneba. Payments are simulated.
        </p>
      </footer>

      {/* Restore scroll per page path: Back from a product returns to the same spot in the Store,
          and toggling a filter doesn't jump to the top. */}
      <ScrollRestoration getKey={(location) => location.pathname} />
    </div>
  )
}
