> The Store and Product page milestones from @docs/PLAN.md, styled with the
> tokens in @docs/DESIGN.md.
> Goal:

- GET /api/products with filters (platform, region, price min/max), sorting
  (price up/down, newest), a name filter and pagination; a Store page that uses
  it.
- GET /api/products/{slug} with details and all offers; a product page
  listing offers by price, with seller name, rating and an "Add to cart" button
  per offer (wired up in the checkout session).
  Constraints: filters live in the URL query string; a card shows the lowest
  offer price; offers with no unsold keys are shown disabled.
  Done when: backend tests cover each filter, one sort, pagination and a
  sold-out offer; an unknown slug shows a 404 page; the back button restores
  the previous filters.
  Propose the API contract (query params + response JSON) first.
  ⎿  Read docs\PLAN.md (139 lines)
  ⎿  Read docs\DESIGN.md (197 lines)

Read 2 files (ctrl+o to expand)

● 2 background agents launched (↓ to manage)
├ Explore backend structure
└ Explore frontend structure

● While the two explorers run, I'll start drafting the API contract in the plan
file.

● Updated plan
⎿  /plan to preview

● Agent "Explore frontend structure" finished · 35s

● The frontend report is in: it's still the M0 skeleton, with no @theme tokens
yet and covers at 3:4. I'm waiting on the backend explorer.

Searched for 1 pattern, read 2 files (ctrl+o to expand)

● Agent "Explore backend structure" finished · 52s

Ran 1 shell command (ctrl+o to expand)

● Exploration is done. M1 isn't merged into main yet, so this work would branch
from feat/m1-schema-seed. Next I'll write the full plan, with the API contract
up front.

● Updated plan
⎿  /plan to preview

● User answered Claude's questions:
⎿  · For the Store's name filter (`q`), PLAN puts the full typo-tolerant
ProductSearch in M3. What should M2 ship? → Substring now, fuzzy in M3
(Recommended)
· Which font should the @theme `--font-sans` use? (Metropolis isn't on
Google Fonts; self-hosting needs your approval for the font files.) → Arial
fallback for now (Recommended)

● Updated plan
⎿  /plan to preview

● Updated plan
⎿  /plan to preview

● I've written the plan with both of your choices in it, and the API contract at
the top is ready for your approval before any code is written. I'll go ahead
and wait for your sign-off on the contract. · summary

● User approved Claude's plan
⎿  Plan saved to:
~\.claude\plans\pasted-content-id-a211-the-store-declarative-kernighan.md ·
/plan to edit
M2 Store + M4 Product page

     Context

     The backend has its schema, models, factories and seed data from M1, but
     the only endpoint is /api/health. The frontend is still the M0 skeleton: no
     layout, no @theme tokens, and a GET-only getJson client.

     This change builds the Store listing (M2) and the Product page (M4), styled
     with the DESIGN.md tokens:
     - filters in the URL, so the back button restores them
     - the lowest in-stock offer price on each card
     - sold-out offers shown but disabled
     - a 404 page for an unknown slug

     The "Add to cart" button is rendered but not wired up; that happens in M6.

     Branch: feat/m2-m4-store-product, cut from feat/m1-schema-seed (M1 isn't
     merged into main yet).

     ---

     1. API contract (proposed)

     GET /api/products

     Param: q
     Type: string
     Rules: trimmed, lower-cased, whitespace collapsed, LIKE wildcards escaped;
     ≤
       100 chars; empty means no filter
     Default: –
     ────────────────────────────────────────
     Param: platform[]
     Type: platform slugs
     Rules: ≤ 10; unknown slugs match nothing
     Default: all
     ────────────────────────────────────────
     Param: region[]
     Type: region slugs
     Rules: same
     Default: all
     ────────────────────────────────────────
     Param: min_price, max_price
     Type: int cents, inclusive
     Rules: 0–1 000 000, max_price ≥ min_price; applied to the from-price;
     excludes
       out-of-stock products when set
     Default: –
     ────────────────────────────────────────
     Param: sort
     Type: relevance | price_asc | price_desc | newest | bestselling
     Rules: relevance without q falls back to bestselling
     Default: relevance if q is set, else bestselling
     ────────────────────────────────────────
     Param: page
     Type: int ≥ 1
     Rules: ≤ 1000; a page past the end returns data: [] with real meta
     Default: 1

     There is no per_page param; it is fixed at 24. Invalid params return 422 in
     the standard error shape. The frontend parses URLs leniently (it drops bad
     values), so the UI never triggers a 422.

     Sort details:
     - Price sorts: by from_price_cents, with NULLs (out of stock) last, then
       id.
     - newest: release_date DESC NULLS LAST (gift cards have no date), then id.
     - bestselling: sales DESC (all-time SUM(order_items.quantity)), then id.
     - relevance: tier (exact, then title prefix, then word prefix, then other
       substring), then sales, then id.

     Every sort ends on id, so pagination is stable.

     {
       "data": [{
         "id": 12,
         "slug": "elden-ring-steam-global",
         "title": "Elden Ring",
         "cover_url": "/placeholders/cover-3.svg",
         "platform": { "slug": "steam", "name": "Steam" },
         "region":   { "slug": "global", "name": "Global" },
         "release_date": "2022-02-25",      // null for gift cards
         "msrp_cents": 5999,
         "currency": "EUR",
         "from_price_cents": 3449,          // lowest price among active offers
     with ≥1 available key; null = out of stock
         "discount_percent": 43,            // floor(100·(msrp−from)/msrp); null
     unless from < msrp
         "in_stock": true
       }],
       "meta":   { "page": 1, "per_page": 24, "total": 30, "last_page": 2 },
       "facets": {
         "platforms": [{ "slug": "steam", "name": "Steam", "count": 9 }],     //
     every platform, zeros included, sorted by name
         "regions":   [{ "slug": "global", "name": "Global", "count": 14 }],
         "price":     { "min_cents": 499, "max_cents": 6999 }
     // null/null when nothing is in stock
       }
     }

     Facets are disjunctive:
     - Platform counts apply every filter except platform.
     - Region counts apply every filter except region.
     - The price range applies every filter except price, so the inputs can show
       the reachable bounds.

     GET /api/products/{slug}

     {
       "data": {
         "id": 12, "slug": "elden-ring-steam-global", "title": "Elden Ring",
         "description": "…", "cover_url": "/placeholders/cover-3.svg",
         "platform": { "slug": "steam", "name": "Steam" },
         "region":   { "slug": "global", "name": "Global" },
         "release_date": "2022-02-25", "msrp_cents": 5999, "currency": "EUR",
         "from_price_cents": 3449, "discount_percent": 43, "in_stock": true,
         "offers": [{
           "id": 41,
           "seller": { "id": 3, "name": "PixelVault", "rating": 4.8 },   //
     rating as a JSON number
           "price_cents": 3449, "currency": "EUR",
           "discount_percent": 43,          // null unless price < msrp
           "stock": 7,                      // available keys only; sold keys
     excluded
           "in_stock": true
         }]
       }
     }

     - offers contains active offers only; inactive offers are left out
       entirely.
     - Offers are ordered in stock first, then by price_cents ascending, then
       id. So offers[0] is the best offer whenever any offer is in stock.
     - Out-of-stock offers are included with stock: 0 and in_stock: false.
     - An unknown slug returns 404 {"message": "Not found."}.

     ---

     2. Backend (backend/)

     File: routes/api.php
     What: GET /products and GET /products/{slug}. The slug is a plain string,
     with
       no model binding, so the class name never leaks in the 404 message
     ────────────────────────────────────────
     File: app/Http/Requests/ProductIndexRequest.php
     What: The rules above. filters(): ProductFilters builds the value object,
       including the default sort
     ────────────────────────────────────────
     File: app/Services/Catalog/ProductFilters.php
     What: final readonly value object: q, platforms, regions, min/max, sort,
     page
     ────────────────────────────────────────
     File: app/Services/Catalog/ProductCatalog.php
     What: list(ProductFilters): ProductListResult and find(string $slug):
     Product
       (throws NotFoundHttpException)
     ────────────────────────────────────────
     File: app/Services/ProductSearch.php
     What: normalize(string): string and apply(Builder, string $q) (escaped
       substring match on lower(title) plus the relevance tier expression). M3
     adds
       the fuzzy <% branch, the threshold and suggest. Decided: substring now,
     fuzzy
        in M3
     ────────────────────────────────────────
     File: app/Http/Controllers/ProductController.php
     What: Thin index and show: request → service → resource
     ────────────────────────────────────────
     File: app/Http/Resources/ProductSummaryResource.php,
     ProductDetailResource.php,
       OfferResource.php
     What: The JSON shapes above; the listing adds meta and facets through
       ->additional()
     ────────────────────────────────────────
     File: app/Support/Discount.php
     What: percent(int $price, int $msrp): ?int, the one place the discount rule

       lives
     ────────────────────────────────────────
     File: bootstrap/app.php
     What: Render NotFoundHttpException on api/* as {"message":"Not found."}

     Query design (ProductCatalog).
     - A base query selects products.* plus two correlated subselects:
       - from_price_cents: MIN(offers.price_cents) WHERE is_active AND
         EXISTS(available key). This uses the offers_active_product_price and
         keys_available_offer indexes.
       - sales: COALESCE(SUM(order_items.quantity), 0) over the product's
         offers.
     - It is wrapped with Product::query()->fromSub($base, 'products') so
       filters and sorts can use the aliases and the rows still hydrate as
       Product models.
     - One private applyFilters(Builder, ProductFilters, ?string $except) serves
       the listing and all three facet queries, so the facets can never drift
       from the results.
     - Platform and region filters use whereIn on a subquery of slug → id.
     - Eager-load platform and region on the page of results.
     - Facet counts come from a GROUP BY platform_id query, merged in PHP with
       Platform::orderBy('name') so zero counts appear.

     At about 30 products that's 5 small queries per request.

     Product page.
     - Product::with(['platform', 'region'])->where('slug', $slug)->first().
     - The offers query: offers()->where('is_active',
       true)->with('seller')->withCount(['keys as stock' => available]).
     - The service sorts the offers in PHP (5 or fewer per product).

     Tests (tests/Feature/ProductIndexTest.php, ProductShowTest.php; both
     uses(RefreshDatabase)). A small factory fixture built per test, not the
     seeder. It contains 2 platforms, 2 regions, about 6 products with known
     prices, one product whose only offer has all keys sold, one with an
     inactive cheaper offer, and order items for sales.

     ProductIndexTest covers:
     - Filters: platform (single and multi), region, min_price, max_price, both
       price bounds together (which exclude out-of-stock products), q (case,
       LIKE escaping of %, no match → empty), and combined filters.
     - Sorts: each sort, including out-of-stock last on both price sorts and
       gift cards last on newest.
     - Pagination: with 25+ products, page 1 has 24 and page 2 has the rest;
       meta is correct; a page past the end returns empty data.
     - Facets: disjunctive counts, zero-count options present, the price range
       ignoring the price filter.
     - Prices: from_price ignores sold keys and inactive offers;
       discount_percent.
     - Validation: bad sort, max < min and a negative price → 422.

     ProductShowTest covers:
     - offer order (in stock first, then price)
     - stock excludes sold keys
     - the sold-out offer → stock: 0, in_stock: false
     - the inactive offer is omitted
     - seller rating is a number
     - an unknown slug → 404 {"message":"Not found."}

     ---

     3. Frontend (frontend/src/)

     Tokens. Add an @theme block to index.css with exactly the DESIGN.md values:
     - colors as --color-page, --color-fg-muted, …
     - --text-xs … --text-price-lg with line heights
     - --radius-sm 2px and --radius 4px
     - the dropdown/modal shadow
     - --font-sans: Metropolis, Arial, sans-serif, with no font files (decided:
       it renders Arial until M8)

     Also set body { bg-page text-fg } and add a :focus-visible accent outline.
     Components use these tokens only.

     File: api/products.ts
     What: Types (ProductSummary, ProductList, ProductDetail, Offer) and
       hand-written type guards (same pattern as api/health.ts). fetchProducts /

       useProducts(params) use placeholderData: keepPreviousData, so the grid
       doesn't flash between filter changes. fetchProduct / useProduct(slug)
     don't
       retry a 404
     ────────────────────────────────────────
     File: lib/money.ts
     What: formatCents(cents) → Intl.NumberFormat('en-IE', {style:'currency',
       currency:'EUR'})
     ────────────────────────────────────────
     File: features/store/storeParams.ts
     What: Pure functions. parseStoreParams(URLSearchParams): StoreParams is
       lenient: it drops invalid or duplicate values.
     toSearchParams(StoreParams) is
        canonical: it omits defaults and sorts arrays. toApiQuery builds the API

       query. The URL uses the same names and units as the API (cents), so there
     is
       one mapping
     ────────────────────────────────────────
     File: features/store/useStoreParams.ts
     What: Uses useSearchParams. update(patch) resets page to 1 unless the patch

       sets it, and pushes a history entry, so Back restores the previous
     filters.
       Text and price inputs commit on submit or blur, not on every keystroke,
     so
       Back steps through real filter states
     ────────────────────────────────────────
     File: features/store/StorePage.tsx
     What: Title, name-filter input, result count and sort select, sidebar and
     grid,
       pagination. It handles loading (skeleton cards), error (message + retry),
     and
        empty ("No products match your filters" + Clear filters primary button)
       states, and scrolls to the top on page change
     ────────────────────────────────────────
     File: features/store/FilterSidebar.tsx
     What: Price (EUR inputs, converted to cents on commit), Platform and Region

       checkbox lists with facet counts. Zero-count options are shown at 50%
       opacity. Collapsible sections. At lg and up it's a 200px surface-raised
       panel; below lg it's a left drawer opened by a "Filters" button
     ────────────────────────────────────────
     File: features/store/SortSelect.tsx, Pagination.tsx
     What: Native <select>; prev/next plus numbered page links. Both are real
       <Link>s, so they work with middle-click and Back
     ────────────────────────────────────────
     File: features/product/ProductPage.tsx
     What: Cover, title, platform pill and region label, release date, MSRP,
       description. "Best offer" (the first offer, if it's in stock, with a Best

       price pill) and "Other offers (N)". ApiError.status === 404 renders
       <NotFoundPage />
     ────────────────────────────────────────
     File: features/product/OfferRow.tsx
     What: Initials avatar, seller name, ★ rating, struck-through MSRP and
     discount,
       price, "N in stock", and a secondary Add to cart button with no handler
     yet
       (M6). Out-of-stock rows are at 50% opacity, and the button is disabled
     with
       the label "Out of stock"
     ────────────────────────────────────────
     File: components/Layout.tsx
     What: Header (text wordmark → /, a "Store" link; search arrives in M3) +
       <Outlet/> + footer ("Assignment demo, not affiliated with Eneba")
     ────────────────────────────────────────
     File: components/Button.tsx, Badge.tsx, Price.tsx, ProductCard.tsx,
       Skeleton.tsx
     What: The DESIGN.md variants. ProductCard covers the whole card as a link:
     the
       cover with the platform band, title (2-line clamp), coloured region label

       (GLOBAL/EU → region-ok), and "From" + MSRP/discount + price, or "Out of
       stock" with the cover at 50% opacity
     ────────────────────────────────────────
     File: routes.tsx
     What: A layout route containing / (existing SkeletonPage), /store,
       /product/:slug and * → NotFoundPage (restyled)

     Cover aspect. The placeholder SVGs are 3:4 (300×400). DESIGN.md's 4:5 is
     marked Estimate, so I'll use 3:4 and correct that line in DESIGN.md.

     Frontend tests.
     - storeParams.test.ts: round trips, defaults omitted, junk dropped
       (page=-1, sort=foo, min_price=abc), and arrays de-duplicated.
     - useStoreParams.test.tsx with createMemoryRouter:
       - update() pushes an entry and resets the page;
       - router.navigate(-1) restores the previous filters.
     - ProductPage.test.tsx with stubbed fetch:
       - a 404 renders the not-found page;
       - an out-of-stock offer's button is disabled;
       - the best offer is shown first.

     No new dependencies are needed. Tests use fireEvent from the
     already-installed @testing-library/react.

     ---

     4. Docs

     - ARCHITECTURE.md › API: replace the /api/products and /api/products/{slug}
       rows with the final contract (or link to a short "Store contract"
       subsection).
     - DESIGN.md: cover aspect 3:4.
     - PLAN.md: tick the M2 and M4 boxes once Verify passes. The M3 boxes stay
       open: fuzzy search, /api/search/suggest and the header box are still to
       come.

     5. Verification

     1. In backend/: php artisan test (Neon test branch) and vendor/bin/pint
        --test.
     2. In frontend/: npm run lint, npm run typecheck, npm run test, npm run
        build.
     3. Manual check with php artisan serve + npm run dev against the seeded dev
        branch:
        - On /store, tick Steam and then EU, set a price range and sort by price
          ↑. Reload: the view is unchanged. Press Back three times: each step
          restores the previous filter set.
        - Open a product and press Back: the store returns with the same filters
          and page.
        - /product/hollow-knight-… shows every offer disabled.
          /product/does-not-exist shows the 404 page.
        - Check at 375px and 1440px: no horizontal scroll, and the filter drawer
          works.
     4. Show all command output. If anything fails, report it rather than tick
        the box.

● Plan approved. I'll start with the branch and the backend.

Ran 2 shell commands (ctrl+o to expand)

● Now the backend source files.

● Write(backend\app\Support\Discount.php)
⎿  Wrote 22 lines to backend\app\Support\Discount.php
1 <?php
2
3 namespace App\Support;
4
5 /** The one place the discount rule lives (ARCHITECTURE.md › Dat
a model: 1 − price / msrp). \*/
6 final class Discount
7 {
8 /**
9 \* Whole percent below MSRP, rounded down so a discount is n
… +14 lines (ctrl+o to expand)

● Write(backend\app\Services\ProductSearch.php)
⎿  Wrote 51 lines to backend\app\Services\ProductSearch.php
1 <?php
2
3 namespace App\Services;
4
5 use Illuminate\Contracts\Database\Query\Builder;
6
7 /\*_
8 _ The name filter shared by the Store listing and (from M3) the
header autocomplete.
9 \*
… +42 lines (ctrl+o to expand)

● Write(backend\app\Services\Catalog\ProductFilters.php)
⎿  Wrote 52 lines to backend\app\Services\Catalog\ProductFilters.php
1 <?php
2
3 namespace App\Services\Catalog;
4
5 /\*_ Validated, normalized Store query (GET /api/products). _/
6 final readonly class ProductFilters
7 {
8 public const PER_PAGE = 24;
9
10 public const SORT_RELEVANCE = 'relevance';
… +42 lines (ctrl+o to expand)

● Write(backend\app\Services\Catalog\ProductListResult.php)
⎿  Wrote 29 lines to backend\app\Services\Catalog\ProductListResult.php
1 <?php
2
3 namespace App\Services\Catalog;
4
5 use App\Models\Product;
6 use Illuminate\Database\Eloquent\Collection;
7
8 final readonly class ProductListResult
9 {
10 /\*\*
… +19 lines (ctrl+o to expand)

● Write(backend\app\Services\Catalog\ProductCatalog.php) ⎿  Wrote 203 lines to backend\app\Services\Catalog\ProductCatalog.php
1 <?php
2
3 namespace App\Services\Catalog;
4
5 use App\Models\Key;
6 use App\Models\Offer;
7 use App\Models\OrderItem;
8 use App\Models\Platform;
9 use App\Models\Product;
10 use App\Models\Region;
… +193 lines (ctrl+o to expand)

● Write(backend\app\Http\Requests\ProductIndexRequest.php)
⎿  Wrote 57 lines to backend\app\Http\Requests\ProductIndexRequest.php
1 <?php
2
3 namespace App\Http\Requests;
4
5 use App\Services\Catalog\ProductFilters;
6 use App\Services\ProductSearch;
7 use Illuminate\Foundation\Http\FormRequest;
8 use Illuminate\Validation\Rule;
9
10 final class ProductIndexRequest extends FormRequest
… +47 lines (ctrl+o to expand)

● Write(backend\app\Http\Resources\ProductSummaryResource.php)
⎿  Wrote 39 lines to
backend\app\Http\Resources\ProductSummaryResource.php
1 <?php
2
3 namespace App\Http\Resources;
4
5 use App\Models\Product;
6 use App\Support\Discount;
7 use Illuminate\Http\Request;
8 use Illuminate\Http\Resources\Json\JsonResource;
9
10 /\*\*
… +29 lines (ctrl+o to expand)

● Write(backend\app\Http\Resources\ProductDetailResource.php)
⎿  Wrote 25 lines to backend\app\Http\Resources\ProductDetailResource.php
1 <?php
2
3 namespace App\Http\Resources;
4
5 use App\Models\Product;
6 use Illuminate\Http\Request;
7
8 /\*_
9 _ The product page: the card fields plus the description and ev
ery active offer
… +16 lines (ctrl+o to expand)

● Write(backend\app\Http\Resources\OfferResource.php)
⎿  Wrote 37 lines to backend\app\Http\Resources\OfferResource.php
1 <?php
2
3 namespace App\Http\Resources;
4
5 use App\Models\Offer;
6 use App\Support\Discount;
7 use Illuminate\Http\Request;
8 use Illuminate\Http\Resources\Json\JsonResource;
9
10 /\*\*
… +27 lines (ctrl+o to expand)

● Write(backend\app\Http\Controllers\ProductController.php)
⎿  Wrote 35 lines to backend\app\Http\Controllers\ProductController.php
1 <?php
2
3 namespace App\Http\Controllers;
4
5 use App\Http\Requests\ProductIndexRequest;
6 use App\Http\Resources\ProductDetailResource;
7 use App\Http\Resources\ProductSummaryResource;
8 use App\Services\Catalog\ProductCatalog;
9 use App\Services\Catalog\ProductFilters;
10 use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
… +25 lines (ctrl+o to expand)

● Bash(cd "c:/Users/Andrius/Desktop/Eneba/eneba-marketplace/backend" && cat >
routes/api.php <<'EOF'
<?php…)
⎿  Updated backend\routes\api.php (+5 -0)
1 <?php
2  
 3 use App\Http\Controllers\HealthController;
4 +use App\Http\Controllers\ProductController;  
 5 use Illuminate\Support\Facades\Route;
6  
 7 Route::get('/health', HealthController::class);
8 +  
 9 +Route::get('/products', [ProductController::class, 'index']);  
 10 +// A plain string slug (no model binding), so a 404 never names + a model class.  
 11 +Route::get('/products/{slug}', [ProductController::class, 'show
+']);  
 ⎿  (files that changed while this command ran, by the command or by
another process; a convenience view, not a review or audit of the
command)

● No Python on this machine, so I'll make the edit with the Edit tool.

Read 1 file (ctrl+o to expand)

● Update(backend\bootstrap\app.php)
⎿  Added 10 lines
19 $exceptions->shouldRenderJsonWhen(
      20              fn (Request $request) => $request->is('api/*') || $
          request->expectsJson(),
      21          );
      22 +                                                               
      23 +        // One generic 404 body for the API: unknown routes and
         + unknown slugs look the same,                                  
      24 +        // and the message never names an internal class.      
      25 +        $exceptions->render(function (NotFoundHttpException $e,
         + Request $request) {                                           
      26 +            if ($request->is('api/\*')) {  
 27 + return response()->json(['message' => 'Not foun
+d.'], 404);  
 28 + }  
 29 +  
 30 + return null;  
 31 + });  
 32 })->create();

● Update(backend\bootstrap\app.php)
⎿  Added 1 line
4 use Illuminate\Foundation\Configuration\Exceptions;
5 use Illuminate\Foundation\Configuration\Middleware;
6 use Illuminate\Http\Request;
7 +use Symfony\Component\HttpKernel\Exception\NotFoundHttpExceptio
+n;  
 8  
 9 return Application::configure(basePath: dirname(**DIR**))
10 ->withRouting(

● Now the test fixture and the feature tests.

● Write(backend\tests\Support\StoreCatalog.php)
⎿  Wrote 115 lines to backend\tests\Support\StoreCatalog.php
1 <?php
2
3 namespace Tests\Support;
4
5 use App\Models\Key;
6 use App\Models\Offer;
7 use App\Models\OrderItem;
8 use App\Models\Platform;
9 use App\Models\Product;
10 use App\Models\Region;
… +105 lines (ctrl+o to expand)

● Update(backend\tests\Support\StoreCatalog.php)
⎿  Added 2 lines, removed 2 lines
18 _ | A | Elden Ring | steam | global | 5999 |
3449 | 2022-02-25 | 3 |
19 _ | B | Cyberpunk 2077 | steam | eu | 4999 |
2999 | 2020-12-10 | 0 |
20 _ | C | Forza Horizon 5 | xbox | global | 5999 |
5999 | 2021-11-09 | 5 |
21 - _ | D | Hollow Knight | xbox | eu | 1499 |
-– (sold out) | 2017-02-24 | 2 |  
 22 - _ | E | Gift Card 50% Bonus | steam | global | 5000 |
-4800 | – | 0 |  
 21 + _ | D | Hollow Knight | xbox | eu | 1499 |
+sold out | 2017-02-24 | 2 |  
 22 + _ | E | Gift Card 50% Bonus | steam | global | 5000 |
+4800 | none | 0 |  
 23 _ | F | Elden Ring Nightreign | steam | eu | 3999 |
3499 | 2025-05-30 | 0 |
24 _
25 _ Traps: A has a cheaper offer whose keys are all sold (2999);
B has a cheaper inactive offer (999);

● Write(backend\tests\Feature\ProductIndexTest.php)
⎿  Wrote 242 lines to backend\tests\Feature\ProductIndexTest.php
1 <?php
2
3 use App\Models\Product;
4 use Illuminate\Foundation\Testing\RefreshDatabase;
5 use Illuminate\Testing\TestResponse;
6 use Tests\Support\StoreCatalog;
7
8 uses(RefreshDatabase::class);
9
10 beforeEach(function () {
… +232 lines (ctrl+o to expand)

● Update(backend\tests\Feature\ProductIndexTest.php)
⎿  Added 1 line, removed 1 line
146 });
147  
 148 it('defaults to relevance with a name filter: exact title
before title prefix', function () {
149 - // F would come first by id-independent sales? No: bot
-h have equal tiers only by prefix; A is exact.  
 149 + // A is an exact match (tier 0); F only starts with th
+e query (tier 1).  
 150 expect(slugsOf(listProducts(['q' => 'elden ring'])))->
toBe($this->catalog->slugs(['A', 'F']));
151 });
152

● Write(backend\tests\Feature\ProductShowTest.php)
⎿  Wrote 83 lines to backend\tests\Feature\ProductShowTest.php
1 <?php
2
3 use App\Models\Seller;
4 use Illuminate\Foundation\Testing\RefreshDatabase;
5 use Tests\Support\StoreCatalog;
6
7 uses(RefreshDatabase::class);
8
9 beforeEach(function () {
10 $this->catalog = StoreCatalog::create();
… +73 lines (ctrl+o to expand)

● Running the new backend tests:

Ran 1 shell command (ctrl+o to expand)

● All 44 backend tests passed on the first run (the run takes about 5 minutes
against remote Neon). Now the frontend.

Ran 1 shell command (ctrl+o to expand)

● Next is the token layer in index.css. It resets Tailwind's default colors and
font sizes, so the DESIGN.md tokens are the only ones available.

● Write(frontend\src\index.css)
⎿  Added 71 lines, removed 1 line
1 @import 'tailwindcss';
2  
 3 -/_ Design tokens from docs/DESIGN.md go into an @theme block he
-re in M8. _/  
 3 +/_  
 4 + _ Design tokens. docs/DESIGN.md is the only source: every valu
+e below is copied from it  
 5 + _ (Given / Measured / Estimate, sampled from eneba.com screens
+hots in docs/design/).  
 6 + _ The default color palette and font sizes are reset so compon
+ents can only use these tokens.  
 7 + _/  
 8 +@theme {  
 9 + /_ Typography (DESIGN.md › Typography). Metropolis isn't load
+ed yet, so Arial renders until M8. _/  
 10 + --font-sans: Metropolis, Arial, sans-serif;  
 11 +  
 12 + --text-_: initial;  
 13 + --text-xs: 0.75rem;  
 14 + --text-xs--line-height: 1rem;  
 15 + --text-sm: 0.875rem;  
 16 + --text-sm--line-height: 1.25rem;  
 17 + --text-base: 1rem;  
 18 + --text-base--line-height: 1.5rem;  
 19 + --text-lg: 1.125rem;  
 20 + --text-lg--line-height: 1.5rem;  
 21 + --text-price: 1.375rem;  
 22 + --text-price--line-height: 1.75rem;  
 23 + --text-h1: 1.5rem;  
 24 + --text-h1--line-height: 2rem;  
 25 + --text-h2: 1.875rem;  
 26 + --text-h2--line-height: 2.25rem;  
 27 + --text-price-lg: 2rem;  
 28 + --text-price-lg--line-height: 2.25rem;  
 29 +  
 30 + /_ Colors (DESIGN.md › Colors) _/  
 31 + --color-_: initial;  
 32 + --color-page: #4618ac;  
 33 + --color-nav: #341282;  
 34 + --color-surface: #311078;  
 35 + --color-surface-raised: #5825cc;  
 36 + --color-surface-card: #1f0a4d;  
 37 + --color-surface-panel: #391787;  
 38 + --color-surface-inset: #2f0f74;  
 39 + --color-field: #2b0e6a;  
 40 + --color-field-filter: #461ea3;  
 41 + --color-field-focus: #200b4e;  
 42 + --color-scrim: rgb(0 0 0 / 0.45);  
 43 + --color-accent: #f9d316;  
 44 + --color-accent-hover: #ffe04d;  
 45 + --color-on-accent: #1a1a1a;  
 46 + --color-teal: #05cdb0;  
 47 + --color-fg: #ffffff;  
 48 + --color-fg-muted: #b2a2d1;  
 49 + --color-line: #4b1db1;  
 50 + --color-line-strong: #a77efe;  
 51 + --color-discount: #74bd4a;  
 52 + --color-region-ok: #5eebc4;  
 53 + --color-region-limited: #ca6493;  
 54 + --color-danger: #e5484d;  
 55 +  
 56 + /_ Radius (DESIGN.md › Spacing, radius, elevation). `rounded` + keeps Tailwind's 4px. _/  
 57 + --radius-sm: 2px;  
 58 +  
 59 + /_ Elevation: only the search dropdown and the modal _/  
 60 + --shadow-pop: 0 8px 24px rgb(0 0 0 / 0.35);  
 61 +}  
 62 +  
 63 +@layer base {  
 64 + body {  
 65 + @apply bg-page font-sans text-base text-fg;  
 66 + }  
 67 +  
 68 + /_ DESIGN.md › Buttons › Focus: a 2px accent outline with a 2
+px offset (our own style). \*/  
 69 + :focus-visible {  
 70 + outline: 2px solid var(--color-accent);  
 71 + outline-offset: 2px;  
 72 + }  
 73 +}

● Write(frontend\src\lib\money.ts)
⎿  Wrote 26 lines to frontend\src\lib\money.ts
1 // Prices are integer euro cents everywhere (CLAUDE.md). These h
elpers only format and parse
2 // at the edges, using integer arithmetic so no float ever holds
money.
3
4 const euro = new Intl.NumberFormat('en-IE', { style: 'currency',
currency: 'EUR' })
5
6 /\*_ 3449 → "€34.49" _/
7 export function formatCents(cents: number): string {
… +19 lines (ctrl+o to expand)

● Write(frontend\src\api\guards.ts) ⎿  Wrote 23 lines to frontend\src\api\guards.ts
1 // Small building blocks for the hand-written response guards in
src/api/\*.
2
3 export type JsonObject = Record<string, unknown>
4
5 export function isObject(value: unknown): value is JsonObject {
6 return typeof value === 'object' && value !== null && !Array.i
sArray(value)
7 }
8
… +15 lines (ctrl+o to expand)

● Write(frontend\src\api\products.ts)
⎿  Wrote 156 lines to frontend\src\api\products.ts
1 import { keepPreviousData, useQuery } from '@tanstack/react-quer
y'
2 import { ApiError, getJson } from './client'
3 import { isArrayOf, isNullable, isNumber, isObject, isString } f
rom './guards'
4
5 // Shapes of GET /api/products and GET /api/products/{slug} (doc
s/ARCHITECTURE.md › Store API).
6
7 export type Named = { slug: string; name: string }
… +149 lines (ctrl+o to expand)

● Update(frontend\src\lib\money.ts)
⎿  Added 1 line, removed 1 line
5  
 6 /\*_ 3449 → "€34.49" _/
7 export function formatCents(cents: number): string {
8 - // Intl takes a number of euros; cents / 100 is exact enough
-for display of integer cents.  
 8 + // Display only: Intl needs euros, and cents / 100 always for
+mats back to the exact cents.  
 9 return euro.format(cents / 100)
10 }
11

● Write(frontend\src\features\store\storeParams.ts)
⎿  Wrote 111 lines to frontend\src\features\store\storeParams.ts
1 // Store state <-> URL. The URL is the single source of truth fo
r filters, sort and page
2 // (SPEC › Store), so reload, shared links and back/forward all
restore the same view.
3 //
4 // Browser URL: ?q=elden&platform=steam&platform=xbox&region=eu&
min_price=1000&max_price=5000&sort=price_asc&page=2
5 // API query: the same names and units (cents), except lists u
se PHP's `platform[]` form.
6
… +105 lines (ctrl+o to expand)

● Write(frontend\src\features\store\useStoreParams.ts)
⎿  Wrote 29 lines to frontend\src\features\store\useStoreParams.ts
1 import { useCallback, useMemo } from 'react'
2 import { useSearchParams } from 'react-router'
3 import { DEFAULT_STORE_PARAMS, parseStoreParams, toSearchParams,
type StoreParams } from './storeParams'
4
5 /\*_
6 _ The one hook that reads and writes Store state in the URL.
7 _
8 _ Every committed change pushes a history entry, so Back steps
through previous filter states.
… +21 lines (ctrl+o to expand)

● Update(frontend\src\features\store\useStoreParams.ts)
⎿  Added 2 lines, removed 1 line
23 [params, setSearchParams],
24 )
25  
 26 - const clear = useCallback(() => update(DEFAULT_STORE_PARAMS), - [update])  
 26 + /\*_ Drop every filter (including the name filter) but keep th
+e chosen sort. _/  
 27 + const clear = useCallback(() => update({ ...DEFAULT_STORE_PAR
+AMS, sort: params.sort }), [update, params.sort])  
 28  
 29 return { params, update, clear }
30 }

● Write(frontend\src\components\Button.tsx)
⎿  Wrote 35 lines to frontend\src\components\Button.tsx
1 import type { ButtonHTMLAttributes } from 'react'
2
3 // DESIGN.md › Buttons.
4 const VARIANTS = {
5 primary: 'bg-accent text-on-accent font-bold hover:enabled:bg-
accent-hover',
6 secondary: 'border border-line-strong bg-transparent text-fg f
ont-bold hover:enabled:bg-surface-raised',
7 icon: 'bg-transparent text-fg',
8 } as const
… +27 lines (ctrl+o to expand)

● Write(frontend\src\components\Badge.tsx)
⎿  Wrote 39 lines to frontend\src\components\Badge.tsx
1 import type { Named } from '../api/products'
2
3 // DESIGN.md › Badges.
4
5 /\*_ Eneba colours a region by whether the key works for the shop
per; we assume GLOBAL and EU do. _/
6 const REGIONS_THAT_WORK = new Set(['global', 'eu', 'europe'])
7
8 export function RegionLabel({ region }: { region: Named }) {
9 const tone = REGIONS_THAT_WORK.has(region.slug) ? 'text-region
… +31 lines (ctrl+o to expand)

● Write(frontend\src\components\Price.tsx)
⎿  Wrote 25 lines to frontend\src\components\Price.tsx
1 import { formatCents } from '../lib/money'
2 import { DiscountBadge } from './Badge'
3
4 const SIZES = {
5 price: 'text-price',
6 'price-lg': 'text-price-lg',
7 } as const
8
9 export function Price({ cents, size = 'price' }: { cents: number
; size?: keyof typeof SIZES }) {
… +16 lines (ctrl+o to expand)

● Write(frontend\src\components\Skeleton.tsx)
⎿  Wrote 4 lines to frontend\src\components\Skeleton.tsx
1 /\*_ DESIGN.md › Smaller pieces › Skeletons: `surface` blocks with
animate-pulse. _/
2 export function Skeleton({ className = '' }: { className?: string
}) {
3 return <div aria-hidden="true" className={`animate-pulse rounde
        d-sm bg-surface ${className}`} />
4 }

● Write(frontend\src\components\ProductCard.tsx)
⎿  Wrote 58 lines to frontend\src\components\ProductCard.tsx
1 import { Link } from 'react-router'
2 import type { ProductSummary } from '../api/products'
3 import { RegionLabel } from './Badge'
4 import { MsrpDiscount, Price } from './Price'
5 import { Skeleton } from './Skeleton'
6
7 /\*_ DESIGN.md › Product card. The whole card links to the produc
t page. _/
8 export function ProductCard({ product }: { product: ProductSumma
ry }) {
… +50 lines (ctrl+o to expand)

● Write(frontend\src\components\Layout.tsx)
⎿  Wrote 42 lines to frontend\src\components\Layout.tsx
1 import { Link, NavLink, Outlet, ScrollRestoration } from 'react-
router'
2
3 /\*_ Content column: 1072px max (DESIGN.md › Spacing), 16px gutte
r below 768px, 24px from 768px. _/
4 export const CONTAINER = 'mx-auto w-full max-w-268 px-4 md:px-6'
5
6 export function Layout() {
7 return (
8 <div className="flex min-h-screen flex-col">
… +34 lines (ctrl+o to expand)

● Next, the Store page components.

● Write(frontend\src\features\store\FilterSidebar.tsx)
⎿  Wrote 180 lines to frontend\src\features\store\FilterSidebar.tsx
1 import { useState, type FormEvent, type ReactNode } from 'react'
2 import type { FacetOption, ProductList } from '../../api/product
s'
3 import { centsToInput, formatCents, inputToCents } from '../../l
ib/money'
4 import type { StoreParams } from './storeParams'
5
6 const VISIBLE_OPTIONS = 6
7
8 type Props = {
… +172 lines (ctrl+o to expand)

● Write(frontend\src\features\store\SortSelect.tsx)
⎿  Wrote 40 lines to frontend\src\features\store\SortSelect.tsx
1 import type { Sort } from './storeParams'
2
3 const LABELS: Record<Sort, string> = {
4 relevance: 'Relevance',
5 bestselling: 'Best-selling',
6 price_asc: 'Price: low to high',
7 price_desc: 'Price: high to low',
8 newest: 'Newest',
9 }
… +31 lines (ctrl+o to expand)

● Write(frontend\src\features\store\Pagination.tsx)
⎿  Wrote 56 lines to frontend\src\features\store\Pagination.tsx
1 import { Link } from 'react-router'
2 import { toSearchParams, type StoreParams } from './storeParams'
3
4 type Props = { params: StoreParams; lastPage: number }
5
6 /\*_ Real links, so pages work with middle-click, reload and Back
. _/
7 export function Pagination({ params, lastPage }: Props) {
8 if (lastPage <= 1) return null
9
… +47 lines (ctrl+o to expand)

● Update(frontend\src\features\store\FilterSidebar.tsx)
⎿  Removed 2 lines
17 <div className="divide-y divide-line">
18 <Section title="Price (EUR)">
19 <PriceRange
20 - // Remount when the URL changes (e.g. Back), so the i
-nputs show the restored values.  
 21 - key={`${params.minPrice}-${params.maxPrice}`}  
 20 minPrice={params.minPrice}
21 maxPrice={params.maxPrice}
22 bounds={facets?.price}

● Update(frontend\src\features\store\FilterSidebar.tsx)
⎿  Added 11 lines, removed 2 lines
70  
 71 /\*_ Commits on Enter or blur, not on every keystroke, so each B
ack step is a real filter state. _/
72 function PriceRange({ minPrice, maxPrice, bounds, onChange }: P
riceRangeProps) {
73 - const [min, setMin] = useState(minPrice === null ? '' : cents
-ToInput(minPrice))  
 74 - const [max, setMax] = useState(maxPrice === null ? '' : cents
-ToInput(maxPrice))  
 73 + const [min, setMin] = useState(toInput(minPrice))  
 74 + const [max, setMax] = useState(toInput(maxPrice))  
 75  
 76 + // When the URL changes underneath (Back, Clear filters), sho
+w the restored values.  
 77 + // Adjusting state during render is React's recommended alter
+native to a syncing effect.  
 78 + const [shown, setShown] = useState({ minPrice, maxPrice })  
 79 + if (shown.minPrice !== minPrice || shown.maxPrice !== maxPric
+e) {  
 80 + setShown({ minPrice, maxPrice })  
 81 + setMin(toInput(minPrice))  
 82 + setMax(toInput(maxPrice))  
 83 + }  
 84 +  
 85 function commit() {
86 let nextMin = inputToCents(min)
87 let nextMax = inputToCents(max)

● Update(frontend\src\features\store\FilterSidebar.tsx)
⎿  Added 4 lines
138 )
139 }
140  
 141 +function toInput(cents: number | null): string {  
 142 + return cents === null ? '' : centsToInput(cents)  
 143 +}  
 144 +  
 145 type CheckboxListProps = {
146 name: string
147 options: FacetOption[]

● Write(frontend\src\features\store\StorePage.tsx)
⎿  Wrote 175 lines to frontend\src\features\store\StorePage.tsx
1 import { useEffect, useRef, useState, type FormEvent } from 'rea
ct'
2 import { Link } from 'react-router'
3 import { useProducts } from '../../api/products'
4 import { Button, buttonClasses } from '../../components/Button'
5 import { CONTAINER } from '../../components/Layout'
6 import { ProductCard, ProductCardSkeleton } from '../../componen
ts/ProductCard'
7 import { FilterSidebar } from './FilterSidebar'
8 import { Pagination } from './Pagination'
… +167 lines (ctrl+o to expand)

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 3 lines, removed 1 line
103 {isPending ? (
104 <Grid busy>
105 {Array.from({ length: SKELETON*CARDS }, (*, i) = > (
106 - <ProductCardSkeleton key={i} />  
 106 + <li key={i}>  
 107 + <ProductCardSkeleton />  
 108 + </li>  
 109 ))}
110 </Grid>
111 ) : isError && !data ? (
● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 1 line, removed 1 line
154 )
155 }
156  
 157 -function Grid({ busy, children }: { busy: boolean; children: R
-eact.ReactNode }) {  
 157 +function Grid({ busy, children }: { busy: boolean; children: R
+eactNode }) {  
 158 return (
159 <ul
160 aria-busy={busy}

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 1 line, removed 1 line
1 -import { useEffect, useRef, useState, type FormEvent } from 'rea
-ct'  
 1 +import { useEffect, useRef, useState, type FormEvent, type React
+Node } from 'react'  
 2 import { Link } from 'react-router'
3 import { useProducts } from '../../api/products'
4 import { Button, buttonClasses } from '../../components/Button'

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 1 line, removed 1 line
158 return (
159 <ul
160 aria-busy={busy}
161 - className={`grid grid-cols-2 gap-4 transition-opacity sm
          -:grid-cols-3 xl:grid-cols-4 [&>*]:min-w-0 [&>li>a]:w-full ${bu
          -sy ? 'opacity-60' : ''}`}  
 161 + className={`grid grid-cols-2 gap-4 transition-opacity sm
          +:grid-cols-3 xl:grid-cols-4 *:min-w-0 ${busy ? 'opacity-60' : 
          +''}`}  
 162 >
163 {children}
164 </ul>

● Update(frontend\src\components\ProductCard.tsx)
⎿  Added 1 line, removed 1 line
9 return (
10 <Link
11 to={`/product/${product.slug}`}
12 - className="group flex flex-col overflow-hidden rounded-sm - bg-surface-card outline-line-strong hover:outline"  
 12 + className="group flex w-full flex-col overflow-hidden rou
+nded-sm bg-surface-card outline-line-strong hover:outline"  
 13 >
14 <div className="relative aspect-3/4">
15 <img

● Now the product page, the offer row, the restyled 404 page and the routes.

● Write(frontend\src\features\product\OfferRow.tsx)
⎿  Wrote 61 lines to frontend\src\features\product\OfferRow.tsx
1 import type { Offer } from '../../api/products'
2 import { BestPricePill } from '../../components/Badge'
3 import { Button } from '../../components/Button'
4 import { MsrpDiscount, Price } from '../../components/Price'
5
6 type Props = {
7 offer: Offer
8 msrpCents: number
9 best?: boolean
10 }
… +51 lines (ctrl+o to expand)

● Write(frontend\src\features\product\ProductPage.tsx)
⎿  Wrote 149 lines to frontend\src\features\product\ProductPage.tsx
1 import { Link, useParams } from 'react-router'
2 import { ApiError } from '../../api/client'
3 import { useProduct, type ProductDetail } from '../../api/produc
ts'
4 import { PlatformPill, RegionLabel } from '../../components/Badg
e'
5 import { Button } from '../../components/Button'
6 import { CONTAINER } from '../../components/Layout'
7 import { MsrpDiscount, Price } from '../../components/Price'
8 import { Skeleton } from '../../components/Skeleton'
… +141 lines (ctrl+o to expand)

● Write(frontend\src\pages\NotFoundPage.tsx)
⎿  Added 16 lines, removed 3 lines
1 import { Link } from 'react-router'
2 +import { buttonClasses } from '../components/Button'  
 3 +import { CONTAINER } from '../components/Layout'  
 4  
 5 +/\*_ Unknown routes and unknown product slugs. _/  
 6 export function NotFoundPage() {
7 return (
5 - <main className="p-4">  
 6 - <h1>Page not found</h1>  
 7 - <Link to="/">Back to the homepage</Link>  
 8 + <main className={`${CONTAINER} py-16 text-center`}>  
 9 + <title>Not found | KeyMarket</title>  
 10 + <p className="text-price-lg font-bold text-accent">404</p
+>  
 11 + <h1 className="mt-2 text-h1 font-bold">Page not found</h1
+>  
 12 + <p className="mt-2 text-base">The page or product you’re
+looking for doesn’t exist.</p>  
 13 + <div className="mt-6 flex flex-wrap justify-center gap-3"
+>  
 14 + <Link to="/store" className={buttonClasses('primary')}>
15 + Browse the store  
 16 + </Link>  
 17 + <Link to="/" className={buttonClasses('secondary')}>  
 18 + Back to the homepage  
 19 + </Link>  
 20 + </div>  
 21 </main>
22 )
23 }

● Write(frontend\src\routes.tsx)
⎿  Added 12 lines, removed 2 lines
1 import type { RouteObject } from 'react-router'
2 +import { Layout } from './components/Layout'  
 3 +import { ProductPage } from './features/product/ProductPage'  
 4 +import { StorePage } from './features/store/StorePage'  
 5 import { NotFoundPage } from './pages/NotFoundPage'
6 import { SkeletonPage } from './pages/SkeletonPage'
7  
 8 export const routes: RouteObject[] = [
6 - { path: '/', element: <SkeletonPage /> },  
 7 - { path: '_', element: <NotFoundPage /> },  
 9 + {  
 10 + element: <Layout />,  
 11 + children: [  
 12 + { path: '/', element: <SkeletonPage /> },  
 13 + { path: '/store', element: <StorePage /> },  
 14 + { path: '/product/:slug', element: <ProductPage /> },  
 15 + { path: '_', element: <NotFoundPage /> },  
 16 + ],  
 17 + },  
 18 ]

● Write(frontend\src\pages\SkeletonPage.tsx)
⎿  Added 8 lines, removed 2 lines
1 +import { Link } from 'react-router'  
 2 +import { buttonClasses } from '../components/Button'  
 3 +import { CONTAINER } from '../components/Layout'  
 4 import { HealthStatus } from '../features/health/HealthStatus'
5  
 6 // Temporary M0 page. M7 replaces it with the homepage rendered
from GET /api/home.
7 export function SkeletonPage() {
8 return (
6 - <main className="p-4">  
 7 - <h1>Eneba marketplace</h1>  
 9 + <main className={`${CONTAINER} py-6`}>  
 10 + <h1 className="text-h1 font-bold">Eneba marketplace</h1>
11 <HealthStatus />
12 + <Link to="/store" className={buttonClasses('primary', 'md
+', 'mt-4')}>  
 13 + Browse the store  
 14 + </Link>  
 15 </main>
16 )
17 }

● Now the frontend tests.

● Write(frontend\src\features\store\storeParams.test.ts)
⎿  Wrote 103 lines to frontend\src\features\store\storeParams.test.ts
1 import { describe, expect, it } from 'vitest'
2 import {
3 DEFAULT_STORE_PARAMS,
4 effectiveSort,
5 parseStoreParams,
6 toApiQuery,
7 toSearchParams,
8 type StoreParams,
9 } from './storeParams'
… +94 lines (ctrl+o to expand)

● Write(frontend\src\lib\money.test.ts)
⎿  Wrote 35 lines to frontend\src\lib\money.test.ts
1 import { describe, expect, it } from 'vitest'
2 import { centsToInput, formatCents, inputToCents } from './money
'
3
4 describe('formatCents', () => {
5 it('formats euro cents for display', () => {
6 expect(formatCents(3449)).toBe('€34.49')
7 expect(formatCents(5)).toBe('€0.05')
8 expect(formatCents(123456)).toBe('€1,234.56')
9 })
… +26 lines (ctrl+o to expand)

● Write(frontend\src\features\store\useStoreParams.test.tsx)
⎿  Wrote 84 lines to frontend\src\features\store\useStoreParams.test.tsx
1 import { act, fireEvent, render, screen } from '@testing-library
/react'
2 import { createMemoryRouter, RouterProvider } from 'react-router
'
3 import { describe, expect, it } from 'vitest'
4 import { useStoreParams } from './useStoreParams'
5
6 function Probe() {
7 const { params, update, clear } = useStoreParams()
8 return (
… +76 lines (ctrl+o to expand)

● Write(frontend\src\features\product\ProductPage.test.tsx)
⎿  Wrote 117 lines to frontend\src\features\product\ProductPage.test.tsx
1 import { QueryClient, QueryClientProvider } from '@tanstack/reac
t-query'
2 import { render, screen, within } from '@testing-library/react'
3 import { createMemoryRouter, RouterProvider } from 'react-router
'
4 import { afterEach, describe, expect, it, vi } from 'vitest'
5 import type { Offer, ProductDetail } from '../../api/products'
6 import { ProductPage } from './ProductPage'
7
8 function offer(overrides: Partial<Offer>): Offer {
… +109 lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Typecheck caught a narrowing-order mistake in the guards, and lint flagged
three non-component exports. Fixing both:

● Update(frontend\src\api\products.ts)
⎿  Added 2 lines, removed 1 line
57 }
58  
 59 function isFacetOption(value: unknown): value is FacetOption {
60 - return isNamed(value) && isObject(value) && isNumber(value.co
-unt)  
 60 + // Check the plain-object fields before isNamed() narrows the + type away from JsonObject.  
 61 + return isObject(value) && isNumber(value.count) && isNamed(va
+lue)  
 62 }
63  
 64 export function isProductSummary(value: unknown): value is Prod
uctSummary {

● Update(frontend\src\api\products.ts)
⎿  Added 2 lines, removed 2 lines
114  
 115 export function isProductDetail(value: unknown): value is Prod
uctDetail {
116 return (
117 - isProductSummary(value) &&  
 117 isObject(value) &&
118 isString(value.description) &&
120 - isArrayOf(value.offers, isOffer)  
 119 + isArrayOf(value.offers, isOffer) &&  
 120 + isProductSummary(value)  
 121 )
122 }
123

● Update(frontend\src\features\product\OfferRow.tsx)
⎿  Added 1 line, removed 1 line
54 }
55  
 56 /\*_ "PixelVault" → "PI", "Key Hub" → "KH" (we have no seller im
ages). _/
57 -export function initials(name: string): string {  
 57 +function initials(name: string): string {  
 58 const words = name.trim().split(/\s+/).filter(Boolean)
59 const letters = words.length > 1 ? words[0][0] + words[1][0]
: name.trim().slice(0, 2)
60 return letters.toUpperCase()

● Update(frontend\src\features\store\Pagination.tsx)
⎿  Added 1 line, removed 1 line
44 }
45  
 46 /\*_ 1 … 4 5 6 … 10: first, last and neighbours of the current p
age; null marks a gap. _/
47 -export function pageWindow(current: number, last: number): (num
-ber | null)[] {  
 47 +function pageWindow(current: number, last: number): (number | n
+ull)[] {  
 48 const pages = new Set([1, last, current - 1, current, current
+ 1].filter((p) => p >= 1 && p <= last))
49 const sorted = [...pages].sort((a, b) => a - b)
50 const out: (number | null)[] = []

● Write(frontend\src\components\buttonClasses.ts)
⎿  Wrote 25 lines to frontend\src\components\buttonClasses.ts
1 // DESIGN.md › Buttons. Shared by <Button> and by links styled a
s buttons.
2
3 const VARIANTS = {
4 primary: 'bg-accent text-on-accent font-bold hover:enabled:bg-
accent-hover',
5 secondary: 'border border-line-strong bg-transparent text-fg f
ont-bold hover:enabled:bg-surface-raised',
6 icon: 'bg-transparent text-fg',
7 } as const
… +18 lines (ctrl+o to expand)
● Write(frontend\src\components\Button.tsx)
⎿  Added 1 line, removed 25 lines
1 import type { ButtonHTMLAttributes } from 'react'
2 +import { buttonClasses, type ButtonSize, type ButtonVariant } f
+rom './buttonClasses'  
 3  
 3 -// DESIGN.md › Buttons.  
 4 -const VARIANTS = {  
 5 - primary: 'bg-accent text-on-accent font-bold hover:enabled:bg
--accent-hover',  
 6 - secondary: 'border border-line-strong bg-transparent text-fg
-font-bold hover:enabled:bg-surface-raised',  
 7 - icon: 'bg-transparent text-fg',  
 8 -} as const  
 9 -  
 10 -const SIZES = {  
 11 - md: 'h-10 px-4',  
 12 - sm: 'h-8 px-3',  
 13 -} as const  
 14 -  
 15 -export type ButtonVariant = keyof typeof VARIANTS  
 16 -export type ButtonSize = keyof typeof SIZES  
 17 -  
 4 type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
5 variant?: ButtonVariant
6 size?: ButtonSize
7 }
8  
 23 -export function buttonClasses(variant: ButtonVariant = 'primary
-', size: ButtonSize = 'md', extra = ''): string {  
 24 - return [  
 25 - 'inline-flex items-center justify-center gap-2 rounded-sm t
-ext-sm whitespace-nowrap',  
 26 - 'disabled:cursor-not-allowed disabled:opacity-50',  
 27 - VARIANTS[variant],  
 28 - variant === 'icon' ? '' : SIZES[size],  
 29 - extra,  
 30 - ].join(' ')  
 31 -}  
 32 -  
 9 export function Button({ variant = 'primary', size = 'md', clas
sName = '', type = 'button', ...rest }: ButtonProps) {
10 return <button type={type} className={buttonClasses(variant,
size, className)} {...rest} />
11 }

● Bash(cd "c:/Users/Andrius/Desktop/Eneba/eneba-marketplace/frontend" && grep
-rln "buttonClasses" src | xargs sed -i "s#import { Button, buttonClasses
} from '../../c…)
⎿  Updated frontend\src\features\store\StorePage.tsx (+2 -1)
1 import { useEffect, useRef, useState, type FormEvent, type React
Node } from 'react'
2 import { Link } from 'react-router'
3 import { useProducts } from '../../api/products'
4 -import { Button, buttonClasses } from '../../components/Button'
4 +import { Button } from '../../components/Button'  
 5 +import { buttonClasses } from '../../components/buttonClasses'  
 6 import { CONTAINER } from '../../components/Layout'
7 import { ProductCard, ProductCardSkeleton } from '../../componen
ts/ProductCard'
8 import { FilterSidebar } from './FilterSidebar'
⎿  Updated frontend\src\pages\NotFoundPage.tsx (+1 -1)
1 import { Link } from 'react-router'
2 -import { buttonClasses } from '../components/Button'  
 2 +import { buttonClasses } from '../components/buttonClasses'  
 3 import { CONTAINER } from '../components/Layout'
4  
 5 /\*_ Unknown routes and unknown product slugs. _/
⎿  Updated frontend\src\pages\SkeletonPage.tsx (+1 -1)
1 import { Link } from 'react-router'
2 -import { buttonClasses } from '../components/Button'  
 2 +import { buttonClasses } from '../components/buttonClasses'  
 3 import { CONTAINER } from '../components/Layout'
4 import { HealthStatus } from '../features/health/HealthStatus'
5  
 ⎿  (timeout 5m)

● Everything passes: lint, typecheck, 47 Vitest tests and the build. Next I'll
check that Tailwind actually generated the token-based classes.

Ran 2 shell commands (ctrl+o to expand)

● The classes are all generated; my grep patterns were escaped wrong. Now Pint
and the full backend suite:

Ran 2 shell commands (ctrl+o to expand)

● While the suite runs, I'll start the API against the seeded dev branch and hit
the real endpoints.

Ran 2 shell commands (ctrl+o to expand)

● The listing works on real data: the 2 sold-out products sort last, and the
facets add up to 30. Now the detail endpoint, the 404 and response times:

Ran 1 shell command (ctrl+o to expand)

● Each listing request takes about 1.3 s locally because of five round trips to
Neon in Frankfurt, a delay that should mostly vanish in production. Next I'm
checking the Vite proxy path. · summary

Ran 2 shell commands (ctrl+o to expand)

● The SPA routes and the proxy both work, and steam+eu returns 0 on seed data to
exercise the empty state. Next I'll write the final contract into
ARCHITECTURE.md and the corrected cover aspect into DESIGN.md. · summary

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
95 |---|---|---|---|
96 | GET | `/api/health` | – | Liveness plus a DB ping. Used by t
he uptime pinger |
97 | GET | `/api/home` | – | Ordered homepage blocks with their d
ata |
98 -| GET | `/api/products` | – | Store listing: `q`, `platform[]`
-, `region[]`, `min_price`, `max_price` (cents), `sort` (`relev
          -ance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `p
          -age`. Returns `{data, meta:{page, per_page, total}, facets:{pl
          -atforms:[{slug,name,count}], regions:[…], price:{min,max}}}` |
98 +| GET | `/api/products` | – | Store listing: `q`, `platform[]`
+, `region[]`, `min_price`, `max_price` (cents), `sort` (`relev
          +ance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `p
          +age`. Returns `{data, meta:{page, per_page, total, last_page},
          + facets:{platforms:[{slug,name,count}], regions:[…], price:{mi
          +n_cents,max_cents}}}`. See [Store API](#store-api) |  
 99 | GET | `/api/search/suggest?q=` | – | Top 6 matches for autoc
omplete (same engine as the listing) |
100 | GET | `/api/products/{slug}` | – | Product details plus offe
rs (seller, price, stock, discount), sorted by price |
101 | POST | `/api/cart/quote` | – | `{items:[{offer_id, quantity}
           ]}` → current price, stock and line totals per item, plus warn
ings (`out_of_stock`, `quantity_reduced`, `inactive`) |

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
97 | GET | `/api/home` | – | Ordered homepage blocks with their d
ata |
98 | GET | `/api/products` | – | Store listing: `q`, `platform[]`
, `region[]`, `min_price`, `max_price` (cents), `sort` (`relev
           ance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `p
           age`. Returns `{data, meta:{page, per_page, total, last_page},
            facets:{platforms:[{slug,name,count}], regions:[…], price:{mi
           n_cents,max_cents}}}`. See [Store API](#store-api) |
99 | GET | `/api/search/suggest?q=` | – | Top 6 matches for autoc
omplete (same engine as the listing) |
100 -| GET | `/api/products/{slug}` | – | Product details plus offe
-rs (seller, price, stock, discount), sorted by price |  
 100 +| GET | `/api/products/{slug}` | – | Product details plus acti
+ve offers (seller, price, stock, discount), in stock first, th
+en by price. 404 `{"message":"Not found."}` for an unknown slu
+g |  
 101 | POST | `/api/cart/quote` | – | `{items:[{offer_id, quantity}
           ]}` → current price, stock and line totals per item, plus warn
ings (`out_of_stock`, `quantity_reduced`, `inactive`) |
102 | GET | `/sanctum/csrf-cookie` | – | Sets the `XSRF-TOKEN` coo
kie before login/register |
103 | POST | `/api/register` | – | Create an account and sign in |

● Update(docs\ARCHITECTURE.md)
⎿  Added 28 lines
108 | GET | `/api/orders` | user | The current user's orders, newe
st first |
109 | GET | `/api/orders/{id}` | user | Order with items and key c
odes. 404 if it belongs to someone else |
110  
 111 +### Store API  
 112 +  
 113 +Implemented by `ProductController` → `ProductCatalog` (`app/Se
          +rvices/Catalog/`). One `applyFilters()` serves both the result
+s and the facets, so the two can't drift apart.  
 114 +  
 115 +**`GET /api/products` parameters**  
 116 +  
 117 +| Param | Rules | Default |  
 118 +|---|---|---|  
 119 +| `q` | ≤ 100 chars. Trimmed, lower-cased and whitespace colla
+psed. Matches a substring of `lower(title)`, with LIKE wildcar
+ds escaped. M3 adds fuzzy matching | – |  
 120 +| `platform[]`, `region[]` | Slugs, ≤ 10 each. OR within a dim
+ension, AND across dimensions. An unknown slug matches nothing + | all |  
 121 +| `min_price`, `max_price` | Integer cents, inclusive, 0–1 000 + 000, `max ≥ min`. They apply to the from-price, so setting ei
+ther one drops out-of-stock products | – |  
 122 +| `sort` | `relevance` (tier, then sales), `price_asc` / `pric
          +e_desc` (out of stock last), `newest` (no release date last), +`bestselling` (all-time units sold). Every sort ends on `id`,
+so pages are stable. `relevance` without `q` becomes `bestsell
          +ing` | `relevance` if `q` is set, otherwise `bestselling` |  
 123 +| `page` | 1–1000, with 24 products per page. A page past the
+end returns `data: []` with the real `meta` | 1 |  
 124 +  
 125 +Invalid parameters return 422.  
 126 +  
 127 +**Fields**  
 128 +  
 129 +- **Each product in `data`** has `id, slug, title, cover_url, 
          +platform{slug,name}, region{slug,name}, release_date|null, msr
          +p_cents, currency, from_price_cents|null, discount_percent|nul
          +l, in_stock`.  
 130 +- **Facets** list every platform and every region (zero counts + included), sorted by name. `price` is `{min_cents, max_cents}
          +`, or both `null` when nothing is in stock.  
 131 +- **`discount_percent`** is `floor(100 · (msrp − price) / msrp
          +)`. It is `null` unless the price is at least 1% below MSRP. T
+he rule lives in `App\Support\Discount`.  
 132 +- **`GET /api/products/{slug}`** adds `description` and `offer
          +s[]` to the product fields.  
 133 + - Each offer has `id, seller{id,name,rating}, price_cents, c
          +urrency, discount_percent|null, stock, in_stock`.  
 134 + - `rating` is a JSON number, and `stock` counts available ke
+ys only.  
 135 + - Offers are active ones only, in stock first, then by price
+, then `id`. So `offers[0]` is the best offer whenever any off
+er is in stock.  
 136 +  
 137 +**Store URL.** The SPA keeps the same names and cents in the b
+rowser URL, but repeats plain keys for lists (`?platform=steam
          +&platform=xbox`). `frontend/src/features/store/storeParams.ts` + maps between the URL, the state and the API query. It parses
+leniently: invalid values are dropped, so a hand-edited URL ne
+ver causes a 422. Every committed change pushes a history entr
+y, so Back restores the previous filters.  
 138 +  
 139 ### Frontend routes
140  
 141 `/` homepage · `/store` (also the search results page) · `/pro
           duct/:slug` · `/cart` · `/checkout` (protected) · `/orders` an
d `/orders/:id` (protected) · `/login` · `/register`

● Update(docs\DESIGN.md)
⎿  Added 1 line, removed 1 line
120 ### Product card (02, 03, 04)
121  
 122 - **Box:** `surface-card` with `rounded-sm` corners. On hover,
a 1px `line-strong` outline. The whole card links to the prod
uct page.
123 -- **Cover:** 4:5 aspect (**Estimate**, from about 125×155 in t
-he screenshot). A band at the bottom of the cover (`rgb(0 0 0 
          -/ 0.5)`) shows the platform name (`text-xs` 600, centered).  
 123 +- **Cover:** 3:4 aspect, matching our placeholder covers (300×
+400). The screenshot measures about 125×155 (close to 4:5, an +**Estimate**), so the difference is within measurement error.
+A band at the bottom of the cover (`rgb(0 0 0 / 0.5)`) shows t
+he platform name (`text-xs` 600, centered).  
 124 - **Body (12px padding), top to bottom:**
125 - Title: `text-sm` 600, 2-line clamp.
126 - Region: `text-xs` 700, uppercase, in `region-ok` or `regio
           n-limited`.

● Update(docs\DESIGN.md)
⎿  Added 1 line, removed 1 line
120 ### Product card (02, 03, 04)
121  
 122 - **Box:** `surface-card` with `rounded-sm` corners. On hover,
a 1px `line-strong` outline. The whole card links to the prod
uct page.
123 -- **Cover:** 3:4 aspect, matching our placeholder covers (300×
-400). The screenshot measures about 125×155 (close to 4:5, an -**Estimate**), so the difference is within measurement error.
-A band at the bottom of the cover (`rgb(0 0 0 / 0.5)`) shows t
-he platform name (`text-xs` 600, centered).  
 123 +- **Cover:** 3:4 aspect. Eneba's cover measures about 125×155
+in the screenshot (≈ 4:5, **Estimate**). We use 3:4 so our pla
+ceholder covers (300×400) show without cropping. A band at the + bottom of the cover (`rgb(0 0 0 / 0.5)`) shows the platform n
+ame (`text-xs` 600, centered).  
 124 - **Body (12px padding), top to bottom:**
125 - Title: `text-sm` 600, 2-line clamp.
126 - Region: `text-xs` 700, uppercase, in `region-ok` or `regio
           n-limited`.

● The docs are updated. I'm waiting on the full backend suite before committing.

Ran 1 shell command (ctrl+o to expand)

● The full backend suite is still running; it takes several minutes against
Neon. I'll report when it finishes.

● Background command "Run full backend test suite" completed (exit code 0)

Read 1 file (ctrl+o to expand)

● The Store page (M2) and product page (M4) are built and the automated checks
pass. I haven't done the in-browser checks: back/forward, the filter drawer,
and the 375px and 1440px layouts. Because of that I haven't ticked the M2 and
M4 boxes in docs/PLAN.md.

Check results

- Backend tests: 69/69 pass, including 44 new ones. Code style (Pint) is
  clean.
- Frontend: lint, typecheck and build are clean, and 47/47 tests pass.
- Against the seeded dev data:
  - The listing returns 30 products and the facet counts add up.
  - The 2 sold-out products come last on price sorts.
  - Hollow Knight shows both offers with stock: 0.
  - An unknown slug or route returns 404 {"message":"Not found."}.
  - Bad parameters return 422.
- Requests take about 1.3 s locally because each one makes 5 round trips to
  the database in Frankfurt. On Render, which runs next to Neon, they should
  be much faster.

Your "done when" list

- Backend tests: every filter, every sort, pagination including a page past
  the end, the facets, and a sold-out offer, using a small fixed catalog in
  StoreCatalog.php (backend/tests/Support/StoreCatalog.php).
- Unknown slug: ProductPage.tsx
  (frontend/src/features/product/ProductPage.tsx) shows the 404 page, and a
  test covers it.
- Back button: every filter change adds a browser history entry. A test
  applies three changes and steps back through each. Price and name inputs
  only commit on Enter or leaving the field, so Back steps through real filter
  states rather than keystrokes.

Changes from the approved plan

- URL format: lists use plain repeated keys (?platform=steam&platform=xbox),
  because the API's platform[] form looks ugly once encoded in the address
  bar. The names and cents units are otherwise the same as the API. Only the
  call to the API uses platform[].
- Wordmark: I invented "KeyMarket" for the header, since Eneba's logo can't be
  used. Change it if you have a name in mind.
- Cover band: the strip under the cover that shows the platform name uses the
  scrim token (45% black). DESIGN.md gives 50% black for it, but there is no
  token for that, and I reused one rather than add a token without asking.
- Name filter: it's a simple substring match for now, as agreed. Typo
  tolerance comes in M3.
- Docs: ARCHITECTURE.md has a new "Store API" section, and DESIGN.md now says
  covers are 3:4.

Nothing is committed yet; the changes are on feat/m2-m4-store-product. The API
and the frontend dev server are still running, so you can try it at
http://localhost:5173/store. Once your browser check passes, tell me and I'll
tick the PLAN boxes and commit.
