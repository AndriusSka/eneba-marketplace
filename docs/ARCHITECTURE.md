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

The browser only ever talks to the Vercel origin, and Vercel proxies API calls to Render. So the session cookie is first-party, Sanctum's cookie-based SPA auth works, and CORS stays closed (see [Authentication](#authentication)).

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

All money is stored as integer euro cents (`*_cents`). Tables that own a price (`products`, `offers`, `orders`) also record `currency char(3) DEFAULT 'EUR'` with `CHECK (currency = 'EUR')`: the currency is explicit in the data, but mixing currencies stays impossible until it is deliberately supported (SPEC.md keeps multi-currency out of scope). `order_items` take the order's currency. Every foreign key is indexed, and so is every column the Store filters or sorts by. Constraints and custom indexes have explicit names. Timestamps (`created_at`, `updated_at`) are omitted below.

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
| `products` | id, slug, title, platform_id, region_id, description, cover_url, release_date NULL (gift cards have none), msrp_cents, currency | `slug` UNIQUE. GIN `gin_trgm_ops` index `products_title_trgm` on `lower(title)` for search. Indexes on platform_id, region_id and release_date (newest sort). `msrp_cents > 0`. `currency = 'EUR'` |
| `sellers` | id, name, rating (numeric 3,2) | `rating BETWEEN 0 AND 5` |
| `offers` | id, product_id, seller_id, price_cents, currency, is_active | UNIQUE (product_id, seller_id). Partial index `offers_active_product_price` on `(product_id, price_cents) WHERE is_active` for the from-price, price sort and price filter. `price_cents > 0`. `currency = 'EUR'` |
| `keys` | id, offer_id, code, status, order_item_id NULL, sold_at NULL | `code` UNIQUE. `status IN ('available','sold')`. CHECK: `status='sold'` ⇔ `order_item_id IS NOT NULL`. Partial index `keys_available_offer` on `(offer_id, id) WHERE status='available'`: it serves stock counts and the checkout claim's `ORDER BY id LIMIT n` |
| `users` | Laravel default (id, name, email, password) | `email` UNIQUE |
| `sessions` | Laravel database session driver | Render's disk is ephemeral, so file sessions would be lost |
| `orders` | id, user_id, status, total_cents, currency, idempotency_key (uuid), paid_at | UNIQUE (user_id, idempotency_key). Index on `(user_id, created_at)` for history and on `paid_at` for the best-sellers window. `status IN ('paid')`, with room for later states. `total_cents >= 0`. `currency = 'EUR'` |
| `order_items` | id, order_id, offer_id, unit_price_cents, quantity | `quantity BETWEEN 1 AND 10`. `unit_price_cents > 0`. The price is copied at purchase time |
| `banners` | id, title, subtitle, image_url, link_url, position, is_active | Partial index on `(position) WHERE is_active` |
| `homepage_blocks` | id, type, title, position, is_active, config jsonb | `type` is the provider key. `config` holds e.g. `{"limit": 12}`. Partial index on `(position) WHERE is_active` |

Derived values (not stored):
- **Stock of an offer** = `COUNT(keys WHERE status='available')`.
- **Product "from" price** = the lowest `price_cents` among active offers that have stock.
- **Sales of a product** = `SUM(order_items.quantity)` over its offers.
- **Discount** = `1 − price_cents / msrp_cents`.

At this catalog size (about 80 products) these are cheap aggregates. Denormalized counters would only be worth adding once profiling shows a need.

There is no cart table: the cart is client state (see Checkout).

### Seed data

`DatabaseSeeder` loads a fixed catalog from `database/seeders/data/catalog.php`: 4 platforms, 3 regions, 5 invented sellers, and 30 products (24 games and 6 gift cards) with 2–5 offers each and 0–15 keys per offer. It also creates a demo user (`demo@example.com` / `password`) and 4 shoppers with 20 past orders that sold real keys, plus 3 banners and the 3 homepage blocks. Structure and prices come from `mt_rand` with a fixed seed, so every environment gets the same catalog. Key codes use `random_int`. Each product has its own cover, `frontend/public/covers/{slug}.svg`. They are made by `backend/scripts/generate-covers.php`, which reads the same catalog file and builds the same slugs as the seeder. Each cover is an original genre scene (fantasy peaks, neon city, desert, gift card…) in the DESIGN.md palette with the title set on it: no game's art, logo or cover layout. The same script draws the three hero banners (moonlit peaks, a fan of gift cards, discount tags over a falling price line) into the `image_url` each banner already has (`frontend/public/placeholders/banner-N.svg`), so changing the art never needs a database update. Banners are 2:1 with the art kept clear of the title band at the bottom. Both are served same-origin. The seeder does not use Faker, because Faker is a dev dependency missing from the production image. It skips when products already exist, and runs inside one transaction with bulk inserts (the database is remote).

## API

REST/JSON under `/api`. Errors use one shape: `{ "message": string, "errors"?: {field: [msg]}, "code"?: string, "offer_id"?: int }`. `offer_id` appears on checkout 409s.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | Liveness plus a DB ping. Used by the uptime pinger |
| GET | `/api/home` | – | Ordered homepage blocks with their data: `{data: [{id, type, title, link_url\|null, data: [...]}]}`. See [Homepage block design](#homepage-block-design) |
| GET | `/api/products` | – | Store listing: `q`, `platform[]`, `region[]`, `min_price`, `max_price` (cents), `sort` (`relevance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `page`. Returns `{data, meta:{page, per_page, total, last_page}, facets:{platforms:[{slug,name,count}], regions:[…], price:{min_cents,max_cents}}}`. See [Store API](#store-api) |
| GET | `/api/search/suggest?q=` | – | Top 6 matches for autocomplete (same engine and order as the listing). `{data: [product]}` with the Store's product fields. Empty `q` → `{data: []}`; `q` over 100 chars → 422 |
| GET | `/api/products/{slug}` | – | Product details plus active offers (seller, price, stock, discount), in stock first, then by price. 404 `{"message":"Not found."}` for an unknown slug |
| POST | `/api/cart/quote` | – | `{items:[{offer_id, quantity}]}` (same rules as checkout) → current price, stock and line totals per item, plus warnings. See [Cart quote](#cart-quote) |
| GET | `/sanctum/csrf-cookie` | – | Sets the `XSRF-TOKEN` cookie before login/register |
| POST | `/api/register` | – | Create an account and sign in |
| POST | `/api/login` | – | Sign in (rate-limited) |
| POST | `/api/logout` | user | Sign out |
| GET | `/api/me` | user | Current user, or 401 |
| POST | `/api/checkout` | user | Header `Idempotency-Key`. Body `{items:[{offer_id, quantity}], card_number}`. Returns 201 for a new order, 200 for a replay of an existing order, 402 `card_declined`, 409 `out_of_stock` or `offer_unavailable` (the message names product and seller, `offer_id` says which line), 422 invalid. Fields other than ids, quantities and the card are ignored |
| GET | `/api/orders` | user | The current user's orders, newest first (`created_at`, then `id`), with items but no key codes |
| GET | `/api/orders/{id}` | user | Order with items and key codes. Someone else's order, a missing id and a non-numeric id all give the same 404 |

Order bodies are `{id, status, total_cents, currency, paid_at, item_count, items:[{id, offer_id, product{id,slug,title,cover_url,platform,region}, seller{id,name}, unit_price_cents, quantity, line_total_cents, keys?:[{id, code}]}]}`. Every response that can carry key codes (checkout and orders) sends `Cache-Control: no-store, private`.

### Cart quote

`POST /api/cart/quote` → `CartQuoteService`. It reads, it reserves nothing. Response: `{data: {lines, total_cents, currency, checkout_ready}}`, one line per requested item in request order:

`{offer_id, requested_quantity, quantity, stock, unit_price_cents|null, line_total_cents, warning|null, product|null, seller|null}`

| `warning` | When | `quantity` |
|---|---|---|
| `null` | Active, enough stock | as requested |
| `quantity_reduced` | requested > stock > 0 | the stock |
| `out_of_stock` | stock = 0 | 0 |
| `inactive` | The offer is switched off | 0 |
| `unavailable` | No offer has this id (a stale browser cart). `product`, `seller` and the price are `null` | 0 |

`total_cents` sums what can be bought now. `checkout_ready` is true when there is at least one line and no line has a warning other than `quantity_reduced`. The cart page lowers the stored quantity to match a `quantity_reduced` line and says so, and blocks checkout until unbuyable lines are removed.

### Store API

Implemented by `ProductController` → `ProductCatalog` (`app/Services/Catalog/`). One `applyFilters()` serves both the results and the facets, so the two can't drift apart.

**`GET /api/products` parameters**

| Param | Rules | Default |
|---|---|---|
| `q` | ≤ 100 chars. Trimmed, lower-cased and whitespace collapsed. Matches a substring of `lower(title)` (LIKE wildcards escaped) or a title whose word similarity is ≥ 0.35 (typos). See [Search approach](#search-approach) | – |
| `platform[]`, `region[]` | Slugs, ≤ 10 each. OR within a dimension, AND across dimensions. An unknown slug matches nothing | all |
| `min_price`, `max_price` | Integer cents, inclusive, 0–1 000 000, `max ≥ min`. They apply to the from-price, so setting either one drops out-of-stock products | – |
| `sort` | `relevance` (tier, then sales), `price_asc` / `price_desc` (out of stock last), `newest` (no release date last), `bestselling` (all-time units sold). Every sort ends on `id`, so pages are stable. `relevance` without `q` becomes `bestselling` | `relevance` if `q` is set, otherwise `bestselling` |
| `page` | 1–1000, with 24 products per page. A page past the end returns `data: []` with the real `meta` | 1 |

Invalid parameters return 422.

**Fields**

- **Each product in `data`** has `id, slug, title, cover_url, platform{slug,name}, region{slug,name}, release_date|null, msrp_cents, currency, from_price_cents|null, discount_percent|null, in_stock`.
- **Facets** list every platform and every region (zero counts included), sorted by name. `price` is `{min_cents, max_cents}`, or both `null` when nothing is in stock.
- **`discount_percent`** is `floor(100 · (msrp − price) / msrp)`. It is `null` unless the price is at least 1% below MSRP. The rule lives in `App\Support\Discount`.
- **`GET /api/products/{slug}`** adds `description` and `offers[]` to the product fields.
  - Each offer has `id, seller{id,name,rating}, price_cents, currency, discount_percent|null, stock, in_stock`.
  - `rating` is a JSON number, and `stock` counts available keys only.
  - Offers are active ones only, in stock first, then by price, then `id`. So `offers[0]` is the best offer whenever any offer is in stock.

**Store URL.** The SPA keeps the same names and cents in the browser URL, but repeats plain keys for lists (`?platform=steam&platform=xbox`). `frontend/src/features/store/storeParams.ts` maps between the URL, the state and the API query. It parses leniently: invalid values are dropped, so a hand-edited URL never causes a 422. Every committed change pushes a history entry, so Back restores the previous filters.

### Frontend routes

`/` homepage · `/store` (also the search results page) · `/product/:slug` · `/cart` · `/checkout` (protected) · `/orders` and `/orders/:id` (protected) · `/login` · `/register`

## Homepage block design

**Backend**

`GET /api/home` → `HomepageService`:

1. Load `homepage_blocks WHERE is_active ORDER BY position, id`.
2. For each row, look up the provider for `type` in `BlockProviderRegistry`. The registry is a type → class map bound in `AppServiceProvider`, and it resolves providers through the container.
3. Call `provider->fetch(config)` inside a try/catch on `Throwable`. If a provider throws, log an error (block id, type, exception) and leave that block out. One broken block never takes down the page.
4. Leave out blocks with empty data. Leave out blocks with an unknown type and log a warning, so a typo in `type` shows up in the logs.
5. Return `{data: [{id, type, title, link_url, data}]}`.

```php
interface BlockProvider {
    public function fetch(array $config): array;   // list of the block's items; [] hides the block
}
```

| `type` | Provider | Data source | `data` items |
|---|---|---|---|
| `hero_banner` | `BannerProvider` | `banners WHERE is_active ORDER BY position, id` | `{id, title, subtitle\|null, image_url, link_url}` |
| `best_sellers` | `BestSellersProvider` | Products ranked by `SUM(order_items.quantity)` over orders paid in the last `config.days` days, then by id. Sold-out products (no from-price) are left out, so every homepage card can be bought | Store product fields |
| `deals` | `DealsProvider` | Products whose from-price (their cheapest active in-stock offer) is below MSRP by at least `config.min_discount` percent, using the same floor as `discount_percent`. Biggest discount first, then id | Store product fields |

**Config.** `config` is edited by hand in the database, so every value is optional. A missing or non-integer value takes the default, an out-of-range one is clamped, and a config that isn't a JSON object counts as `{}`.

| Key | Blocks | Default | Range |
|---|---|---|---|
| `limit` | `hero_banner` | 5 | 1–10 |
| `limit` | `best_sellers`, `deals` | 12 | 1–24 |
| `days` | `best_sellers` | 30 (seeded as 90, because production is seeded once and its orders age) | 1–365 |
| `min_discount` | `deals` | 1 (seeded as 10) | 1–99 |
| `link_url` | any | none | A same-site path for the block's "View all" link (seeded as `/store?sort=bestselling` on best sellers). Anything else, such as absolute, protocol-relative or `javascript:` URLs, becomes `null` |

Adding a block type takes a provider class, one registry entry, a React component and one `blockRegistry` entry. Reordering, renaming or disabling blocks is a database update with no deploy.

**Frontend**

`HomePage` makes one `useQuery(['home'])` call, which checks only the block envelope. It drops the blocks `canRenderBlock` rejects and renders the rest in API order, each in its own full-width band, with every second band on `surface` (by position, not type). Each block is wrapped in `BlockErrorBoundary`, and `HomeBlockView` (`src/blocks/HomeBlockView.tsx`) looks its type up in `blockRegistry` (`src/blocks/blockRegistry.tsx`). Each entry pairs a data guard with a component (`HeroBanner`, `ProductCarousel`).

A block renders `null` when:
- its type is unknown (looked up with `Object.hasOwn`, so `toString` doesn't match), or
- its data fails the guard.

Banner links that aren't same-site paths or http(s) URLs render without a link. The frontend contains no titles, product IDs or ordering.

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

   In the code the WHERE is `lower(title) LIKE '%' || :q || '%' OR :q <% lower(title)`: any substring still matches, as in M2, and tier 3 holds both substring and fuzzy matches, ordered by `sim`.

3. **Index.** `CREATE INDEX products_title_trgm ON products USING gin (lower(title) gin_trgm_ops)`. This one GIN index serves both the `LIKE '%…'` patterns and the `<%` operator. Queries must use `lower(title)` exactly so the expression index is used. `SearchTest` runs `EXPLAIN` on the real Store query (with seq scans off, since 30 rows always seq-scan) and expects a `Bitmap Index Scan on products_title_trgm` with the `%>` condition, pushed down into the catalog subquery.
4. **Threshold: 0.35.** `<%` reads `pg_trgm.word_similarity_threshold` (default 0.6, far too strict). `ProductSearch::within()` sets it with `set_config(…, true)` inside a transaction around every search query (results, count, facets, suggestions), so it never leaks to another request on a pooled connection. How the value was chosen is covered below.
5. **Facets.** Platform counts apply every filter except the platform filter, and region counts apply every filter except the region filter. This is standard disjunctive faceting: you can see how many results picking another platform would give.
6. **Price filter and sort** use the product's from-price. Products with no stock have a NULL from-price, sort last, and are excluded when a price filter is set.
7. **Header search box** (`frontend/src/features/search/SearchBox.tsx`). It waits 250 ms after typing stops, needs at least 2 characters, and shows up to 6 suggestions. ↑/↓ pick a row and Enter opens it. Enter with no row picked opens `/store?q=…` with no other filters, Esc closes the list. On `/store` the box shows the current `q`; it is the Store's only name input.

### Why `word_similarity`, not whole-title `similarity`

Two pg_trgm designs were compared on the 30 seeded titles before building:

| Query → expected | `word_similarity` (best extent of the title) | `similarity` (whole title) |
|---|---|---|
| witcher → The Witcher 3: Wild Hunt | 1.000 | 0.364 |
| wticher → The Witcher 3: Wild Hunt | 0.400 | 0.154 |
| witcer → The Witcher 3: Wild Hunt | 0.571 | 0.208 |
| cyberpnk → Cyberpunk 2077 | 0.667 | 0.412 |
| cyberp (typing) → Cyberpunk 2077 | 0.857 | 0.375 |
| zelda → The Legend of Zelda: … | 1.000 | 0.182 |
| best wrong title for a real query (hogwarts → Hollow Knight) | 0.222 | 0.095 |

Whole-title `similarity` is diluted by title length. "wticher" (0.154) and "zelda" (0.182) score inside the noise band (about 0.10–0.19), so no threshold finds them without letting junk through, and short titles outrank better matches. `word_similarity` scores the query against the best-matching part of the title, so short queries against long titles and half-typed prefixes both score high. `strict_word_similarity` was also measured; it scores prefixes lower (cyberp 0.545), which is worse for autocomplete.

### How the threshold was chosen

`word_similarity` was measured for 20 realistic typos (which should match) and 15 real games we don't sell (which should match nothing):

| Group | Scores |
|---|---|
| Typos, lowest | wticher 0.400, fiaf 0.400, sekrio 0.429, eldne / hadse / minecarft / starfeild 0.500. All the others are ≥ 0.57 |
| Not sold, highest | banana → Baldur's Gate 3, fortnite → Forza Horizon 5 and valorant → Stardew Valley 0.333; tetris, diablo 0.286; gta, zzz 0.250; nonsense ≤ 0.167 |

The groups are separated by a gap from **0.333 to 0.400**, and 0.35 sits inside it. Trigram scores are ratios of small counts (2/6 = 0.333, 2/5 = 0.4), so a threshold placed exactly on 0.333 or 0.4 would depend on whether the comparison is `>` or `>=`. The starting value of 0.3 would let banana, fortnite and valorant through.

`SearchTest` pins both sides: the typo dataset includes the two 0.400 cases, and the no-results dataset includes the three 0.333 cases. A mutation run confirmed it: at 0.30 the three 0.333 queries return results, and at 0.45 "wticher" and "fiaf" find nothing.

**Known limits**, accepted and not tested as passing:
- "halo" finds Hades (0.400). It is the same trigram arithmetic as "fiaf" → FIFA 23, so no threshold separates them. The result ranks as a fuzzy match.
- A transposition inside a short word, such as "zleda" (0.200), breaks most of its trigrams and is not found.
- Abbreviations ("gta" for Grand Theft Auto) are out of scope.

## Checkout transaction

The cart lives in localStorage (`cart:v1`) as `[{offerId, quantity}]`, read through `useSyncExternalStore` (`features/cart/cartStore.ts`). It is parsed leniently (bad entries dropped, duplicates merged), capped at 10 per line and 20 lines, falls back to memory when storage is blocked, and syncs across tabs through the `storage` event. The client never sends or trusts prices.

The checkout page creates one `Idempotency-Key` per attempt (`useIdempotencyKey`). It keeps the key after a network error or a 5xx, so pressing Pay again replays rather than charges twice, and makes a new one after any 4xx answer. A ref guards Pay against a double click within one render.

`POST /api/checkout` → `CheckoutService::checkout(user, items, card, idempotencyKey)`:

1. **Validate** (`CheckoutRequest`). 1–20 lines, quantity 1–10, distinct offer IDs, a card number present, and an `Idempotency-Key` header (UUID, compared lower-cased). A bad header is a 422 on `idempotency_key`.
2. **Idempotency lookup.** If `(user_id, idempotency_key)` already has an order, return it with 200 and do nothing else, even if the retry carries a different cart.
3. **Check the card** (`TestCards`, spaces and dashes ignored). `4000 0000 0000 0002` → 402 `card_declined`. `4242 4242 4242 4242` → approved. Any other number → 422 on `card_number`. This step is pure, so it runs before any locks are taken.
4. `BEGIN`
5. **Load and re-price.** Load the offers by id and take prices from the database. A missing or inactive offer → 409 `offer_unavailable`.
6. **Create the order** (the idempotency claim). `INSERT orders` (status `paid`, total from the DB prices, idempotency_key, paid_at). It goes in before any key is claimed, so a concurrent duplicate waits here on the UNIQUE index without holding a key lock (see below).
7. **Claim keys.** For each line, in ascending `offer_id` order:
   ```sql
   SELECT id FROM keys
   WHERE offer_id = :offer AND status = 'available'
   ORDER BY id
   LIMIT :qty
   FOR UPDATE SKIP LOCKED;
   ```
   Fewer rows than `:qty` → `ROLLBACK`, 409 `out_of_stock` with the offer ID. The rollback releases every lock, including those on earlier lines, and removes the order row.
8. **Order line and keys.** `INSERT order_items` with the price copied at purchase time, then `UPDATE keys SET status='sold', order_item_id=:item, sold_at=now() WHERE id = ANY(:ids) AND status='available'`. If the updated count isn't the claimed count, the service throws and everything rolls back (defence in depth; it can't happen under the locks).
9. `COMMIT` → 201 with the order and its key codes.

`CheckoutException` (402/409) renders the error body itself and is never logged: it is an expected outcome, not a fault.

**Why a key can't be sold twice**
- A row lock taken in step 7 is held until commit. No other transaction can lock or update that key in the meantime.
- After commit the key's status is `sold`, so later queries never select it.
- The CHECK constraint (`sold` ⇔ `order_item_id` set) blocks any half-updated state.

**Why `SKIP LOCKED` and not plain `FOR UPDATE`.** Both are correct; they differ in waiting. With plain `FOR UPDATE`, the second buyer blocks on the first buyer's locked rows until that transaction ends, and with 20 buyers on one offer every buyer waits in line behind the ones before it. (Postgres applies the row lock below the `LIMIT`, so a waiter whose row turned out sold moves on to the next row; it does not come back short. The first draft of this document said otherwise. A mutation run with plain `FOR UPDATE` showed the race test still passing, only slower.) `SKIP LOCKED` lets each buyer take the next unlocked key at once, so buyers don't wait on each other at all. The trade-off: if the only free keys are locked by a checkout that later rolls back, this buyer gets a 409 that a retry would not get. `CheckoutLockingTest` pins the no-wait behaviour.

**Concurrent duplicate requests.** Two requests with the same Idempotency-Key can both pass step 2. Because the order row is inserted before any key is claimed (step 6), the second `INSERT orders` waits on the UNIQUE index for the first transaction while holding no key lock. When the first commits, the second insert fails with a unique violation; the service catches it after the rollback and returns the existing order with 200. If the first rolls back instead (for example out of stock), the second carries on as a normal checkout. So a retry never competes with its own original for keys, and never sees a false "out of stock" from it.

## Authentication

- Sanctum **SPA mode** with a session cookie (`httpOnly`, `Secure`, `SameSite=Lax`) set on the Vercel origin through the rewrite. No token is stored in JavaScript. Sanctum's API tokens are not used: the frontend and backend are on different hosts, but the browser only ever sees the Vercel origin, so the cookie is first-party.
- **CSRF.** Before its first state-changing request, `sendJson` in `src/api/client.ts` calls `GET /sanctum/csrf-cookie` if there is no `XSRF-TOKEN` cookie. It then sends that cookie's value as `X-XSRF-TOKEN`. On a 419 (the token expired with the session) it fetches a new cookie and retries once.
- **Stateful domains.** `SANCTUM_STATEFUL_DOMAINS` defaults to `localhost:5173` in `config/sanctum.php`. The `Dockerfile` sets it to the Vercel host. `TrustProxies` trusts all proxies (Vercel → Render's load balancer), so the scheme and host are detected correctly.
- **Sign-in.**
  - Emails are lower-cased and trimmed.
  - A failed sign-in returns 422 with the same message for an unknown email and a wrong password.
  - After 5 failures a minute per email+IP, sign-in returns 429 with the message on the `email` field, even for the right password.
  - A successful sign-in regenerates the session id.
  - Logout invalidates the session on the server.
  - Passwords are bcrypt-hashed by the `hashed` cast on `User`.
- **CORS is closed.** `config/cors.php` has `allowed_origins => []` and `supports_credentials => false`, so no origin gets an `Access-Control-Allow-Origin` header, preflights included. Laravel's unpublished default allowed every origin on `api/*`. It was live from M0 to M5 without anyone choosing it. The SPA never needs CORS, because it is same-origin through the Vercel rewrite and the Vite proxy.
- **Frontend.**
  - The signed-in state is the TanStack Query `['me']` query: a user, or `null` (a 401 from `/api/me` is an answer, not an error).
  - `RequireAuth` (`features/auth/`) redirects a guest to `/login?next=<path>`.
  - The header's "Sign in | Register" links carry `next` too.
  - `safeNext` accepts only a path on this site, which blocks open redirects such as `//evil.com`.

**Where the credential lives, and the trade-off.** The credential is the Laravel session cookie. It is `httpOnly`, so JavaScript can't read it, and the session row lives in Postgres. Nothing is kept in localStorage or React state. On a reload, the SPA asks `/api/me` and the browser attaches the cookie. The only cookie JavaScript reads is `XSRF-TOKEN`, and it is not a credential.

What this gains, compared with a bearer token in localStorage:
- An XSS bug can't read the credential and take it away.
- Logout ends the session on the server.
- The client has no token to refresh or rotate.

What it costs:
- CSRF has to be handled: the cookie round trip, the header and the 419 retry. `SameSite=Lax` is a second layer.
- It works only while the API is same-origin. Calling Render directly from the browser would break it.
- Every authenticated request reads a session row.
- Non-browser clients would need tokens.
- An XSS can still send requests *as* the user while the page is open. It just can't keep the credential.

## Deployment

| Piece | Setup |
|---|---|
| **Neon** | Free project with Postgres 16 in AWS Frankfurt (`aws-eu-central-1`, next to Render; the region can't be changed later). Branches: `main` (production), `dev` (local app) and `test` (local test suite, wiped by tests). `pg_trgm` 1.6 is available; `CREATE EXTENSION pg_trgm` runs in a migration. The app uses the **direct (non-pooled)** connection string with `sslmode=require`. At this traffic level pooling isn't needed, and the direct connection avoids PgBouncer issues with prepared statements. Free computes suspend after 5 minutes idle. |
| **Render** | Free web service in Frankfurt, built from `backend/Dockerfile` (based on `serversideup/php:8.4-fpm-nginx`, nginx on port 8080). There is no custom entrypoint: the image's Laravel automations (`AUTORUN_ENABLED=true`) run `migrate --force --seed` (waiting up to 60 s for the database) and `optimize` on every container start. `AUTORUN_LARAVEL_MIGRATION_SEED=true` adds `--seed`. The seeder fills an empty database on the first deploy and skips once products exist, because Render free has no shell and no pre-deploy hook. Non-secret defaults (`APP_ENV=production`, `APP_DEBUG=false`, `LOG_CHANNEL=stderr`, `DB_CONNECTION=pgsql`, `SESSION_DRIVER=database`, `CACHE_STORE=database`, and `SANCTUM_STATEFUL_DOMAINS=<app>.vercel.app` from M5) are baked into the image. Dashboard env: `APP_KEY`, `APP_URL`, `DB_URL`, `SESSION_SECURE_COOKIE=true`, `PORT=8080`. |
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
| Concurrency | Pest + `Process::pool` | `CheckoutConcurrencyTest`: OS processes each run `CheckoutService` through `php artisan checkout:simulate` (a closure command in `routes/console.php`, not registered in production). Each worker connects first, then sleeps until a shared `--start-at` time so they all fire together. Cases: 20 buyers / 5 keys → 5 created, 15 `out_of_stock`, 5 distinct sold keys, 0 available; 2 buyers / 1 key → 1 and 1; 10 copies of one request with one Idempotency-Key → 1 order, 9 replays. It uses `DatabaseTruncation` (and truncates again afterwards) instead of transaction rollback, so the workers see committed rows. Removing the lock entirely makes it fail |
| Key locking | Pest + a second DB connection | `CheckoutLockingTest`: another connection holds `FOR UPDATE` on a key mid-transaction. Checkout then takes the *next* key without waiting, or answers 409 at once when every free key is locked. `lock_timeout` is 3 s, so a missing `SKIP LOCKED` fails fast instead of hanging (mutation-checked) |
| Frontend unit | Vitest + Testing Library | Cart store (add, merge, clamp, persist), `blockRegistry` (unknown type → nothing), Store URL ↔ filter state mapping |
| End to end | Playwright | One happy path: typo search → product → add offer → cart → login → pay with 4242 → key shown → visible in order history |
| CI | GitHub Actions | Backend: `pint --test`, `pest`. Frontend: `oxlint`, `tsc -b`, `vitest`, `vite build`. Runs on every push and PR |
