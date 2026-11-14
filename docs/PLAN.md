# Build plan

Milestones are in build order. Each one ends with something that runs and can be checked. Tick the boxes as work lands. Scope is in [SPEC.md](SPEC.md) and design in [ARCHITECTURE.md](ARCHITECTURE.md).

Rough schedule over the 7-day window:

| Day | Milestones |
|---|---|
| 1 | M0, M1 |
| 2 | M2 |
| 3 | M3, M4 |
| 4 | M5, M6 (backend) |
| 5 | M6 (frontend), M7 |
| 6 | M8 |
| 7 | M9 and buffer |

Deploying in M0 is deliberate: free-tier hosting problems (proxy, cookies, cold starts) are found on day 1, not day 7.

---

## M0 — Skeleton and deploy first

- [ ] `/backend`: fresh Laravel 13 app with Pest and Pint, configured for Postgres.
- [ ] `/frontend`: Vite React TS app with React Router, TanStack Query, Tailwind, oxlint and Vitest.
- [ ] `docker-compose.yml` with Postgres 16, and `.env.example` files for both apps.
- [ ] `GET /api/health` returns `{status:"ok", db:"ok"}` after running `SELECT 1`.
- [ ] Vite dev proxy sends `/api` and `/sanctum` to `localhost:8000`.
- [ ] `backend/Dockerfile` and entrypoint (cache config, migrate, seed).
- [ ] Neon project created and `pg_trgm` available. Render service and Vercel project deployed, with `vercel.json` rewrites in place.
- [ ] GitHub Actions CI: backend (Pint, Pest with a Postgres service) and frontend (lint, `tsc`, Vitest, build).
- [ ] cron-job.org ping to `/api/health` configured.

**Verify:** `https://<app>.vercel.app/api/health` returns the health JSON through the Vercel origin, and the SPA loads at `/`. CI is green on `main`.

## M1 — Schema and seed data

- [ ] Migrations for every table in ARCHITECTURE.md, including the CHECK constraints, UNIQUE constraints, the partial index on available keys, and the `pg_trgm` extension with the GIN index.
- [ ] Eloquent models and relations. Factories for every model.
- [ ] Idempotent `DatabaseSeeder` that creates:
  - 6 platforms, 4 regions and 8 sellers
  - about 80 products with real game titles, placeholder covers and MSRPs
  - 1–6 offers per product with 0–15 keys each, some deliberately out of stock and some priced below MSRP
  - a demo user with past orders, so best sellers has data
  - 3 banners
  - `homepage_blocks` rows for `hero_banner`, `best_sellers` and `deals`
- [ ] A test proves the constraints hold: a duplicate key code, a sold key without an `order_item_id`, and a negative price are each rejected.

**Verify:** `php artisan migrate:fresh --seed` succeeds twice in a row. A second plain `db:seed` is a no-op. Row counts match in `psql`. The constraint tests pass.

## M2 — Store

- [ ] `GET /api/products` with `platform[]`, `region[]`, `min_price`, `max_price`, `sort` (price ↑/↓, newest, best-selling) and `page` (24 per page).
- [ ] Each product carries its from-price, stock flag, platform and region. Out-of-stock products sort last on price sorts.
- [ ] Disjunctive facet counts for platforms and regions, plus the overall price min/max.
- [ ] Store page: filter sidebar (a drawer on mobile), sort dropdown, product grid, pagination, and loading, empty and error states.
- [ ] Filter, sort and page state lives in URL search params, read and written through one hook.

**Verify:** Pest tests cover each filter, each sort, combined filters, pagination edges and facet counts against a known fixture. Vitest covers the URL ↔ state mapping. Manually: set filters, reload and go back/forward, and the view is preserved.

## M3 — Search

- [ ] `ProductSearch` class: input normalization (including LIKE escaping) and the tiered ranking SQL. It is plugged into `/api/products?q=` (relevance sort) and `/api/search/suggest`.
- [ ] Word-similarity threshold set per transaction and tuned against the test table.
- [ ] Header search box on every page: debounced (250 ms) autocomplete with the top 6, keyboard navigation (↑ ↓ Enter Esc), and Enter opening `/store?q=…`.
- [ ] Empty results show a "No results for '…'" message with a clear-filters action.

**Verify:** a Pest dataset of about 15 cases passes, for example `eldn ring → elden-ring-…`, `cyberp → cyberpunk-2077-…`, `witcer → the-witcher-3-…`, `ring → elden-ring-…`, `FIFA` (case), and a nonsense query → empty. `EXPLAIN` on a fuzzy query shows a bitmap scan on `products_title_trgm`. Manually: typing in the header shows suggestions on the Store, product and cart pages.

## M4 — Product page

- [ ] `GET /api/products/{slug}`: product details plus offers with seller name and rating, price, discount compared with MSRP and stock, sorted by price. 404 for an unknown slug.
- [ ] Page: cover, title, platform and region badges, description, release date, and the offers table. The best offer is highlighted. Out-of-stock offers are disabled. "Add to cart" on each offer.

**Verify:** Pest covers the offers order, the stock count (sold keys excluded) and the 404. Manually: a product with mixed in-stock and out-of-stock offers renders correctly at 375px and 1440px.

## M5 — Authentication

- [ ] Sanctum SPA setup: stateful domains, TrustProxies, database sessions and the CSRF cookie flow in the fetch client.
- [ ] `POST /api/register`, `/api/login` (rate-limited), `/api/logout` and `GET /api/me`.
- [ ] Login and register pages with server validation errors shown on the fields. `RequireAuth` wrapper with `?next=` redirect back. Header shows the user menu or a sign-in link.

**Verify:** Pest tests: register, login with valid and invalid credentials, logout, the throttle after 5 failures, and a guest getting 401 on `/api/checkout`, `/api/orders` and `/api/me`. **Production check:** sign in on the Vercel URL, reload the page and stay signed in. This confirms the cookie survives the proxy.

## M6 — Cart and checkout

- [ ] Cart store (localStorage, `{offerId, quantity}` only): add, merge duplicate offers, set quantity, remove, clear, and a count badge in the header.
- [ ] `POST /api/cart/quote` and a cart page showing server prices, stock warnings and an automatic quantity clamp.
- [ ] `CheckoutService` exactly as specified in ARCHITECTURE.md: validation, idempotency, test cards, re-pricing, `FOR UPDATE SKIP LOCKED`, the order, sold keys, and the unique-violation replay.
- [ ] `POST /api/checkout`, `GET /api/orders` and `GET /api/orders/{id}`.
- [ ] Checkout page: order summary and simulated card form with the test cards listed. The Idempotency-Key is generated once per checkout attempt, and the pay button is disabled while the request is in flight.
- [ ] Clear UI for 402, 409 (cart refreshed, offer named) and 422.
- [ ] Order confirmation page with key codes and copy buttons. The cart is cleared on success.
- [ ] Order history list and order detail pages.

**Verify:** Pest tests:
- happy path (keys sold, order total = DB prices)
- tampered client price ignored
- 402 leaves nothing saved and the keys still available
- 409 on insufficient stock and on an inactive offer
- the same Idempotency-Key twice → one order, and the second call returns 200
- another user's order → 404

**Concurrency test:** 20 parallel processes on an offer with 5 keys → exactly 5 orders and 15 out-of-stock results, 5 distinct sold keys and 0 available. Vitest covers the cart store. Manually: a double-click on Pay creates one order.

## M7 — Homepage

- [ ] `BlockProvider` interface, provider registry, and `BannerProvider`, `BestSellersProvider` and `DealsProvider`.
- [ ] `HomepageService` with per-provider try/catch and logging. Unknown or empty blocks are left out.
- [ ] `GET /api/home`.
- [ ] Frontend `blockRegistry`, `HeroBanner` and `ProductCarousel` components, and an error boundary per block.

**Verify:** Pest tests: blocks come back in `position` order, an inactive block is hidden, an unknown type is skipped, a provider that throws is left out while the other blocks still return, and deals only include offers below MSRP. Vitest: an unknown type renders nothing. **Production check:** in Neon, run `UPDATE homepage_blocks SET is_active=false WHERE type='deals'` and swap two positions. The live homepage changes on reload with no redeploy.

## M8 — Eneba styling

- [ ] Tokens taken from eneba.com (colors, font family and scale, spacing, radii, shadows) and recorded in the Tailwind `@theme` block in `frontend/src/index.css` with comments naming the source.
- [ ] Shared components: header (logo slot, search, cart, user menu), footer with an "assignment demo" note, `ProductCard`, `Button` variants, `Badge` (platform, region, discount), price display and skeleton loaders.
- [ ] Every page restyled, with a responsive pass at 375, 768 and 1440 px.
- [ ] Accessibility basics: visible focus, alt text, sufficient contrast, labels on form inputs.

**Verify:** screenshots of the homepage, Store, product page and checkout at 375px and 1440px next to the matching eneba.com screens, saved to `docs/screenshots/`. No horizontal scroll at 375px. Lighthouse accessibility ≥ 90 on the homepage.

## M9 — Hardening and submission

- [ ] Playwright happy path: typo search → product → add offer → cart → login → pay with 4242 → key shown → order in history.
- [ ] CI green on `main`, including the concurrency test.
- [ ] README covers: what it is, live URL, demo account, test cards, local setup steps, how to run tests, and links to the docs.
- [ ] AI session logs exported to `ai-logs/`, one file per session.
- [ ] Final production smoke test on a cold start (after more than 15 minutes idle).

**Verify:** a fresh clone, set up by following only the README, runs locally and passes all tests. The live URL completes the Playwright path by hand. The submission email has all three deliverables: GitHub link, public URL and AI logs.
