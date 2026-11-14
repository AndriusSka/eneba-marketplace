import { Link, NavLink, Outlet, ScrollRestoration } from 'react-router'

/** Content column: 1072px max (DESIGN.md › Spacing), 16px gutter below 768px, 24px from 768px. */
export const CONTAINER = 'mx-auto w-full max-w-268 px-4 md:px-6'

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-page">
        <div className={`${CONTAINER} flex h-20 items-center gap-6`}>
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
          {/* The header search box arrives in M3, the cart and user menu in M5/M6. */}
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
