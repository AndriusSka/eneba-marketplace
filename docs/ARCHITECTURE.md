# Architecture

This document covers how [SPEC.md](SPEC.md) is built. The build order is in [PLAN.md](PLAN.md).

## Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 19 + TypeScript 7, Vite 8, React Router 8, TanStack Query 5, Tailwind CSS 4, oxlint | TanStack Query handles caching, loading and error states for every server read. Tailwind holds the Eneba design tokens in one `@theme` block in `src/index.css`. oxlint replaces ESLint because typescript-eslint does not support TypeScript 7. |
| Backend | Laravel 13 (PHP 8.4), REST/JSON, Sanctum | Auth, validation, migrations and testing are built in. Its structure is close to ASP.NET Core (controllers, DI container, middleware, migrations). |
| Database | PostgreSQL 16 on Neon (`main` branch in production, `dev` and `test` branches locally) | `pg_trgm` gives typo-tolerant search, and `FOR UPDATE SKIP LOCKED` gives safe key assignment. Neon's free tier does not expire, unlike Render's free Postgres, which is deleted after 30 days. |
| Tests | Pest (backend), Vitest + Testing Library (frontend), Playwright (one end-to-end path) | Backend tests run against real Postgres, because SQLite has neither `pg_trgm` nor `SKIP LOCKED`. |
| Hosting | Vercel (frontend), Render free web service in Docker (API), Neon free (database) | All free tier, as the assignment requires. |

## System overview

```
                 one origin: https://<app>.vercel.app
┌─────────┐      ┌──────────────────────────────┐      ┌───────────────────────┐      ┌──────────────┐
│ Browser │ ───► │ Vercel                       │ ───► │ Render (Docker)       │ ───► │ Neon         │
│  React  │      │  /*         → SPA index.html │      │  nginx + php-fpm      │      │  PostgreSQL  │
│   SPA   │      │  /api/*     → rewrite ───────┼────► │  Laravel API          │      │  pg_trgm     │
└─────────┘      │  /sanctum/* → rewrite ───────┼────► │                       │      └──────────────┘
                 └──────────────────────────────┘      └───────────────────────┘
```

The browser only ever talks to the Vercel origin, and Vercel proxies API calls to Render. So the session cookie is first-party, Sanctum's cookie-based SPA auth works, and no CORS setup is needed.

## Repository layout

```
/frontend                 Vite React app (deployed to Vercel, root dir = frontend)
  src/api/                typed fetch client + TanStack Query hooks
  src/blocks/             homepage block components + blockRegistry.ts
  src/features/           store/, search/, product/, cart/, checkout/, orders/, auth/
  src/components/         Eneba-styled UI primitives (Button, Badge, ProductCard…)
  vercel.json             rewrites
/backend                  Laravel app (Dockerfile, deployed to Render)
  app/Http/Controllers/   thin controllers
  app/Services/           CheckoutService, ProductSearch, Homepage/…
  app/Services/Homepage/Providers/   one class per block type
  database/migrations, database/seeders, tests/
docker-compose.yml        local Postgres 16 (deferred: local work uses Neon branches)
.github/workflows/ci.yml  (deferred)
docs/
```

## Data model

All money is stored as integer euro cents (`*_cents`). Every foreign key is indexed. Timestamps (`created_at`, `updated_at`) are omitted below.

```
platforms 1─N products N─1 regions
products  1─N offers   N─1 sellers
offers    1─N keys
users     1─N orders   1─N order_items N─1 offers
order_items 1─N keys          (the keys sold on that line)
homepage_blocks, banners      (homepage sources, standalone)
```

| Table | Columns | Constraints and indexes |
|---|---|---|
| `platforms` | id, slug, name | `slug` UNIQUE |
| `regions` | id, slug, name | `slug` UNIQUE |
| `products` | id, slug, title, platform_id, region_id, description, cover_url, release_date, msrp_cents | `slug` UNIQUE. GIN `gin_trgm_ops` index on `lower(title)` for search. `msrp_cents > 0` |
| `sellers` | id, name, rating (numeric 3,2) | `rating BETWEEN 0 AND 5` |
| `offers` | id, product_id, seller_id, price_cents, is_active | UNIQUE (product_id, seller_id). `price_cents > 0` |
| `keys` | id, offer_id, code, status, order_item_id NULL, sold_at NULL | `code` UNIQUE. `status IN ('available','sold')`. CHECK: `status='sold'` ⇔ `order_item_id IS NOT NULL`. Partial index on `(offer_id) WHERE status='available'` |
| `users` | Laravel default (id, name, email, password) | `email` UNIQUE |
| `sessions` | Laravel database session driver | Render's disk is ephemeral, so file sessions would be lost |
| `orders` | id, user_id, status, total_cents, idempotency_key, paid_at | UNIQUE (user_id, idempotency_key). `status IN ('paid')`, with room for later states |
| `order_items` | id, order_id, offer_id, unit_price_cents, quantity | `quantity BETWEEN 1 AND 10`. The price is copied at purchase time |
| `banners` | id, title, subtitle, image_url, link_url, position, is_active | |
| `homepage_blocks` | id, type, title, position, is_active, config jsonb | `type` is the provider key. `config` holds e.g. `{"limit": 12}` |

Derived values (not stored):
- **Stock of an offer** = `COUNT(keys WHERE status='available')`.
- **Product "from" price** = the lowest `price_cents` among active offers that have stock.
- **Sales of a product** = `SUM(order_items.quantity)` over its offers.
- **Discount** = `1 − price_cents / msrp_cents`.

At this catalog size (about 80 products) these are cheap aggregates. Denormalized counters would only be worth adding once profiling shows a need.

There is no cart table: the cart is client state (see Checkout).

## API

REST/JSON under `/api`. Errors use one shape: `{ "message": string, "errors"?: {field: [msg]}, "code"?: string }`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | Liveness plus a DB ping. Used by the uptime pinger |
| GET | `/api/home` | – | Ordered homepage blocks with their data |
| GET | `/api/products` | – | Store listing: `q`, `platform[]`, `region[]`, `min_price`, `max_price` (cents), `sort` (`relevance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `page`. Returns `{data, meta:{page, per_page, total}, facets:{platforms:[{slug,name,count}], regions:[…], price:{min,max}}}` |
| GET | `/api/search/suggest?q=` | – | Top 6 matches for autocomplete (same engine as the listing) |
| GET | `/api/products/{slug}` | – | Product details plus offers (seller, price, stock, discount), sorted by price |
| POST | `/api/cart/quote` | – | `{items:[{offer_id, quantity}]}` → current price, stock and line totals per item, plus warnings (`out_of_stock`, `quantity_reduced`, `inactive`) |
| GET | `/sanctum/csrf-cookie` | – | Sets the `XSRF-TOKEN` cookie before login/register |
| POST | `/api/register` | – | Create an account and sign in |
| POST | `/api/login` | – | Sign in (rate-limited) |
| POST | `/api/logout` | user | Sign out |
| GET | `/api/me` | user | Current user, or 401 |
| POST | `/api/checkout` | user | Header `Idempotency-Key`. Body `{items:[{offer_id, quantity}], card_number}`. Returns 201 for a new order, 200 for a replay of an existing order, 402 declined, 409 out of stock or inactive (names the offer), 422 invalid |
| GET | `/api/orders` | user | The current user's orders, newest first |
| GET | `/api/orders/{id}` | user | Order with items and key codes. 404 if it belongs to someone else |

### Frontend routes

`/` homepage · `/store` (also the search results page) · `/product/:slug` · `/cart` · `/checkout` (protected) · `/orders` and `/orders/:id` (protected) · `/login` · `/register`

## Homepage block design

**Backend**

`GET /api/home` → `HomepageService`:

1. Load `homepage_blocks WHERE is_active ORDER BY position`.
2. For each row, look up the provider for `type` in a registry. The registry is a type → class map bound in a service provider.
3. Call `provider->fetch(config)` inside a try/catch. If a provider throws, log the error and leave that block out. One broken block never takes down the page.
4. Leave out blocks with an unknown type or empty data.
5. Return `[{id, type, title, data}]`.

```php
interface BlockProvider {
    public function fetch(array $config): array;   // block-specific payload
}
```

| `type` | Provider | Data source |
|---|---|---|
| `hero_banner` | `BannerProvider` | `banners WHERE is_active ORDER BY position` |
| `best_sellers` | `BestSellersProvider` | Products ranked by `SUM(order_items.quantity)` over orders in the last 30 days (`config.days`, `config.limit`), with each product's from-price |
| `deals` | `DealsProvider` | For each product, its cheapest active in-stock offer, kept only if `price_cents < msrp_cents`, ordered by discount % (`config.limit`, `config.min_discount`) |

Adding a block type takes a provider class, one registry entry, a React component and one `blockRegistry` entry. Reordering, renaming or disabling blocks is a database update with no deploy.

**Frontend**

`HomePage` makes one `useQuery(['home'])` call and maps over the blocks: `blockRegistry[block.type]` → component (`HeroBanner`, `ProductCarousel`). Unknown types render `null`. Each block is wrapped in an error boundary. The frontend contains no titles, product IDs or ordering.

## Search approach

One `ProductSearch` class builds the query for both `/api/products` and `/api/search/suggest`.

1. **Normalize the input.** Trim, lower-case, collapse whitespace, and escape the LIKE wildcards `%` and `_`. An empty `q` turns search off: there's no `q` filter and the default sort is best-selling.
2. **Match and rank:**

```sql
SELECT p.*,
       CASE
         WHEN lower(p.title) = :q                 THEN 0   -- exact
         WHEN lower(p.title) LIKE :q || '%'       THEN 1   -- title prefix: "cyberp"
         WHEN lower(p.title) LIKE '% ' || :q || '%' THEN 2 -- word prefix: "ring" → "Elden Ring"
         ELSE 3                                            -- fuzzy: "eldn ring", "witcer"
       END                                  AS tier,
       word_similarity(:q, lower(p.title))  AS sim
FROM products p
WHERE (lower(p.title) LIKE :q || '%'
    OR lower(p.title) LIKE '% ' || :q || '%'
    OR :q <% lower(p.title))                -- pg_trgm word-similarity operator
  AND <platform / region / price filters>
ORDER BY tier, sim DESC, sales DESC, p.id
```

3. **Index.** `CREATE INDEX products_title_trgm ON products USING gin (lower(title) gin_trgm_ops)`. This one GIN index serves both the `LIKE '%…'` patterns and the `<%` operator. Queries must use `lower(title)` exactly so the expression index is used. Verified with `EXPLAIN`.
4. **Threshold.** Set per transaction with `SET LOCAL pg_trgm.word_similarity_threshold`. The starting value of 0.3 is tuned against the ranking test table, which lists about 15 typo and partial-name cases with their expected first result.
5. **Facets.** Platform counts apply every filter except the platform filter, and region counts apply every filter except the region filter. This is standard disjunctive faceting: you can see how many results picking another platform would give.
6. **Price filter and sort** use the product's from-price. Products with no stock have a NULL from-price, sort last, and are excluded when a price filter is set.

## Checkout transaction

The cart lives in localStorage as `[{offerId, quantity}]`. The client never sends or trusts prices.

`POST /api/checkout` → `CheckoutService::checkout(user, items, card, idempotencyKey)`:

1. **Validate.** 1–20 lines, quantity 1–10, distinct offer IDs, a card number present, and an `Idempotency-Key` header (UUID).
2. **Idempotency lookup.** If `(user_id, idempotency_key)` already has an order, return it with 200 and do nothing else.
3. **Check the card.** `4000 0000 0000 0002` → 402 `card_declined`. `4242 4242 4242 4242` → approved. Any other number → 422 "use a test card". This step is pure, so it runs before any locks are taken.
4. `BEGIN`
5. **Load and re-price.** Load the offers (`WHERE id IN … AND is_active`) and take prices from the database. A missing or inactive offer → 409 `offer_unavailable`.
6. **Claim keys.** For each line, in ascending `offer_id` order:
   ```sql
   SELECT id FROM keys
   WHERE offer_id = :offer AND status = 'available'
   ORDER BY id
   LIMIT :qty
   FOR UPDATE SKIP LOCKED;
   ```
   Fewer rows than `:qty` → `ROLLBACK`, 409 `out_of_stock` with the offer ID. The locks are released by the rollback.
7. **Create the order.** `INSERT orders` (status `paid`, total, idempotency_key, paid_at) and `INSERT order_items` with the price copied at purchase time.
8. **Mark keys sold.** `UPDATE keys SET status='sold', order_item_id=:item, sold_at=now() WHERE id = ANY(:ids)`.
9. `COMMIT` → 201 with the order and its key codes.

**Why a key can't be sold twice**
- A row lock taken in step 6 is held until commit. No other transaction can lock or update that key in the meantime.
- After commit the key's status is `sold`, so later queries never select it.
- The CHECK constraint (`sold` ⇔ `order_item_id` set) blocks any half-updated state.

**Why `SKIP LOCKED` and not plain `FOR UPDATE`.** With plain `FOR UPDATE … LIMIT n`, a second buyer blocks on rows the first buyer has locked. After the first buyer commits, Postgres re-checks those rows, sees `status='sold'` and drops them. It does **not** go and find replacement rows, so the second buyer gets fewer than `n` keys and a false "out of stock" while other keys are free. `SKIP LOCKED` moves straight to unlocked keys, so buyers neither wait on each other nor see phantom shortages.

**Concurrent duplicate requests.** Two requests with the same Idempotency-Key can both pass step 2. The UNIQUE index on `(user_id, idempotency_key)` makes the second `INSERT orders` wait for the first transaction. When that one commits, the second insert fails with a unique violation. The service catches it, rolls back (freeing its key locks) and returns the existing order with 200.

## Authentication

- Sanctum **SPA mode** with a session cookie (`httpOnly`, `Secure`, `SameSite=Lax`) set on the Vercel origin through the rewrite. No token is stored in JavaScript.
- Login and register first call `GET /sanctum/csrf-cookie`. The fetch client then sends `X-XSRF-TOKEN` (read from the `XSRF-TOKEN` cookie) on every request that changes state.
- `SANCTUM_STATEFUL_DOMAINS=<app>.vercel.app,localhost:5173`. `TrustProxies` trusts all proxies (Vercel → Render's load balancer), so the scheme and host are detected correctly.
- Rate limiting: login is limited to 5 attempts per minute per email+IP (Laravel's built-in limiter).
- Frontend: a `RequireAuth` route wrapper checks `/api/me` through TanStack Query. If the user isn't signed in, it redirects to `/login?next=<path>`.

## Deployment

| Piece | Setup |
|---|---|
| **Neon** | Free project with Postgres 16 in AWS Frankfurt (`aws-eu-central-1`, next to Render; the region can't be changed later). Branches: `main` (production), `dev` (local app) and `test` (local test suite, wiped by tests). `pg_trgm` 1.6 is available; `CREATE EXTENSION pg_trgm` runs in a migration. The app uses the **direct (non-pooled)** connection string with `sslmode=require`. At this traffic level pooling isn't needed, and the direct connection avoids PgBouncer issues with prepared statements. Free computes suspend after 5 minutes idle. |
| **Render** | Free web service in Frankfurt, built from `backend/Dockerfile` (based on `serversideup/php:8.4-fpm-nginx`, nginx on port 8080). There is no custom entrypoint: the image's Laravel automations (`AUTORUN_ENABLED=true`) run `migrate --force` (waiting up to 60 s for the database) and `optimize` on every container start. Seeding is enabled in M1 with `AUTORUN_LARAVEL_MIGRATION_SEED=true`; the seeder is idempotent and skips if products already exist, because Render free has no shell and no pre-deploy hook. Non-secret defaults (`APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `CACHE_STORE=database`) are baked into the image. Dashboard env: `APP_KEY`, `APP_URL`, `DB_URL`, `SESSION_SECURE_COOKIE=true`, `PORT=8080`, and `SANCTUM_STATEFUL_DOMAINS` from M5. |
| **Vercel** | Project root `frontend/`, build `npm run build`, output `dist/`. `vercel.json` is shown below. |
| **Keep-warm** | Render free sleeps after 15 minutes idle, and a cold start takes about a minute. Vercel waits up to 120 s for an external rewrite, so the first request is slow rather than failing. A free cron-job.org job hitting `https://<app>.vercel.app/api/health` every 10 minutes avoids the wait (deferred from M0). One always-on service uses about 744 of Render's 750 free hours a month. |
| **Local dev** | No Docker: `backend/.env` points at the Neon `dev` branch and `backend/.env.testing` at `test`. `php artisan serve`, `npm run dev`. The Vite dev server proxies `/api` and `/sanctum` to `localhost:8000`, which mirrors the single origin used in production. |

`vercel.json` (rule order matters). Vercel projects created after 2026-04-06 cache external-rewrite responses according to their `Cache-Control` headers, so the `headers` block turns that off for the API and Sanctum routes:

```json
{
  "rewrites": [
    { "source": "/api/:path*",     "destination": "https://<api>.onrender.com/api/:path*" },
    { "source": "/sanctum/:path*", "destination": "https://<api>.onrender.com/sanctum/:path*" },
    { "source": "/(.*)",           "destination": "/index.html" }
  ],
  "headers": [
    { "source": "/api/:path*",     "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }] },
    { "source": "/sanctum/:path*", "headers": [{ "key": "x-vercel-enable-rewrite-caching", "value": "0" }] }
  ]
}
```

## Testing strategy

| Layer | Tool | What it covers |
|---|---|---|
| Backend feature tests | Pest + Postgres (Neon `test` branch locally, `postgres:16` service in CI) | Every endpoint. Store filters, sorts, pagination and facets. Auth guards. Checkout: happy path, declined card, out of stock, inactive offer, idempotent replay, ignored price tampering, another user's order → 404. Homepage: ordering, inactive blocks hidden, a failing provider skipped |
| Search ranking | Pest dataset | About 15 `(query → expected first slug)` cases covering typos, partial names, word prefixes and case. An `EXPLAIN` check confirms the GIN index is used |
| Concurrency | Pest + `Process::pool` | 20 OS processes each run `CheckoutService` (through a small artisan command) against one offer with 5 keys. The test asserts 5 orders, 15 `out_of_stock` results, 5 distinct sold keys and 0 available keys. It uses `DatabaseMigrations`/truncation instead of transaction rollback, so the worker processes can see the seeded rows |
| Frontend unit | Vitest + Testing Library | Cart store (add, merge, clamp, persist), `blockRegistry` (unknown type → nothing), Store URL ↔ filter state mapping |
| End to end | Playwright | One happy path: typo search → product → add offer → cart → login → pay with 4242 → key shown → visible in order history |
| CI | GitHub Actions | Backend: `pint --test`, `pest`. Frontend: `oxlint`, `tsc -b`, `vitest`, `vite build`. Runs on every push and PR |
