> <ide_opened_file>The user opened the file
> c:\Users\Andrius\Desktop\Eneba\eneba-marketplace\ai-logs\06-search.md in the
> IDE. This may or may not be related to the current task.</ide_opened_file>

> The Homepage milestone from @docs/PLAN.md.
> Goal: a homepage assembled from 3 blocks: hero banner, best sellers, deals.
> The backend returns the ordered list of blocks; each block's content comes
> from its own service or table (banners table, best sellers from order data,
> deals from discounted offers).
> Constraints: the frontend maps block type -> component and contains no
> hardcoded content; an unknown block type is skipped instead of crashing; one
> failing block doesn't break the page.
> Done when: reordering or disabling a block in the database changes the
> homepage without a frontend deploy; each block provider has a test.
> Plan first.
> ⎿  Read docs\PLAN.md (177 lines)

● I'll start by reading the architecture and spec sections for the homepage,
then the existing backend/frontend patterns.

Searched for 4 patterns, read 9 files (ctrl+o to expand)

● Now the frontend side: routes, API client patterns, the product card and a
test example.

Searched for 3 patterns, read 8 files (ctrl+o to expand)

● Let me look at the two homepage reference screenshots for the hero and
carousel layout.

Read 2 files (ctrl+o to expand)

● Checking a few remaining things: test setup, seeded order dates (for the
90-day window), how frontend tests mock fetch, and branch state.

Searched for 3 patterns, read 2 files, ran 2 shell commands (ctrl+o to expand)

● I have enough context. Three decisions aren't settled by SPEC/ARCHITECTURE, so
I'll ask before finalizing the plan.

● User answered Claude's questions:
⎿  · Best sellers ranks products by units sold in the last config.days days.
ARCHITECTURE.md doesn't say what to do when a best seller is now sold out.
Should sold-out products appear in the best sellers row? → Leave them out
(Recommended)
· How should the hero_banner block lay out its banners (3 seeded)? Eneba's
homepage (docs/design/01-home.jpg) shows one large banner with smaller
tiles beside it. → Static mosaic (Recommended)
· Eneba puts a 'View all' button under each product row. Should the best
sellers and deals rows have one? → Yes, from block config (Recommended)

● Answers noted. Writing the plan now.

● Updated plan
⎿  /plan to preview

● User approved Claude's plan
⎿  Plan saved to:
~\.claude\plans\pasted-content-id-f685-the-homepage-inherited-stallman.md ·
/plan to edit
M7 — Homepage from GET /api/home

     Context

     / still shows the M0 SkeletonPage ("API OK"). M7 replaces it with a
     homepage built from the homepage_blocks table: hero banner, best sellers,
     deals. The order, titles and on/off state come from the database, and each
     block type has its own backend provider and data source. The frontend only
     maps type → component. The tables, models, factories and seed rows already
     exist from M1 (HomepageSeeder, catalog.php › homepage_blocks). Nothing
     reads them yet.

     Decisions settled with you:
     - Best sellers leaves out sold-out products, so every card on the homepage
       can be bought.
     - The hero is a static mosaic. On lg+ the first banner is large and the
       others are stacked tiles on the right. On mobile it's a swipeable
       scroll-snap row. No autoplay.
     - "View all" comes from config.link_url on the block row. The button
       renders only when the API sends a link.

     Branch: feat/m7-homepage off feat/m3-search, because M3 isn't on
     origin/main yet. Rebase onto main once M3 merges.

     Backend (backend/)

     Contract. GET /api/home returns {data: [{id, type, title, link_url|null,
     data: [...]}]}. data is always a list: banners for hero_banner,
     ProductSummaryResource items for the two product blocks.

     New files in app/Services/Homepage/:
     - BlockProvider.php: the interface fetch(array $config): array, as in
       ARCHITECTURE.md.
     - BlockProviderRegistry.php: a type => class-string<BlockProvider> map.
       get(string $type): ?BlockProvider resolves through the container, so
       tests can swap a provider with app()->instance(...). It's bound as a
       singleton in AppServiceProvider::register(), which holds the 3 entries.
     - BlockConfig.php: int($config, $key, $default, $min, $max) reads a config
       value and clamps it. A missing or non-int value falls back to the
       default, so a bad config row can't throw.
     - HomepageService.php:
       a. Load
          HomepageBlock::where('is_active')->orderBy('position')->orderBy('id').
       b. For each row:
          - Unknown type → Log::warning and skip.
          - try { fetch } → catch (Throwable) → Log::error (block id, type,
            exception) and skip.
          - Empty data → skip.
       c. link_url is config.link_url only when it's a string starting with /
          (and not //). Otherwise it's null, so the database can't inject an
          external or javascript: link.
     - Providers/BannerProvider.php: banners WHERE is_active ORDER BY position,
       id, limited by limit (default 5, 1–10). Returns {id, title, subtitle,
       image_url, link_url}.
     - Providers/BestSellersProvider.php:
       - Joins ProductCatalog's base query to a subquery of
         SUM(order_items.quantity) over orders with paid_at >= now() − days,
         grouped by offers.product_id. The inner join keeps only products sold
         in the window.
       - Keeps only from_price_cents IS NOT NULL (in stock).
       - Orders by units desc, then id.
       - days defaults to 30 (1–365) and limit to 12 (1–24).
     - Providers/DealsProvider.php:
       - Starts from the same base query, where from_price_cents is already "the
         cheapest active in-stock offer".
       - Keeps rows where from_price_cents < msrp_cents and (100*(msrp − from))
         / msrp >= min_discount. Integer division gives the same floor as
         App\Support\Discount.
       - Orders by from_price_cents::numeric / msrp_cents ascending (biggest
         discount first), then id.
       - min_discount defaults to 1 (1–99) and limit to 12.
     - Both product providers return
       ProductSummaryResource::collection(...)->resolve() with platform and
       region eager-loaded.

     Changes to existing files:
     - app/Services/Catalog/ProductCatalog.php: make the private catalog()
       builder public, with a doc comment, so providers reuse the from-price and
       sales subqueries instead of copying them. Nothing else in this file
       changes.
     - app/Http/Controllers/HomeController.php (new, invokable and thin) plus
       routes/api.php: add Route::get('/home', HomeController::class).
     - database/seeders/data/catalog.php: add 'link_url' =>
       '/store?sort=bestselling' to the best_sellers config. Deals gets no link,
       because the Store has no deals filter.

     Frontend (frontend/src/)

     - api/home.ts:
       - HomeBlock = {id, type, title, link_url: string|null, data: unknown}.
       - A guard that checks only the envelope. Each block narrows its own data.
       - fetchHome() and useHome() (useQuery(['home'])). Uses the existing
         getJson and guards in api/client.ts and api/guards.ts.
     - blocks/blockRegistry.tsx:
       - defineBlock(isData, render) returns a (block) => ReactNode renderer. A
         known type whose data fails its guard renders null.
       - renderBlock(block) looks the type up with Object.hasOwn, so a type like
         toString can't hit the prototype. Unknown types render null.
       - Entries: hero_banner → HeroBanner; best_sellers and deals →
         ProductCarousel (validated with the existing isProductSummary).
     - blocks/HeroBanner.tsx:
       - The mosaic described above, with the block title as an sr-only h2.
       - Internal links (/…) use router Link.
       - Banner title and subtitle are HTML text over a scrim. The image gets
         alt="", because the placeholder SVGs carry no text.
     - blocks/ProductCarousel.tsx:
       - text-h2 title.
       - A horizontal scroll-snap ul of the existing ProductCard: 5 visible on
         lg, fewer below.
       - Prev/next icon buttons on sm+ (scrollBy, using the existing Button icon
         variant).
       - A secondary "View all" link when link_url is set.
     - blocks/BlockErrorBoundary.tsx: a small class boundary that renders null
       and calls console.error. No new dependency.
     - features/home/HomePage.tsx:
       - A visually hidden h1 (brand) and <title>.
       - States:
         - Loading: a hero skeleton plus a row of ProductCardSkeleton.
         - Error: an alert with a retry button, like StorePage.
         - No blocks: a short message and a Store link.
         - Otherwise: the blocks in API order, each in BlockErrorBoundary, with
           a 48px gap (gap-12).
     - routes.tsx: / → HomePage. Delete pages/SkeletonPage.tsx,
       features/health/HealthStatus(.test).tsx and api/health.ts, which nothing
       uses after this. The /api/health endpoint itself stays.
     - Styling uses DESIGN.md tokens only, with no raw hex or px. Full Eneba
       polish stays in M8.

     Tests

     Pest (backend):
     - tests/Feature/Homepage/BannerProviderTest.php: active only, position
       order, limit.
     - tests/Feature/Homepage/BestSellersProviderTest.php:
       - ranked by units in the window
       - orders older than days ignored
       - sold-out products left out
       - limit
       - from_price_cents present
     - tests/Feature/Homepage/DealsProviderTest.php:
       - only products below MSRP
       - the min_discount boundary (exactly at the threshold is in, 1% under is
         out)
       - the cheapest in-stock active offer is used (inactive and out-of-stock
         offers ignored)
       - discount order, limit
     - tests/Feature/HomepageTest.php (endpoint):
       - position order
       - inactive block hidden
       - unknown type skipped and logged
       - a provider that throws is left out while the others return (logged)
       - an empty block left out
       - link_url passed through only for safe paths
       - response shape

     Vitest (frontend):
     - blocks/blockRegistry.test.tsx: an unknown type renders nothing, a
       prototype key renders nothing, and a known type with bad data renders
       nothing.
     - features/home/HomePage.test.tsx (mocked fetch, like StorePage.test.tsx):
       - blocks render in API order
       - "View all" appears only with a link_url
       - a block that throws while rendering doesn't hide its siblings

     Docs

     - docs/ARCHITECTURE.md › Homepage block design, and the API table row:
       - the response shape including link_url
       - per-block data shapes
       - config keys with their defaults and clamps
       - sold-out products left out of best sellers
       - unknown types logged as a warning
     - docs/PLAN.md: tick M7 and add a "Verified" note once the checks below
       pass.

     Verification

     1. php artisan test (Neon test branch) and vendor/bin/pint --test. Then npm
        run test, npm run lint, npm run typecheck and npm run build.
     2. Locally on the Neon dev branch, with php artisan serve and npm run dev:
        - Check / at 375px and 1440px: the hero mosaic, both rows and "View all"
          on best sellers.
        - No horizontal page scroll at 375px.
     3. DB-driven change on dev, through tinker:
        - Set is_active=false on deals and swap the hero and best-sellers
          positions. Reload: the page changes with no rebuild.
        - Then revert.
        - Also set an unknown type to show it's skipped.
     4. Production, after merge (you run these in the Neon console, since the
        seeder won't re-run there):
        - UPDATE homepage_blocks SET config = config ||
          '{"link_url":"/store?sort=bestselling"}' WHERE type='best_sellers'
        - Then the PLAN check: disable deals and swap two positions, and the
          live homepage changes on reload.

● Plan approved. Creating the branch and reading the remaining files I'll build
on.

Ran 1 shell command (ctrl+o to expand)

● The existing StoreCatalog fixture already covers both product providers,
including the cheaper sold-out and inactive-offer traps. Checking the
remaining test and frontend files next. · summary

Ran 1 shell command (ctrl+o to expand)

● Starting the backend: interface, config helper, registry, and the three
providers.

● Write(backend\app\Services\Homepage\BlockProvider.php)
⎿  Wrote 16 lines to backend\app\Services\Homepage\BlockProvider.php
1 <?php
2
3 namespace App\Services\Homepage;
4
5 /\*_
6 _ One homepage block type (ARCHITECTURE.md › Homepage block des
ign). Each provider reads only its own
7 _ data source. HomepageService catches anything it throws, so a
broken provider costs only its block.
8 _/
… +8 lines (ctrl+o to expand)

● Write(backend\app\Services\Homepage\BlockConfig.php)
⎿  Wrote 35 lines to backend\app\Services\Homepage\BlockConfig.php
1 <?php
2
3 namespace App\Services\Homepage;
4
5 /\*_
6 _ Reads values from a block's `config` jsonb. The row is edited
by hand in the database, so a missing
7 _ or mistyped value falls back to the default instead of failin
g the block.
8 _/
… +27 lines (ctrl+o to expand)

● Write(backend\app\Services\Homepage\BlockProviderRegistry.php)
⎿  Wrote 24 lines to
backend\app\Services\Homepage\BlockProviderRegistry.php
1 <?php
2
3 namespace App\Services\Homepage;
4
5 use Illuminate\Contracts\Container\Container;
6
7 /\*_ Block type (the `homepage_blocks.type` column) → provider cl
ass. Bound in AppServiceProvider. _/
8 final class BlockProviderRegistry
9 {
… +15 lines (ctrl+o to expand)

● Write(backend\app\Services\Homepage\Providers\BannerProvider.php)
⎿  Wrote 30 lines to
backend\app\Services\Homepage\Providers\BannerProvider.php
1 <?php
2
3 namespace App\Services\Homepage\Providers;
4
5 use App\Models\Banner;
6 use App\Services\Homepage\BlockConfig;
7 use App\Services\Homepage\BlockProvider;
8
9 /\*_ `hero_banner`: active rows of the `banners` table, in positi
on order. _/
… +21 lines (ctrl+o to expand)

● Now exposing the catalog's base query, then the two product providers.

● Update(backend\app\Services\Catalog\ProductCatalog.php)
⎿  Added 7 lines, removed 2 lines
109 return $product;
110 }
111  
 112 - /** @return Builder<Product> products with from_price_cent
-s and sales, aliased as `products` \*/  
 113 - private function catalog(): Builder  
 112 + /**  
 113 + _ Every product with the derived columns from_price_cents + and sales, aliased as `products`.  
 114 + _ Public so the homepage providers rank and filter on the + same from-price as the Store.  
 115 + _  
 116 + _ @return Builder<Product>  
 117 + \*/  
 118 + public function catalog(): Builder  
 119 {
120 $fromPrice = Offer::query()
121 ->selectRaw('min(offers.price_cents)')

● Write(backend\app\Services\Homepage\Providers\BestSellersProvider.php)
⎿  Wrote 44 lines to
backend\app\Services\Homepage\Providers\BestSellersProvider.php
1 <?php
2
3 namespace App\Services\Homepage\Providers;
4
5 use App\Http\Resources\ProductSummaryResource;
6 use App\Models\OrderItem;
7 use App\Services\Catalog\ProductCatalog;
8 use App\Services\Homepage\BlockConfig;
9 use App\Services\Homepage\BlockProvider;
… +35 lines (ctrl+o to expand)
● Write(backend\app\Services\Homepage\Providers\DealsProvider.php)
⎿  Wrote 36 lines to
backend\app\Services\Homepage\Providers\DealsProvider.php
1 <?php
2
3 namespace App\Services\Homepage\Providers;
4
5 use App\Http\Resources\ProductSummaryResource;
6 use App\Services\Catalog\ProductCatalog;
7 use App\Services\Homepage\BlockConfig;
8 use App\Services\Homepage\BlockProvider;
9
10 /\*\*
… +26 lines (ctrl+o to expand)

● Now the service, controller, route and registry binding.

● Write(backend\app\Services\Homepage\HomepageService.php)
⎿  Wrote 71 lines to backend\app\Services\Homepage\HomepageService.php
1 <?php
2
3 namespace App\Services\Homepage;
4
5 use App\Models\HomepageBlock;
6 use Illuminate\Support\Facades\Log;
7 use Throwable;
8
9 /\*_
10 _ Builds GET /api/home from the `homepage_blocks` table (ARCHIT
… +62 lines (~2 KB) (ctrl+o to expand)

● Write(backend\app\Http\Controllers\HomeController.php)
⎿  Wrote 14 lines to backend\app\Http\Controllers\HomeController.php
1 <?php
2
3 namespace App\Http\Controllers;
4
5 use App\Services\Homepage\HomepageService;
6 use Illuminate\Http\JsonResponse;
7
8 final class HomeController extends Controller
9 {
10 public function \_\_invoke(HomepageService $homepage): JsonRes
… +5 lines (ctrl+o to expand)

● Update(backend\routes\api.php)
⎿  Added 1 line
1 <?php
2  
 3 use App\Http\Controllers\HealthController;
4 +use App\Http\Controllers\HomeController;  
 5 use App\Http\Controllers\ProductController;
6 use App\Http\Controllers\SearchController;
7 use Illuminate\Support\Facades\Route;

● Update(backend\routes\api.php)
⎿  Added 2 lines
8  
 9 Route::get('/health', HealthController::class);
10  
 11 +Route::get('/home', HomeController::class);  
 12 +  
 13 Route::get('/search/suggest', [SearchController::class, 'sugges
t']);
14  
 15 Route::get('/products', [ProductController::class, 'index']);

● Write(backend\app\Providers\AppServiceProvider.php)
⎿  Added 12 lines, removed 1 line
2  
 3 namespace App\Providers;
4  
 5 +use App\Services\Homepage\BlockProviderRegistry;  
 6 +use App\Services\Homepage\Providers\BannerProvider;  
 7 +use App\Services\Homepage\Providers\BestSellersProvider;  
 8 +use App\Services\Homepage\Providers\DealsProvider;  
 9 +use Illuminate\Contracts\Foundation\Application;  
 10 use Illuminate\Support\ServiceProvider;
11  
 12 class AppServiceProvider extends ServiceProvider
...
16 \*/
17 public function register(): void
18 {
14 - //  
 19 + // Homepage block types: `homepage_blocks.type` → provi
+der. A new block type needs one entry  
 20 + // here and one in the frontend's blockRegistry.  
 21 + $this->app->singleton(BlockProviderRegistry::class, fn 
         +(Application $app) => new BlockProviderRegistry($app, [
 22 + 'hero_banner' => BannerProvider::class,
 23 + 'best_sellers' => BestSellersProvider::class,
 24 + 'deals' => DealsProvider::class,
 25 + ]));  
 26 }
27  
 28 /\*\*

● Update(backend\database\seeders\data\catalog.php)
⎿  Added 1 line, removed 1 line
105 'homepage_blocks' => [
106 ['type' => 'hero_banner', 'title' => 'Featured', 'conf
ig' => ['limit' => 5]],
107 // 90 days, not 30: production is seeded once, so a 30
-day window would empty this block a month after the first dep
loy.
108 - ['type' => 'best_sellers', 'title' => 'Best sellers',
-'config' => ['limit' => 12, 'days' => 90]],  
 108 + ['type' => 'best_sellers', 'title' => 'Best sellers',
+'config' => ['limit' => 12, 'days' => 90, 'link_url' => '/stor
+e?sort=bestselling']],  
 109 ['type' => 'deals', 'title' => 'Deals', 'config' => ['
limit' => 12, 'min_discount' => 10]],
110 ],
111 ];

● Hardening one spot: a hand-edited config that isn't a JSON object (e.g. "x")
would cause a TypeError outside the try. I'll normalize it once.

● Update(backend\app\Services\Homepage\HomepageService.php)
⎿  Added 1 line, removed 3 lines
33 continue;
34 }
35  
 36 - $config = $block->config ?? [];                    
      37 -                                                               
      36              $result[] = [
      37                  'id' => $block->id,
      38                  'type' => $block->type,
      39                  'title' => $block->title,
      42 -                'link_url' => BlockConfig::path($config, 'link\_
-url'),  
 40 + 'link_url' => BlockConfig::path($this->config($
+block), 'link_url'),  
 41 'data' => $data,
42 ];
43 }

● Update(backend\app\Services\Homepage\HomepageService.php)
⎿  Added 14 lines, removed 1 line
59 }
60  
 61 try {
62 - return $provider->fetch($block->config ?? []);  
 62 + return $provider->fetch($this->config($block));    
      63          } catch (Throwable $e) {
      64              Log::error('Homepage block skipped: provider failed
          ', $context + ['exception' => $e]);
      65  
      66              return null;
      67          }
      68      }
      69 +                                                               
      70 +    /**                                                        
      71 +     * The block's config as an object. The column is edited by
         + hand, so a JSON array, string or                              
      72 +     * null counts as an empty config rather than a type error.
      73 +     *                                                         
      74 +     * @return array<string, mixed>                            
      75 +     */                                                        
      76 +    private function config(HomepageBlock $block): array       
      77 +    {                                                          
      78 +        $config = $block->config;                              
      79 +                                                               
      80 +        return is_array($config) && ! array_is_list($config) ? 
         +$config : [];  
 81 + }  
 82 }

● Now the Pest tests: one per provider plus the endpoint test.

● Write(backend\tests\Feature\Homepage\BannerProviderTest.php)
⎿  Wrote 47 lines to
backend\tests\Feature\Homepage\BannerProviderTest.php
1 <?php
2
3 use App\Models\Banner;
4 use App\Services\Homepage\Providers\BannerProvider;
5 use Illuminate\Foundation\Testing\RefreshDatabase;
6
7 uses(RefreshDatabase::class);
8
9 /\*_ @param array<string, mixed> $config _/
10 function banners(array $config = []): array
… +37 lines (ctrl+o to expand)

● Write(backend\tests\Feature\Homepage\BestSellersProviderTest.php)
⎿  Wrote 71 lines to
backend\tests\Feature\Homepage\BestSellersProviderTest.php
1 <?php
2
3 use App\Models\Order;
4 use App\Models\OrderItem;
5 use App\Services\Homepage\Providers\BestSellersProvider;
6 use Illuminate\Foundation\Testing\RefreshDatabase;
7 use Tests\Support\StoreCatalog;
8
9 uses(RefreshDatabase::class);
… +62 lines (ctrl+o to expand)

● Write(backend\tests\Feature\Homepage\DealsProviderTest.php)
⎿  Wrote 56 lines to backend\tests\Feature\Homepage\DealsProviderTest.php
1 <?php
2
3 use App\Services\Homepage\Providers\DealsProvider;
4 use Illuminate\Foundation\Testing\RefreshDatabase;
5 use Tests\Support\StoreCatalog;
6
7 uses(RefreshDatabase::class);
8
9 // Discount of each product's from-price against its MSRP, in St
oreCatalog:
… +47 lines (ctrl+o to expand)

● Write(backend\tests\Feature\HomepageTest.php)
⎿  Wrote 135 lines to backend\tests\Feature\HomepageTest.php
1 <?php
2
3 use App\Models\Banner;
4 use App\Models\HomepageBlock;
5 use App\Services\Homepage\BlockProvider;
6 use App\Services\Homepage\Providers\DealsProvider;
7 use Illuminate\Foundation\Testing\RefreshDatabase;
8 use Illuminate\Support\Facades\Log;
9 use Illuminate\Testing\TestResponse;
10 use Tests\Support\StoreCatalog;
… +125 lines (ctrl+o to expand)

● Running the new backend tests and Pint.

Ran 1 shell command (ctrl+o to expand)

● Both failures were in the tests: the block() helper's + merge dropped every
config override, and two blocks shared position 3. I'm fixing both. · summary

● Update(backend\tests\Feature\HomepageTest.php)
⎿  Added 1 line, removed 1 line
20 /\*_ @param array<string, mixed> $attributes _/
21 function block(string $type, int $position, array $attributes =
[]): HomepageBlock
22 {
23 - return HomepageBlock::factory()->create(['type' => $type, '
-position' => $position, 'config' => []] + $attributes);  
 23 + return HomepageBlock::factory()->create(['type' => $type, '
+position' => $position] + $attributes + ['config' => []]);  
 24 }
25  
 26 function home(): TestResponse

● Update(backend\tests\Feature\HomepageTest.php)
⎿  Added 4 lines, removed 4 lines
49  
 50 it('orders blocks by position, so reordering is a database upda
te', function () {
51 $deals = block('deals', 1);
52 - $hero = block('hero_banner', 2);  
 53 - block('best_sellers', 3);  
 52 + block('hero_banner', 2);  
 53 + $best = block('best_sellers', 3);  
 54  
 55 expect(typesOf(home()))->toBe(['deals', 'hero_banner', 'bes
t_sellers']);
56  
 57 $deals->update(['position' => 3]);
58 - $hero->update(['position' => 1]);  
 58 + $best->update(['position' => 1]);  
 59  
 60 - expect(typesOf(home()))->toBe(['hero_banner', 'best_sellers
-', 'deals']);  
 60 + expect(typesOf(home()))->toBe(['best_sellers', 'hero_banner
+', 'deals']);  
 61 });
62  
 63 it('hides inactive blocks', function () {

● Running the full Pest suite and Pint in the background (Neon round-trips make
it take a few minutes) while I build the frontend.

Ran 2 shell commands (ctrl+o to expand)

● Now the frontend API module and block components.

● Write(frontend\src\api\home.ts) ⎿  Wrote 64 lines to frontend\src\api\home.ts
1 import { useQuery } from '@tanstack/react-query'
2 import { getJson } from './client'
3 import { isArrayOf, isNullable, isNumber, isObject, isString } f
rom './guards'
4
5 // Shape of GET /api/home (docs/ARCHITECTURE.md › Homepage block
design).
6
7 export type HomeBlock = {
8 id: number
… +56 lines (ctrl+o to expand)

● Write(frontend\src\blocks\BlockErrorBoundary.tsx)
⎿  Wrote 21 lines to frontend\src\blocks\BlockErrorBoundary.tsx
1 import { Component, type ErrorInfo, type ReactNode } from 'react
'
2
3 type Props = { blockType: string; children: ReactNode }
4 type State = { failed: boolean }
5
6 /\*_ Wraps one homepage block: if it throws while rendering, only
that block disappears. _/
7 export class BlockErrorBoundary extends Component<Props, State>
{
… +14 lines (ctrl+o to expand)

● Write(frontend\src\blocks\SmartLink.tsx)
⎿  Wrote 18 lines to frontend\src\blocks\SmartLink.tsx
1 import type { ReactNode } from 'react'
2 import { Link } from 'react-router'
3
4 /\*_ Same-site paths go through the router; anything else is a pl
ain link. URLs come from the API. _/
5 export function SmartLink({ href, className, children }: { href:
string; className?: string; children: ReactNode }) {
6 if (href.startsWith('/') && !href.startsWith('//')) {
7 return (
8 <Link to={href} className={className}>
… +10 lines (ctrl+o to expand)

● Banner link_url comes straight from the banners table. To be safe I'll only
allow same-site paths and http(s) URLs as links. Anything else, like
javascript:, renders without a link.

● Write(frontend\src\blocks\SmartLink.tsx)
⎿  Added 16 lines, removed 8 lines
1 import type { ReactNode } from 'react'
2 import { Link } from 'react-router'
3  
 4 -/** Same-site paths go through the router; anything else is a p
-lain link. URLs come from the API. \*/  
 5 -export function SmartLink({ href, className, children }: { href
-: string; className?: string; children: ReactNode }) {  
 6 - if (href.startsWith('/') && !href.startsWith('//')) {  
 4 +type Props = { href: string; className?: string; children: Reac
+tNode }  
 5 +  
 6 +/**  
 7 + _ A link whose URL comes from the database. Same-site paths go + through the router and http(s) URLs  
 8 + _ are plain links. Any other scheme (e.g. "javascript:") rende
+rs the content without a link.  
 9 + \*/  
 10 +export function SmartLink({ href, className, children }: Props) + {  
 11 + if (href.startsWith('/') && !href.startsWith('//') && !href.i
+ncludes('\\')) {  
 12 return (
13 <Link to={href} className={className}>
14 {children}
15 </Link>
16 )
17 }
13 - return (  
 14 - <a href={href} className={className}>  
 15 - {children}  
 16 - </a>  
 17 - )  
 18 + if (/^https?:\/\//i.test(href)) {  
 19 + return (  
 20 + <a href={href} className={className}>  
 21 + {children}  
 22 + </a>  
 23 + )  
 24 + }  
 25 + return <div className={className}>{children}</div>  
 26 }

Ran 1 shell command (ctrl+o to expand)

● Writing the hero, carousel and registry.

● Write(frontend\src\blocks\HeroBanner.tsx)
⎿  Wrote 53 lines to frontend\src\blocks\HeroBanner.tsx
1 import { useId } from 'react'
2 import type { Banner } from '../api/home'
3 import { SmartLink } from './SmartLink'
4
5 /\*_
6 _ `hero_banner`. Like Eneba's homepage (docs/design/01-home.jpg
): from lg, the first banner is large
7 _ and the next two are stacked tiles beside it; below lg, a swi
peable row. No autoplay.
8 _/
… +45 lines (ctrl+o to expand)

● I muddled the sizing in that first pass. Rewriting the tile layout with
explicit per-count rules, so no tile ends up with zero height (e.g. when only
one banner is active).

● Write(frontend\src\blocks\HeroBanner.tsx)
⎿  Added 26 lines, removed 18 lines
4  
 5 /**
6 _ `hero_banner`. Like Eneba's homepage (docs/design/01-home.jp
g): from lg, the first banner is large
7 - _ and the next two are stacked tiles beside it; below lg, a sw
-ipeable row. No autoplay.  
 7 + _ and the next ones are tiles beside it; below lg, a swipeable + row. No autoplay.  
 8 _/
9 export function HeroBanner({ title, banners }: { title: string;
banners: Banner[] }) {
10 const headingId = useId()
...
15 {title}
16 </h2>
17 <ul className="-mx-2 flex snap-x snap-mandatory overflow-
          x-auto [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg
          :gap-4 lg:overflow-visible">
18 - {banners.map((banner, index) => (  
 19 - <li  
 20 - key={banner.id}  
 21 - className={`flex shrink-0 basis-11/12 snap-start px
         --2 sm:basis-2/3 lg:px-0 ${tileSpan(index, banners.length)}`}  
 22 - >  
 23 - <BannerTile banner={banner} large={index === 0} />
24 - </li>  
 25 - ))}  
 18 + {banners.map((banner, index) => {  
 19 + const layout = tileLayout(index, banners.length)  
 20 + return (  
 21 + <li key={banner.id} className={`flex shrink-0 basis
         +-11/12 snap-start px-2 sm:basis-2/3 lg:px-0 ${layout.cell}`}>  
 22 + <BannerTile banner={banner} large={index === 0} s
+izing={layout.tile} />  
 23 + </li>  
 24 + )  
 25 + })}  
 26 </ul>
27 </section>
28 )
29 }
30  
 31 -/** Grid placement from lg: the first banner spans two columns
-and both rows of the side tiles. _/  
 32 -function tileSpan(index: number, count: number): string {  
 33 - if (count === 1) return 'lg:col-span-3'  
 34 - if (index === 0) return 'lg:col-span-2 lg:row-span-2'  
 35 - if (count === 2) return 'lg:row-span-2'  
 36 - return ''  
 31 +/\*\*  
 32 + _ Below lg every tile is 2:1. From lg, in a 3-column grid:  
 33 + _ - 1 banner: one full-width 3:1 tile.  
 34 + _ - 2 banners: a 2:1 tile over two columns, and a tall tile be
+side it that takes the same height.  
 35 + _ - 3 or more: the first spans two columns and two rows, and t
+akes the height of the 2:1 tiles  
 36 + _ stacked beside it. Any further banners flow on as 2:1 tile
+s.  
 37 + _/  
 38 +function tileLayout(index: number, count: number): { cell: stri
+ng; tile: string } {  
 39 + if (count === 1) return { cell: 'lg:col-span-3', tile: 'aspec
+t-2/1 lg:aspect-3/1' }  
 40 + if (count === 2) {  
 41 + return index === 0 ? { cell: 'lg:col-span-2', tile: 'aspect
+-2/1' } : { cell: '', tile: 'aspect-2/1 lg:aspect-auto lg:h-ful
+l' }  
 42 + }  
 43 + if (index === 0) return { cell: 'lg:col-span-2 lg:row-span-2'
+, tile: 'aspect-2/1 lg:aspect-auto lg:h-full' }  
 44 + return { cell: '', tile: 'aspect-2/1' }  
 45 }
46  
 39 -function BannerTile({ banner, large }: { banner: Banner; large: - boolean }) {  
 47 +function BannerTile({ banner, large, sizing }: { banner: Banner
+; large: boolean; sizing: string }) {  
 48 return (
49 <SmartLink
50 href={banner.link_url}
43 - className="group relative block aspect-2/1 w-full overflo
-w-hidden rounded-sm bg-surface outline-line-strong hover:outlin
-e lg:aspect-auto lg:min-h-full"  
 51 + className={`relative block w-full overflow-hidden rounded
         +-sm bg-surface outline-line-strong hover:outline ${sizing}`}  
 52 >
53 {/_ The title and subtitle are real text below, so the im
age itself is decorative. \*/}
46 - <img src={banner.image_url} alt="" className="absolute in
         -set-0 h-full w-full object-cover lg:aspect-2/1 lg:static" />  
 54 + <img src={banner.image_url} alt="" className="absolute in
         +set-0 h-full w-full object-cover" />  
 55 <div className="absolute inset-x-0 bottom-0 bg-scrim p-4"
          >
56 <p className={`${large ? 'text-lg lg:text-h2' : 'text-l
          g'} font-bold text-fg`}>{banner.title}</p>
57 {banner.subtitle !== null && <p className="mt-1 text-sm
           text-fg">{banner.subtitle}</p>}

● Write(frontend\src\blocks\ProductCarousel.tsx)
⎿  Wrote 91 lines to frontend\src\blocks\ProductCarousel.tsx
1 import { useCallback, useEffect, useId, useRef, useState } from
'react'
2 import type { ProductSummary } from '../api/products'
3 import { Button } from '../components/Button'
4 import { buttonClasses } from '../components/buttonClasses'
5 import { ProductCard } from '../components/ProductCard'
6 import { SmartLink } from './SmartLink'
7
8 type Props = { title: string; linkUrl: string | null; products:
ProductSummary[] }
… +83 lines (ctrl+o to expand)

● Write(frontend\src\blocks\blockRegistry.tsx)
⎿  Wrote 38 lines to frontend\src\blocks\blockRegistry.tsx
1 import type { ReactNode } from 'react'
2 import { isBanner, type HomeBlock } from '../api/home'
3 import { isArrayOf } from '../api/guards'
4 import { isProductSummary, type ProductSummary } from '../api/pr
oducts'
5 import { HeroBanner } from './HeroBanner'
6 import { ProductCarousel } from './ProductCarousel'
7
8 type BlockRenderer = (block: HomeBlock) => ReactNode
9
… +29 lines (ctrl+o to expand)

● Small cleanups: Tailwind 4.3 has a scrollbar-none utility, the isBanners type
was needlessly convoluted, and React.RefObject needs an explicit type import.

● Bash(cd /c/Users/Andrius/Desktop/Eneba/eneba-marketplace/frontend/src/blocks
&& sed -i 's/\[scrollbar-width:none\]/scrollbar-none/' HeroBanner.tsx
ProductCarousel.ts…)
⎿  Updated frontend\src\blocks\HeroBanner.tsx (+1 -1)
14 <h2 id={headingId} className="sr-only">
15 {title}
16 </h2>
17 - <ul className="-mx-2 flex snap-x snap-mandatory overflow-
         -x-auto [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-3 lg
         -:gap-4 lg:overflow-visible">  
 17 + <ul className="-mx-2 flex snap-x snap-mandatory overflow-
         +x-auto scrollbar-none lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-4 l
         +g:overflow-visible">  
 18 {banners.map((banner, index) => {
19 const layout = tileLayout(index, banners.length)
20 return (
⎿  Updated frontend\src\blocks\ProductCarousel.tsx (+3 -3)
1 -import { useCallback, useEffect, useId, useRef, useState } from
-'react'  
 1 +import { useCallback, useEffect, useId, useRef, useState, type R
+efObject } from 'react'  
 2 import type { ProductSummary } from '../api/products'
3 import { Button } from '../components/Button'
4 import { buttonClasses } from '../components/buttonClasses'
...
42 <ul
43 ref={listRef}
44 onScroll={update}
45 - className="-mx-2 flex snap-x snap-mandatory overflow-x-
-auto [scrollbar-width:none]"  
 45 + className="-mx-2 flex snap-x snap-mandatory overflow-x-
+auto scrollbar-none"  
 46 >
47 {products.map((product) => (
48 <li key={product.id} className="flex min-w-0 shrink-0
           basis-2/5 snap-start px-2 sm:basis-1/4 lg:basis-1/5">
...
63 }
64  
 65 /\*_ Whether the row is scrolled to its start or end, kept curre
nt on scroll and resize. _/
66 -function useScrollEdges(ref: React.RefObject<HTMLElement | null
->) {  
 66 +function useScrollEdges(ref: RefObject<HTMLElement | null>) {  
 67 const [edges, setEdges] = useState({ atStart: true, atEnd: tr
ue })
68  
 69 const update = useCallback(() => {
⎿  (files that changed while this command ran, by the command or by
another process; a convenience view, not a review or audit of the
command)

● Update(frontend\src\blocks\blockRegistry.tsx)
⎿  Added 2 lines, removed 3 lines
1 import type { ReactNode } from 'react'
2 -import { isBanner, type HomeBlock } from '../api/home'  
 2 +import { isBanner, type Banner, type HomeBlock } from '../api/ho
+me'  
 3 import { isArrayOf } from '../api/guards'
4 import { isProductSummary, type ProductSummary } from '../api/pr
oducts'
5 import { HeroBanner } from './HeroBanner'
...
12 return (block) => (isData(block.data) ? render(block, block.d
ata) : null)
13 }
14  
 15 -const isBanners = (data: unknown): data is HomeBlock['data'] &
-Parameters<typeof HeroBanner>[0]['banners'] =>  
 16 - isArrayOf(data, isBanner)  
 15 +const isBanners = (data: unknown): data is Banner[] => isArrayO
+f(data, isBanner)  
 16 const isProducts = (data: unknown): data is ProductSummary[] =>
isArrayOf(data, isProductSummary)
17  
 18 const productRow = (block: HomeBlock, products: ProductSummary[
]) => (

● Now the HomePage, the route, and removing the M0 placeholder files.

● Write(frontend\src\features\home\HomePage.tsx)
⎿  Wrote 71 lines to frontend\src\features\home\HomePage.tsx
1 import { Link } from 'react-router'
2 import { useHome } from '../../api/home'
3 import { Button } from '../../components/Button'
4 import { buttonClasses } from '../../components/buttonClasses'
5 import { CONTAINER } from '../../components/Layout'
6 import { ProductCardSkeleton } from '../../components/ProductCard
'
7 import { Skeleton } from '../../components/Skeleton'
8 import { BlockErrorBoundary } from '../../blocks/BlockErrorBounda
ry'
… +63 lines (ctrl+o to expand)

● Bash(cd /c/Users/Andrius/Desktop/Eneba/eneba-marketplace/frontend/src && git
rm -q pages/SkeletonPage.tsx features/health/HealthStatus.tsx
features/health/HealthStat…)
⎿  Deleted frontend\src\api\health.ts (+0 -33)
1 -import { useQuery } from '@tanstack/react-query'  
 2 -import { getJson } from './client'  
 3 -  
 4 -export type Health = {  
 5 - status: string  
 6 - db: string  
 7 -}  
 8 -  
 9 -export function isHealth(value: unknown): value is Health {  
 10 - return (  
 11 - typeof value === 'object' &&  
 12 - value !== null &&  
 13 - 'status' in value &&  
 14 - 'db' in value &&  
 15 - typeof value.status === 'string' &&  
 16 - typeof value.db === 'string'  
 17 - )  
 18 -}  
 19 -  
 20 -export async function fetchHealth(signal?: AbortSignal): Promis
-e<Health> {  
 21 - const body = await getJson('/api/health', signal)  
 22 - if (!isHealth(body)) {  
 23 - throw new Error('Unexpected health response')  
 24 - }  
 25 - return body  
 26 -}  
 27 -  
 28 -export function useHealth() {  
 29 - return useQuery({  
 30 - queryKey: ['health'],  
 31 - queryFn: ({ signal }) => fetchHealth(signal),  
 32 - })  
 33 -}  
 ⎿  Deleted frontend\src\features\health\HealthStatus.test.tsx (+0 -56)
1 -import { QueryClient, QueryClientProvider } from '@tanstack/rea
-ct-query'  
 2 -import { render, screen } from '@testing-library/react'  
 3 -import { afterEach, describe, expect, it, vi } from 'vitest'  
 4 -import { HealthStatus } from './HealthStatus'  
 5 -  
 6 -function renderWithClient() {  
 7 - const client = new QueryClient({ defaultOptions: { queries: { - retry: false } } })  
 8 - return render(  
 9 - <QueryClientProvider client={client}>  
 10 - <HealthStatus />  
 11 - </QueryClientProvider>,  
 12 - )  
 13 -}  
 14 -  
 15 -function stubFetch(status: number, body: unknown) {  
 16 - const fetchMock = vi.fn(  
 17 - async () =>  
 18 - new Response(JSON.stringify(body), {  
 19 - status,  
 20 - headers: { 'Content-Type': 'application/json' },  
 21 - }),  
 22 - )  
 23 - vi.stubGlobal('fetch', fetchMock)  
 24 - return fetchMock  
 25 -}  
 26 -  
 27 -afterEach(() => {  
 28 - vi.unstubAllGlobals()  
 29 -})  
 30 -  
 31 -describe('HealthStatus', () => {  
 32 - it('shows "API OK" when the API and the database are up', asy
-nc () => {  
 33 - const fetchMock = stubFetch(200, { status: 'ok', db: 'ok' }
-)  
 34 -  
 35 - renderWithClient()  
 36 -  
 37 - expect(await screen.findByText('API OK')).toBeInTheDocument
-()  
 38 - expect(fetchMock).toHaveBeenCalledWith('/api/health', expec
-t.anything())  
 39 - })  
 40 -  
 … 16 more lines (ctrl+o to expand)
⎿  Deleted frontend\src\features\health\HealthStatus.tsx (+0 -16)
1 -import { useHealth } from '../../api/health'  
 2 -  
 3 -export function HealthStatus() {  
 4 - const { data, error, isPending } = useHealth()  
 5 -  
 6 - if (isPending) {  
 7 - return <p role="status">Checking API…</p>  
 8 - }  
 9 -  
 10 - if (error) {  
 11 - return <p role="alert">API error: {error.message}</p>  
 12 - }  
 13 -  
 14 - const healthy = data.status === 'ok' && data.db === 'ok'  
 15 - return <p role="status">{healthy ? 'API OK' : `API degraded (
         -db: ${data.db})`}</p>  
 16 -}  
 ⎿  Deleted frontend\src\pages\SkeletonPage.tsx (+0 -17)
1 -import { Link } from 'react-router'  
 2 -import { buttonClasses } from '../components/buttonClasses'  
 3 -import { CONTAINER } from '../components/Layout'  
 4 -import { HealthStatus } from '../features/health/HealthStatus'
5 -  
 6 -// Temporary M0 page. M7 replaces it with the homepage rendered - from GET /api/home.  
 7 -export function SkeletonPage() {  
 8 - return (  
 9 - <main className={`${CONTAINER} py-6`}>  
 10 - <h1 className="text-h1 font-bold">Eneba marketplace</h1>
11 - <HealthStatus />  
 12 - <Link to="/store" className={buttonClasses('primary', 'md
-', 'mt-4')}>  
 13 - Browse the store  
 14 - </Link>  
 15 - </main>  
 16 - )  
 17 -}  
 ⎿  Updated frontend\src\routes.tsx (+2 -2)
1 import type { RouteObject } from 'react-router'
2 import { Layout } from './components/Layout'
3 +import { HomePage } from './features/home/HomePage'  
 4 import { ProductPage } from './features/product/ProductPage'
5 import { StorePage } from './features/store/StorePage'
6 import { NotFoundPage } from './pages/NotFoundPage'
6 -import { SkeletonPage } from './pages/SkeletonPage'  
 7  
 8 export const routes: RouteObject[] = [
9 {
10 element: <Layout />,
11 children: [
12 - { path: '/', element: <SkeletonPage /> },  
 12 + { path: '/', element: <HomePage /> },  
 13 { path: '/store', element: <StorePage /> },
14 { path: '/product/:slug', element: <ProductPage /> },
15 { path: '\*', element: <NotFoundPage /> },

● Now the Vitest tests: the registry, and the HomePage (order, View all, error
isolation).

● Write(frontend\src\blocks\blockRegistry.test.tsx)
⎿  Wrote 52 lines to frontend\src\blocks\blockRegistry.test.tsx
1 import { render, screen } from '@testing-library/react'
2 import { createMemoryRouter, RouterProvider } from 'react-router
'
3 import { describe, expect, it } from 'vitest'
4 import type { HomeBlock } from '../api/home'
5 import { HomeBlockView } from './blockRegistry'
6
7 function renderBlock(block: HomeBlock) {
8 const router = createMemoryRouter([{ path: '/', element: <Home
BlockView block={block} /> }])
… +44 lines (ctrl+o to expand)

● Write(frontend\src\features\home\HomePage.test.tsx)
⎿  Wrote 116 lines to frontend\src\features\home\HomePage.test.tsx
1 import { QueryClient, QueryClientProvider } from '@tanstack/reac
t-query'
2 import { render, screen, within } from '@testing-library/react'
3 import { createMemoryRouter, RouterProvider } from 'react-router
'
4 import { afterEach, describe, expect, it, vi } from 'vitest'
5 import type { HomeBlock } from '../../api/home'
6 import type { ProductSummary } from '../../api/products'
7 import { HomePage } from './HomePage'
8
… +108 lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Vitest is 65/65. Lint and typecheck printed nothing past their headers, so
I'll confirm the exit codes and run the build.

Ran 1 shell command (ctrl+o to expand)

● Frontend is all green. While Pest runs, I'll update ARCHITECTURE.md.

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
94 | Method | Path | Auth | Purpose |
95 |---|---|---|---|
96 | GET | `/api/health` | – | Liveness plus a DB ping. Used by t
he uptime pinger |
97 -| GET | `/api/home` | – | Ordered homepage blocks with their d
-ata |  
 97 +| GET | `/api/home` | – | Ordered homepage blocks with their d
+ata: `{data: [{id, type, title, link_url\|null, data: [...]}]}
          +`. See [Homepage block design](#homepage-block-design) |  
 98 | GET | `/api/products` | – | Store listing: `q`, `platform[]`
, `region[]`, `min_price`, `max_price` (cents), `sort` (`relev
           ance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `p
           age`. Returns `{data, meta:{page, per_page, total, last_page},
            facets:{platforms:[{slug,name,count}], regions:[…], price:{mi
           n_cents,max_cents}}}`. See [Store API](#store-api) |
99 | GET | `/api/search/suggest?q=` | – | Top 6 matches for autoc
omplete (same engine and order as the listing). `{data: [produ
           ct]}` with the Store's product fields. Empty `q` → `{data: []}
           `; `q` over 100 chars → 422 |
100 | GET | `/api/products/{slug}` | – | Product details plus acti
ve offers (seller, price, stock, discount), in stock first, th
en by price. 404 `{"message":"Not found."}` for an unknown slu
g |
● Update(docs\ARCHITECTURE.md)
⎿  Added 28 lines, removed 12 lines
146  
 147 `GET /api/home` → `HomepageService`:
148  
 149 -1. Load `homepage_blocks WHERE is_active ORDER BY position`.  
 150 -2. For each row, look up the provider for `type` in a registry
-. The registry is a type → class map bound in a service provid
-er.  
 151 -3. Call `provider->fetch(config)` inside a try/catch. If a pro
-vider throws, log the error and leave that block out. One brok
-en block never takes down the page.  
 152 -4. Leave out blocks with an unknown type or empty data.  
 153 -5. Return `[{id, type, title, data}]`.  
 149 +1. Load `homepage_blocks WHERE is_active ORDER BY position, id
          +`.  
 150 +2. For each row, look up the provider for `type` in `BlockProv
          +iderRegistry`. The registry is a type → class map bound in `Ap
          +pServiceProvider`, and it resolves providers through the conta
+iner.  
 151 +3. Call `provider->fetch(config)` inside a try/catch on `Throw
          +able`. If a provider throws, log an error (block id, type, exc
+eption) and leave that block out. One broken block never takes + down the page.  
 152 +4. Leave out blocks with empty data. Leave out blocks with an
+unknown type and log a warning, so a typo in `type` shows up i
+n the logs.  
 153 +5. Return `{data: [{id, type, title, link_url, data}]}`.  
 154  
 155 `php
      156  interface BlockProvider {
      157 -    public function fetch(array $config): array;   // block-sp
          -ecific payload                                                
      157 +    public function fetch(array $config): array;   // list of 
          +the block's items; [] hides the block                         
      158  }
      159  `
160  
 161 -| `type` | Provider | Data source |  
 162 -|---|---|---|  
 163 -| `hero_banner` | `BannerProvider` | `banners WHERE is_active 
          -ORDER BY position` |  
 164 -| `best_sellers` | `BestSellersProvider` | Products ranked by -`SUM(order_items.quantity)` over orders in the last `config.da
          -ys` days (seeded as 90, because production is seeded once and
-its orders age), up to `config.limit`, with each product's fro
-m-price |  
 165 -| `deals` | `DealsProvider` | For each product, its cheapest a
-ctive in-stock offer, kept only if `price_cents < msrp_cents`, - ordered by discount % (`config.limit`, `config.min_discount`) - |  
 161 +| `type` | Provider | Data source | `data` items |  
 162 +|---|---|---|---|  
 163 +| `hero_banner` | `BannerProvider` | `banners WHERE is_active 
          +ORDER BY position, id` | `{id, title, subtitle\|null, image_ur
          +l, link_url}` |  
 164 +| `best_sellers` | `BestSellersProvider` | Products ranked by +`SUM(order_items.quantity)` over orders paid in the last `conf
          +ig.days` days, then by id. Sold-out products (no from-price) a
+re left out, so every homepage card can be bought | Store prod
+uct fields |  
 165 +| `deals` | `DealsProvider` | Products whose from-price (their + cheapest active in-stock offer) is below MSRP by at least `co
          +nfig.min_discount` percent, using the same floor as `discount_
          +percent`. Biggest discount first, then id | Store product fiel
+ds |  
 166  
 167 +**Config.** `config` is edited by hand in the database, so eve
+ry value is optional. A missing or non-integer value takes the + default, an out-of-range one is clamped, and a config that is
+n't a JSON object counts as `{}`.  
 168 +  
 169 +| Key | Blocks | Default | Range |  
 170 +|---|---|---|---|  
 171 +| `limit` | `hero_banner` | 5 | 1–10 |  
 172 +| `limit` | `best_sellers`, `deals` | 12 | 1–24 |  
 173 +| `days` | `best_sellers` | 30 (seeded as 90, because producti
+on is seeded once and its orders age) | 1–365 |  
 174 +| `min_discount` | `deals` | 1 (seeded as 10) | 1–99 |  
 175 +| `link_url` | any | none | A same-site path for the block's "
+View all" link (seeded as `/store?sort=bestselling` on best se
+llers). Anything else, such as absolute, protocol-relative or +`javascript:` URLs, becomes `null` |  
 176 +  
 177 Adding a block type takes a provider class, one registry entry
, a React component and one `blockRegistry` entry. Reordering,
renaming or disabling blocks is a database update with no dep
loy.
178  
 179 **Frontend**
180  
 171 -`HomePage` makes one `useQuery(['home'])` call and maps over t
-he blocks: `blockRegistry[block.type]` → component (`HeroBanne
          -r`, `ProductCarousel`). Unknown types render `null`. Each bloc
-k is wrapped in an error boundary. The frontend contains no ti
-tles, product IDs or ordering.  
 181 +`HomePage` makes one `useQuery(['home'])` call, which checks o
+nly the block envelope, and renders the blocks in API order. E
+ach block is wrapped in `BlockErrorBoundary`, and `HomeBlockVi
          +ew` looks its type up in `blockRegistry` (`src/blocks/blockReg
          +istry.tsx`). Each entry pairs a data guard with a component (`
          +HeroBanner`, `ProductCarousel`).  
 182  
 183 +A block renders `null` when:  
 184 +- its type is unknown (looked up with `Object.hasOwn`, so `toS
          +tring` doesn't match), or  
 185 +- its data fails the guard.  
 186 +  
 187 +Banner links that aren't same-site paths or http(s) URLs rende
+r without a link. The frontend contains no titles, product IDs + or ordering.  
 188 +  
 189 ## Search approach
190  
 191 One `ProductSearch` class builds the query for both `/api/prod
           ucts` and `/api/search/suggest`.

● While Pest finishes, I'll start the API locally against the Neon dev branch
for the database-driven check.

Ran 2 shell commands (ctrl+o to expand)

● Real data comes through on the dev branch. Now the database-driven check: add
link_url (to match the new seed), disable deals, and swap the hero and best
sellers. Then I'll read the API again.

Ran 1 shell command (ctrl+o to expand)

● The reorder is applied, deals are hidden, and the link now comes through, with
the unknown countdown block skipped. I'm checking the log for the warning,
then reverting everything except link_url to match the seed. · summary

Ran 1 shell command (ctrl+o to expand)

● The checks against the dev database all pass, and I've reverted the changes.
I'm waiting for the full Pest run, which is still going against the Neon test
branch. I'll tick M7 in PLAN.md once it passes.

● Background command "Run Pint check and full Pest suite" completed (exit code 0)

Read 1 file (ctrl+o to expand)

● Pest passed 131/131 (100 existing plus 31 new) and Pint is clean. Updating
PLAN.md and stopping the dev server.

● Update(docs\PLAN.md)
⎿  Added 26 lines, removed 4 lines
149  
 150 ## M7 — Homepage
151  
 152 -- [ ] `BlockProvider` interface, provider registry, and `Banne
          -rProvider`, `BestSellersProvider` and `DealsProvider`.  
 153 -- [ ] `HomepageService` with per-provider try/catch and loggin
-g. Unknown or empty blocks are left out.  
 154 -- [ ] `GET /api/home`.  
 155 -- [ ] Frontend `blockRegistry`, `HeroBanner` and `ProductCarou
          -sel` components, and an error boundary per block.  
 152 +- [x] `BlockProvider` interface, provider registry, and `Banne
          +rProvider`, `BestSellersProvider` and `DealsProvider`.  
 153 +- [x] `HomepageService` with per-provider try/catch and loggin
+g. Unknown or empty blocks are left out.  
 154 +- [x] `GET /api/home`.  
 155 +- [x] Frontend `blockRegistry`, `HeroBanner` and `ProductCarou
          +sel` components, and an error boundary per block.  
 156  
 157 **Verify:** Pest tests: blocks come back in `position` order,
an inactive block is hidden, an unknown type is skipped, a pro
vider that throws is left out while the other blocks still ret
urn, and deals only include offers below MSRP. Vitest: an unkn
own type renders nothing. **Production check:** in Neon, run `
           UPDATE homepage_blocks SET is_active=false WHERE type='deals'`
and swap two positions. The live homepage changes on reload w
ith no redeploy.
158  
 159 +**Verified 2026-11-15** (except the production check, which wa
+its for the merge):  
 160 +- **Automated:**  
 161 + - Pest 131/131 on the `test` branch, and Pint is clean.  
 162 + - One test file per provider (`tests/Feature/Homepage/`):  
 163 + - Banners: active only, position order, limit.  
 164 + - Best sellers: the days window, sold-out products left ou
+t, ties.  
 165 + - Deals: below MSRP only, the `min_discount` boundary, ina
+ctive and sold-out offers ignored.  
 166 + - `HomepageTest`: order, reorder, inactive, unknown type log
+ged, a throwing provider left out while the others return, emp
+ty blocks, a non-object config, and `link_url` sanitizing.  
 167 + - Vitest 65/65: `blockRegistry` (unknown type, prototype key
+, bad data, unsafe banner link) and `HomePage` (API order, "Vi
+ew all" only with a link, a block that throws while rendering
+doesn't hide the others).  
 168 + - oxlint, `tsc -b` and the build pass.  
 169 +- **Manual, on the `dev` data:**  
 170 + - `/api/home` returns the 3 blocks with 3 banners, 12 best s
+ellers and 12 deals.  
 171 + - Through tinker:  
 172 + - Disabling deals, swapping the hero and best sellers, and + adding a `countdown` row changed the response with no restart
+.  
 173 + - The unknown type logged a warning.  
 174 + - Reverted afterwards.  
 175 +- **Changes from the plan:**  
 176 + - Best sellers leaves out sold-out products.  
 177 + - Blocks take an optional `config.link_url` for "View all".
178 + - The M0 `SkeletonPage` and `HealthStatus` were removed.  
 179 +- **After the merge:** production was seeded before `link_url` + existed. To add it, run in Neon: `UPDATE homepage_blocks SET 
          +config = config || '{"link_url":"/store?sort=bestselling"}' WH
          +ERE type='best_sellers'`.  
 180 +  
 181 ## M8 — Eneba styling
182  
 183 - [ ] Tokens taken from eneba.com (colors, font family and sca
le, spacing, radii, shadows) and recorded in the Tailwind `@th
           eme` block in `frontend/src/index.css` with comments naming th
e source.

● Stop Task
⎿  cd /c/Users/Andrius/Desktop/Eneba/eneba-marketplace/backend && php
artisan serve --port=8000 · stopped

Ran 1 shell command (ctrl+o to expand)

● M7 is built and verified locally. The homepage now comes entirely from GET
/api/home, so reordering or disabling a block in the homepage_blocks table
changes the page with no frontend deploy. I tried this on the Neon dev
database: I disabled deals, swapped the hero and best sellers, and added a
block with an unknown type. The response changed on the next request with no
restart, the unknown block was skipped with a warning in the log, and I put
everything back afterwards. Pest passes 131/131, Vitest 65/65, and Pint,
oxlint, tsc -b and the build are clean.

How it works:

- Backend: each block type has its own provider class. HomepageService.php
  (backend/app/Services/Homepage/HomepageService.php) reads the active blocks
  in position order and calls each provider inside a try/catch. A block is
  left out if its type is unknown, its provider throws, or it has nothing to
  show, and the rest of the page still loads. Best sellers and deals use the
  same from-price query as the Store.
- Frontend: blockRegistry.tsx (frontend/src/blocks/blockRegistry.tsx) maps
  each block type to a component and checks the block's data first. An unknown
  type or data with the wrong shape renders nothing. Each block also sits
  inside its own error boundary, so a block that crashes while rendering
  doesn't take the others with it.
- Tests: each provider has its own test file in tests/Feature/Homepage/
  (backend/tests/Feature/Homepage/), and HomepageTest.php
  (backend/tests/Feature/HomepageTest.php) covers the endpoint. That includes
  a provider that throws while the other blocks still return.

Decisions to know about:

- Your three choices are in: sold-out products are left out of best sellers,
  the hero is a static mosaic, and "View all" comes from config.link_url on
  the block row.
- Unsafe links are dropped: the backend only passes link_url through when it's
  a same-site path. Banner links that aren't a same-site path or an http(s)
  URL (e.g. javascript:) render as plain text.
- Bad config can't break a block: a config value that's missing, the wrong
  type or out of range falls back to a default or is clamped.
- Placeholder removed: I deleted the M0 placeholder page and the "API OK"
  status component. /api/health itself is unchanged.
- Docs: ARCHITECTURE.md (docs/ARCHITECTURE.md) now records the response shape,
  the config keys and these rules. PLAN.md (docs/PLAN.md) has M7 ticked with
  a "Verified" note.

Still to do:

- Visual check: I couldn't look at the page in a browser here, so the 375px
  and 1440px layout check is yours. Run npm run dev with php artisan serve and
  open /.
- Production, after the merge: production was seeded before link_url existed,
  so the "View all" button won't appear there until you run this in the Neon
  console:
  UPDATE homepage_blocks SET config = config ||
  '{"link_url":"/store?sort=bestselling"}' WHERE type='best_sellers'
  Then do the PLAN's production check: disable deals and swap two positions.

Everything is on the new branch feat/m7-homepage, cut from feat/m3-search
because M3 isn't merged yet. Rebase it onto main once M3 lands. Nothing is
committed yet; tell me when you want it committed.

> okay let's go

● Committing now. First I'll check whether the M3 branch has an open PR, since
that decides where this one should point.

Ran 1 shell command (ctrl+o to expand)

● M3 is already merged into main, so I'll commit and rebase onto origin/main.
That way the PR contains only M7.

● Bash(git add -A && git commit -q -F - <<'EOF'
feat: homepage assembled from database-driven blocks…)
⎿  Updated frontend\src\api\home.ts (+64 -64)
⎿  Updated frontend\src\blocks\BlockErrorBoundary.tsx (+21 -21)
⎿  Updated frontend\src\blocks\HeroBanner.tsx (+61 -61)
⎿  Updated frontend\src\blocks\ProductCarousel.tsx (+91 -91)
⎿  Updated frontend\src\blocks\SmartLink.tsx (+26 -26)
⎿  … 5 more files changed
⎿  (a git step in this command can move the working tree, so these may be
its changes, not edits) (ctrl+o to expand)

● The rebase went through cleanly, and the line-ending warnings are the usual
Windows ones. I'm pushing and opening the PR, but I won't merge it, since
merging deploys to production. · summary

Ran 1 shell command (ctrl+o to expand)

● I committed M7 and opened PR #9:
https://github.com/AndriusSka/eneba-marketplace/pull/9. I haven't merged it,
because merging deploys both apps to production.

M3 was already merged into main, so I rebased onto it first and the PR
contains only the M7 commit. That's 6f9fe61, on feat/m7-homepage, which is
pushed to GitHub.

After you merge:

1. Turn on "View all" in production. Production was seeded before this config
   existed, so run this in the Neon console:
   UPDATE homepage_blocks SET config = config ||
   '{"link_url":"/store?sort=bestselling"}' WHERE type='best_sellers';
2. Do the PLAN production check. Disable deals and swap two block positions in
   Neon, then reload the live homepage. It should change without a redeploy.
3. Check the page in a browser. I couldn't view it here, so the 375px and
   1440px layout is still unchecked.
