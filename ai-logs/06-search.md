> The Search milestone from @docs/PLAN.md.
> Goal: typo-tolerant search by name from a search bar in the header on every
> page, with suggestions while typing and a full results page.
> Constraints: Postgres pg_trgm with a GIN index, no external search service;
> debounced input; reuse the product card.
> Done when: "witcher", "wticher", "elden" and "cyberpnk" all return the right
> product first; tests cover those cases and "no results"; you explain how the
> similarity threshold was chosen.
> Compare 2 approaches with trade-offs before building.
> ⎿  Read docs\PLAN.md (157 lines)

● I'll start by understanding the existing search-related code and docs.

Searched for 5 patterns, read 9 files (ctrl+o to expand)

● Now the frontend side: layout/header, store page, API client and product card.

Read 4 files (ctrl+o to expand)

● Before comparing approaches I want real numbers, so I'll measure pg_trgm
scores for the target queries against the seeded titles on the Neon dev
branch. These are read-only SELECTs.

Ran 1 shell command (ctrl+o to expand)

● The numbers settle it. Let me check that the GIN index serves <% through the
catalog's wrapped subquery (EXPLAIN with seqscan disabled, since 30 rows
always seq-scan; read-only).

Ran 1 shell command (ctrl+o to expand)

● The index is confirmed and the threshold is scoped to the transaction; next
I'm moving on to the remaining frontend pieces. · summary

Searched for 1 pattern, read 3 files (ctrl+o to expand)

● One more measurement to pick the threshold with a wider sample: realistic
typos (should match) and realistic games we don't sell (should return
nothing).

Ran 1 shell command (ctrl+o to expand)

● The measurements show a clear threshold window, and I'm checking the existing
dropdown design tokens and the seed data shape next so the ranking test uses
real titles. · summary

Searched for 1 pattern, read 2 files (ctrl+o to expand)

● I have what I need. Two UX points aren't settled by SPEC/ARCHITECTURE/DESIGN,
so I'll ask before finalising.

● User answered Claude's questions:
⎿  · Once the header search box exists on every page, the Store page (/store)
still has its own "Filter by name" box from M2. What should happen to it? →
Remove it (Recommended)
· When someone submits the header search while on /store with platform,
region or price filters set, what should the new search do with those
filters? → Start fresh (Recommended)

● Both answered. Let me check how the existing frontend tests mock the API so
the SearchBox test follows the same pattern.

Searched for 1 pattern, read 1 file (ctrl+o to expand)

● No user-event, so the tests will use fireEvent and no new dependency is
needed. Writing the plan now.

● Updated plan
⎿  /plan to preview

● I compared two pg_trgm approaches on the 30 seeded titles and recommend
scoring each query against the best-matching part of a title
(word_similarity), with a threshold of 0.35. Scoring against the whole title
can't find "wticher" without also letting unrelated titles through.

The two approaches:

- A: best-matching part of the title (word_similarity), with exact and prefix
  matches ranked first. All four target queries come out on top: "witcher"
  scores 1.0, "elden" 1.0, "cyberpnk" 0.667 and "wticher" 0.40. Words people
  are still typing also score high ("cyberp" 0.857), which matters for the
  dropdown.
- B: whole title (similarity). Long titles drag the score down: "wticher" gets
  only 0.154, about the same as the 0.10–0.19 that unrelated titles get. No
  threshold finds it without letting junk through.

How I chose 0.35: I scored 20 realistic typos and 15 real games we don't sell.

- Every typo scores 0.40 or higher.
- Every game we don't sell scores 0.333 or lower: "banana", "fortnite" and
  "valorant" are 0.333.
- 0.35 sits in the gap between them.
  - The starting value in ARCHITECTURE.md, 0.30, would let those three games
    through.
  - 0.40 would sit exactly on the weakest valid typo.
- Known limits I'll document:
  - "halo" still finds Hades at 0.40, the same score as "fiaf" finding FIFA
    23, so no threshold can separate them.
  - "zleda" scores 0.20 and isn't found.
  - Abbreviations like "gta" aren't handled.

I also ran EXPLAIN on the dev branch: the fuzzy query uses the
products_title_trgm GIN index, including inside the Store's catalog query.

What the plan builds:

- Backend:
  - The fuzzy match goes into the existing ProductSearch class. The threshold
    is set per transaction, so the results grid and the filter counts always
    agree.
  - A new GET /api/search/suggest returns the top 6 and uses the same search
    as the Store.
- Frontend:
  - A header search box on every page: 250 ms debounce, ↑ ↓ Enter Esc, and
    Enter opens /store?q=….
  - As you chose, the Store's own name box is removed, and a header search
    starts with no other filters.
  - The results page stays /store, with the existing ProductCard.
- Tests:
  - About 15 ranking cases against the real seed titles, including your four.
    Separate cases for "no results", the suggest endpoint and the index check.
  - Vitest for the search box (keyboard, debounce, "No results").
- No new dependencies and no new design tokens.

The full plan is in C:\Users\Andrius\.claude\plans\pasted-content-id-ccbe-the-
search-gentle-papert.md.

● User approved Claude's plan
⎿  Plan saved to:
~\.claude\plans\pasted-content-id-ccbe-the-search-gentle-papert.md · /plan
to edit
M3: Search, typo-tolerant, from the header on every page

     Context

     M2 shipped the Store with q as an escaped substring match
     (ProductSearch::filter, LIKE only), so typos find nothing. M3 adds fuzzy
     matching with pg_trgm and its existing GIN index products_title_trgm, a
     suggest endpoint, and a header search box with debounced autocomplete on
     every page. /store?q=… remains the full results page and reuses
     ProductCard.

     Done when: "witcher", "wticher", "elden" and "cyberpnk" each return the
     right product first; Pest covers those cases plus "no results"; and the
     threshold choice is explained (below, and in ARCHITECTURE.md).

     Decided with the user:
     - Remove the Store page's own "Filter by name" box. The header box is the
       only name input, and on /store it shows the current q.
     - A header search always starts fresh: /store?q=… with no other filters.

     ---

     Two approaches compared (measured on the 30 seeded titles, Neon dev)

     ┌─────────────────┬──────────────┬───────────────────────┬───────────────┐
     │                 │              │  A: word_similarity   │ B: similarity │
     │      Query      │   Expected   │  (best part of the    │    (whole     │
     │                 │              │        title)         │    title)     │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ witcher         │ The Witcher  │ 1.000                 │ 0.364         │
     │                 │ 3: Wild Hunt │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ wticher         │ The Witcher  │ 0.400                 │ 0.154         │
     │                 │ 3: Wild Hunt │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ witcer          │ The Witcher  │ 0.571                 │ 0.208         │
     │                 │ 3: Wild Hunt │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ elden           │ Elden Ring   │ 1.000                 │ 0.545         │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ cyberpnk        │ Cyberpunk    │ 0.667                 │ 0.412         │
     │                 │ 2077         │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ cyberp (typing) │ Cyberpunk    │ 0.857                 │ 0.375         │
     │                 │ 2077         │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ zelda           │ Legend of    │ 1.000                 │ 0.182         │
     │                 │ Zelda: …     │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ starfeild →     │              │                       │               │
     │ wrong title     │ –            │ 0.400 (ranks 2nd)     │ 0.190         │
     │ Stardew Valley  │              │                       │               │
     ├─────────────────┼──────────────┼───────────────────────┼───────────────┤
     │ hogwarts →      │              │                       │               │
     │ wrong title     │ –            │ 0.222                 │ 0.095         │
     │ Hollow Knight   │              │                       │               │
     └─────────────────┴──────────────┴───────────────────────┴───────────────┘

     A. Tiered LIKE + word_similarity (<%) (the design in ARCHITECTURE.md ›
     Search approach)
     - Match: title LIKE substring, or q <% lower(title).
     - Rank: tier (exact, title prefix, word prefix, other), then
       word_similarity desc, then sales, then id.
     - Pros:
       - Scores the query against the best-matching part of the title, so a
         short query against a long title still scores high (witcher → 1.0).
       - Prefixes typed in autocomplete score high (cyberp → 0.857).
       - Tiers keep exact and prefix hits on top no matter what the fuzzy score
         is.
       - Typos and noise are cleanly separated: every typo scores ≥ 0.40, and
         every non-match scores ≤ 0.333 (except one case, below).
       - The same GIN index serves both LIKE and <% (EXPLAIN confirmed below).
     - Cons:
       - More SQL: a CASE, a second score and a GUC.
       - The threshold is a session/transaction setting, so SET LOCAL must run
         inside a transaction around every search query.
       - The default threshold is 0.6, which is far too strict.

     B. Whole-title similarity() (% operator), ranked by score
     - Pros:
       - The simplest SQL: one operator and one score.
       - Uses the same GIN index.
     - Cons:
       - Scores are diluted by title length. "wticher" scores 0.154 against its
         target, and "zelda" scores 0.182, which overlaps the noise
         (≈0.10–0.19).
       - No threshold both finds "wticher" and keeps noise out.
       - Ranking favours short titles over better matches.
       - Prefix-typing in autocomplete scores poorly.

     strict_word_similarity (a variant of A) was also measured. It scores
     prefixes lower (cyberp 0.545 vs 0.857), which is worse for autocomplete.

     Recommendation: A. It is the only option that meets the "wticher"
     requirement with a safe margin. It also matches the documented
     architecture.

     How the threshold is chosen: 0.35

     I measured word_similarity for 20 realistic typos (should match) and 15
     real games that aren't in the catalog (should match nothing):

     - Typos (lowest scores): wticher 0.400, fiaf 0.400, sekrio 0.429,
       eldne/hadse/minecarft/starfeild 0.500. Everything else is ≥ 0.57.
     - Not in the catalog (highest scores):
       - banana→Baldur's 0.333, fortnite→Forza 0.333 and valorant→Stardew 0.333.
       - tetris and diablo 0.286; gta and zzz 0.25.
       - Pure nonsense ≤ 0.167.

     The two groups are separated by a gap between 0.333 and 0.400. I'm choosing
     0.35:
     - It sits inside that gap, not on a value that occurs. Trigram scores come
       in a few discrete steps (for example 2/6 = 0.333 and 2/5 = 0.4), so a
       threshold of exactly 0.4 or 0.333 would depend on whether the comparison
       is > or >=.
     - 0.30 (the starting value in ARCHITECTURE) lets banana, fortnite and
       valorant through.
     - 0.40 is right on the lowest valid typo.

     Known limits, to be documented and not tested as passing:
     - "halo" matches Hades at 0.400. That is the same trigram arithmetic as
       "fiaf"→FIFA 23, and no threshold can separate the two.
     - "zleda" (a transposition in a 5-letter word) scores 0.200, too low for
       trigrams to find.
     - Abbreviations ("gta") are out of scope.

     The test dataset pins the boundary cases, so retuning the threshold later
     fails loudly.

     ---

     Backend changes

     backend/app/Services/ProductSearch.php: extend the existing class.
     - const WORD_SIMILARITY_THRESHOLD = 0.35, with a doc comment summarising
       the measurements above.
     - within(callable $fn): mixed:
       - It wraps $fn in DB::transaction and first runs select
         set_config('pg_trgm.word_similarity_threshold', ?, true), which is
         transaction-local and safe with Neon pooling.
       - Every query in a search request runs inside it.
     - filter(): (lower(title) like ? escape '\' or ? <% lower(title)). The
       substring branch keeps the M2 behaviour for % and _. A query with no
       trigrams never fuzzy-matches.
     - orderByRelevance(): keep the 4-tier CASE, then add word_similarity(?,
       lower(title)) desc. The existing sales desc, id stay in
       ProductCatalog::applySort.

     backend/app/Services/Catalog/ProductCatalog.php
     - list(): when $filters->q !== '', run the count, page, facet and price
       queries inside $this->search->within(...), so facets see the same
       threshold as the grid.
     - New suggest(string $q, int $limit = 6): Collection. It runs catalog() →
       search->filter → relevance order → sales desc, id →
       with(['platform','region']) → limit, all inside within(). It reuses the
       same engine, as SPEC requires.

     New: app/Http/Requests/SearchSuggestRequest.php
     - Rules: q nullable string, max 100.
     - query() returns ProductSearch::normalize(...).

     New: app/Http/Controllers/SearchController.php
     - A thin suggest(). An empty normalized q returns {data: []}.
     - Otherwise it returns
       ProductSummaryResource::collection($catalog->suggest($q)), so the
       response is {data: ProductSummary[]}, the same item shape as the listing.

     backend/routes/api.php: add Route::get('/search/suggest',
     [SearchController::class, 'suggest']).

     Backend tests

     New: tests/Feature/SearchTest.php with its fixture
     tests/Support/SearchCatalog.php.
     - Fixture:
       - One product per distinct title in database/seeders/data/catalog.php (24
         games and 6 gift cards), loaded with require, so the real production
         titles are the distractors.
       - Slug Str::slug(title), with each product in stock.
     - Ranking dataset (/api/products?q= → first slug), about 15 cases:
       - The four acceptance queries: witcher, wticher, elden, cyberpnk.
       - eldn ring, witcer, cyberp (prefix), ring (word prefix → Elden Ring),
         FIFA (case),  ELDEN   ring (whitespace), minecarft, hollow knigt, gost
         of tsushima, tears of kingdom, fiaf (boundary 0.400).
     - No results:
       - A dataset of nonsense and absent games (qwerty, xyzzy, banana,
         fortnite, valorant, call of duty) → data: [] and meta.total: 0.
       - banana, fortnite and valorant pin the upper side of the threshold.
     - Suggest endpoint:
       - At most 6 results, in the same order as the listing's first page for
         the same q.
       - An empty or whitespace q → [].
       - Over 100 characters → 422.
       - The item shape matches ProductSummaryResource.
     - Index:
       - Inside a transaction with set local enable_seqscan = off, EXPLAIN of
         the catalog query with q=wticher contains Bitmap Index Scan on
         products_title_trgm.
       - Already checked by hand: a BitmapOr of the LIKE and %> index
         conditions, pushed down into the catalog subquery.

     tests/Feature/ProductIndexTest.php: the existing name-filter, wildcard and
     tier tests must still pass unchanged. They are the regression check that
     fuzzy matching didn't loosen the M2 behaviour.

     Frontend changes

     New: frontend/src/lib/useDebouncedValue.ts: a small hook (250 ms), with no
     dependency.

     New: frontend/src/api/search.ts
     - fetchSuggestions(q, signal): narrows the response with isArrayOf(…,
       isProductSummary) from products.ts (frontend/src/api/products.ts).
     - useSuggestions(q):
       - Query key ['suggest', q], enabled when q.trim().length >= 2.
       - placeholderData: keepPreviousData, so the dropdown doesn't flicker.
       - React Query's signal aborts stale requests.

     New: frontend/src/features/search/SearchBox.tsx (+ SuggestionRow.tsx),
     styled as specified in DESIGN.md › Header with search:
     - ARIA combobox: the input has role="combobox", aria-expanded,
       aria-controls and aria-activedescendant; the list has role="listbox" and
       its rows role="option".
     - Keyboard:
       - ↓/↑ move the active row (wrapping).
       - Enter on an active row opens /product/:slug.
       - Enter with no active row opens /store?q=…, built with
         toSearchParams({...DEFAULT_STORE_PARAMS, q}) from storeParams.ts
         (frontend/src/features/store/storeParams.ts) so the search starts
         fresh.
       - Esc closes the dropdown.
       - Mouse: hovering sets the active row. Rows use onMouseDown +
         preventDefault, so the input doesn't blur before the click lands.
     - Dropdown:
       - Up to 6 rows. Each row shows a cover (w-10 h-14), the title (2-line
         clamp), platform · region and "From" + <Price>.
       - An out-of-stock row says "Out of stock".
       - When nothing matches, one row says "No results for '…'".
       - It closes on blur, on route change and after a submit.
     - Syncing with the URL: on /store, the input value follows ?q= (it re-syncs
       on location change), so Back/Forward and "Clear filters" update it.
     - Tokens: only existing ones: field-focus, line-strong, page, line,
       surface-raised, shadow-pop, rounded. A clear (×) button appears while the
       box is focused and not empty.

     Layout.tsx (frontend/src/components/Layout.tsx)
     - Put <SearchBox/> in the header: centre, flex-1, max-w 490px through the
       spacing scale.
     - Below md, the search box wraps onto its own full-width row (DESIGN.md ›
       Mobile).
     - Remove the M3 placeholder comment.

     StorePage.tsx (frontend/src/features/store/StorePage.tsx)
     - Remove the "Filter by name" form and submitName.
     - The heading "Results for '…'" and the existing "No results for '…'" +
       Clear filters empty state stay as they are; these already cover the PLAN
       item.

     Frontend tests

     - New: features/search/SearchBox.test.tsx (Vitest + Testing Library
       fireEvent; it stubs fetch the way ProductPage.test.tsx
       (frontend/src/features/product/ProductPage.test.tsx) does, with a memory
       router):
       - Typing shows suggestions after the debounce, and there is no request
         below 2 characters.
       - ↓↓ then Enter opens the second product.
       - Enter without an active row opens /store?q=wticher with no other
         params.
       - Esc closes the list.
       - An empty response shows "No results for '…'".
       - On /store?q=elden the input shows "elden".
     - New: features/store/StorePage.test.tsx (small): with q and zero results,
       it shows "No results for '…'" and a Clear filters button that clears q.
     - New: lib/useDebouncedValue.test.ts with fake timers.

     Docs

     - ARCHITECTURE.md › Search approach:
       - Threshold 0.35, with the measurement table and the reasoning.
       - Known limits: halo→Hades, zleda, abbreviations.
       - Record the decision of A over B, with the numbers.
       - The set_config(..., true) + transaction detail.
       - The suggest response shape {data: ProductSummary[]}.
     - ARCHITECTURE.md › Store API: the q row says "substring or word-similarity
       ≥ 0.35".
     - PLAN.md: tick M3 after Verify passes, with a "Verified 2026-11-15" note
       like M2's.
     - DESIGN.md: no change; all the tokens exist.

     No new dependencies (composer or npm).

     Verification

     1. cd backend; php artisan test: everything passes, including the new
        SearchTest (ranking dataset, no results, suggest, EXPLAIN) and the
        unchanged ProductIndexTest. vendor/bin/pint --test is clean.
     2. cd frontend; npm run lint; npm run typecheck; npm run test; npm run
        build all pass.
     3. Manual check against the dev data (php artisan serve + npm run dev):
        - Typing "wticher" in the header on /, /store and /product/… shows The
          Witcher 3 first. ↑/↓/Enter/Esc work.
        - Enter opens /store?q=wticher with ProductCards.
        - "qwerty" shows "No results".
        - At 375px the search sits on its own row with no horizontal scroll.
     4. Report what passed and what failed, with the output, before ticking
        PLAN.md. Commits will be feat: / test: / docs: on a new feat/m3-search
        branch, made only when you ask.

● Plan approved. I'll create the feat/m3-search branch off the current M2/M4
branch, since M3 builds on it, and start with the backend.

Ran 1 shell command (ctrl+o to expand)

● Now the search service: the threshold, the transaction-scoped setting, the
fuzzy branch and the similarity ordering.

● Write(backend\app\Services\ProductSearch.php)
⎿  Added 52 lines, removed 9 lines
3 namespace App\Services;
4  
 5 use Illuminate\Contracts\Database\Query\Builder;
6 +use Illuminate\Support\Facades\DB;  
 7  
 8 /**
8 - _ The name filter shared by the Store listing and (from M3) th
-e header autocomplete.  
 9 + _ The name search shared by the Store listing (`/api/products?
         +q=`) and the header autocomplete  
 10 + _ (`/api/search/suggest`), so the two always agree. See ARCHIT
+ECTURE.md › Search approach.  
 11 _
10 - _ M2 matches a substring of lower(title), served by the produc
-ts_title_trgm GIN index, and ranks  
 11 - _ by tier: exact, title prefix, word prefix, other substring.
-M3 adds the fuzzy word-similarity  
 12 - _ branch (pg_trgm `<%`) and its threshold. See ARCHITECTURE.md - › Search approach.  
 13 - _  
 14 - _ Expressions use lower(title) exactly, so the expression inde
-x applies.  
 12 + _ A title matches when it contains the query as a substring, o
+r when pg_trgm's word similarity  
 13 + _ (the query against the best-matching extent of the title) re
+aches the threshold: `q <% title`.  
 14 + _ Both are served by the products_title_trgm GIN index on lowe
+r(title), so every expression here  
 15 + _ uses lower(title) exactly.  
 16 _/
17 final class ProductSearch
18 {
19 + /**  
 20 + _ Measured on the seeded catalog (ARCHITECTURE.md › Search + approach):  
 21 + _ - Real typos all score ≥ 0.40 (wticher 0.400, fiaf 0.400
+, sekrio 0.429, cyberpnk 0.667).  
 22 + _ - Games we don't sell all score ≤ 0.333 (banana, fortnit
+e, valorant 0.333; diablo 0.286).  
 23 + _ 0.35 sits inside that gap rather than on a score that oc
+curs. Trigram scores are ratios of  
 24 + _ small counts (2/6, 2/5), so the threshold doesn't depend + on > vs >= at the boundary.  
 25 + _/  
 26 + public const WORD*SIMILARITY_THRESHOLD = 0.35;  
 27 +  
 28 /\** Trim, lower-case and collapse whitespace. An empty resu
lt means "no search". */
29 public static function normalize(?string $query): string
30 {
...
39 return str_replace(['\\', '%', '*'], ['\\\\', '\\%', '\
 \_'], $value);
      40      }
      41  
      32 -    /** Keep rows whose title contains the normalized query. */
      42 +    /**                                                        
      43 +     * Run search queries with the word-similarity threshold se
         +t.                                                             
      44 +     *                                                         
      45 +     * `<%` reads the threshold from the pg_trgm.word_similarit
         +y_threshold setting (default 0.6,                              
      46 +     * far too strict). set_config(…, true) scopes it to the tr
         +ansaction, so it never leaks to                                
      47 +     * other requests on a pooled connection.                  
      48 +     *                                                         
      49 +     * @template T                                             
      50 +     *                                                         
      51 +     * @param  callable(): T  $callback                        
      52 +     * @return T                                               
      53 +     */                                                        
      54 +    public function within(callable $callback): mixed          
      55 +    {                                                          
      56 +        return DB::transaction(function () use ($callback) {  
 57 + DB::select("select set_config('pg_trgm.word_similar
+ity_threshold', ?, true)", [
 58 + (string) self::WORD_SIMILARITY_THRESHOLD,
 59 + ]);  
 60 +  
 61 + return $callback();                                
      62 +        });                                                    
      63 +    }                                                          
      64 +                                                               
      65 +    /**                                                        
      66 +     * Keep rows whose title contains the normalized query or i
         +s word-similar to it.                                          
      67 +     * Call inside within(), or the fuzzy branch uses the stric
         +t default threshold.                                           
      68 +     */                                                        
      69      public function filter(Builder $query, string $normalized):
           void
      70      {
      35 -        $query->whereRaw("lower(title) like ? escape '\\'", ['%
         -'.self::escapeLike($normalized).'%']);  
 71 + $query->whereRaw(                                      
      72 +            "(lower(title) like ? escape '\\' or ? <% lower(tit
         +le))",                                                         
      73 +            ['%'.self::escapeLike($normalized).'%', $normalized
         +],                                                             
      74 +        );                                                     
      75      }
      76  
      38 -    /** Order by match tier: 0 exact, 1 title prefix ("cyberp")
         -, 2 word prefix ("ring"), 3 other. */                          
      77 +    /**                                                        
      78 +     * Order by match tier (0 exact, 1 title prefix "cyberp", 2
         + word prefix "ring", 3 other substring                         
      79 +     * or fuzzy), then by word similarity, so a closer typo bea
         +ts a looser one.                                               
      80 +     */                                                        
      81      public function orderByRelevance(Builder $query, string $no
          rmalized): void
      82      {
      83          $like = self::escapeLike($normalized);
...
89 else 3 end",
90 [$normalized, $like.'%', '% '.$like.'%'],
91 );
92 + $query->orderByRaw('word_similarity(?, lower(title)) de
         +sc', [$normalized]);  
 93 }
94 }

● Now ProductCatalog: wrap list() in the threshold transaction and add
suggest().

● Update(backend\app\Services\Catalog\ProductCatalog.php)
⎿  Added 27 lines
32  
 33 public function \_\_construct(private readonly ProductSearch
$search) {}
      34  
      35 +    public const SUGGEST_LIMIT = 6;                            
      36 +                                                               
      37      public function list(ProductFilters $filters): ProductListR
          esult
      38      {
      39 +        // The results, the count and every facet must see the 
         +same search threshold.                                         
      40 +        return $filters->q === ''                              
      41 +            ? $this->runList($filters)  
 42 + : $this->search->within(fn () => $this->runList($fi
+lters));  
 43 + }  
 44 +  
 45 + /\*_  
 46 + _ Header autocomplete: the first products of the Store's r
+elevance order for the query.  
 47 + _  
 48 + _ @param string $q  normalized by ProductSearch::normali
         +ze(), not empty                                                
      49 +     * @return Collection<int, Product>                        
      50 +     */                                                        
      51 +    public function suggest(string $q): Collection             
      52 +    {                                                          
      53 +        return $this->search->within(function () use ($q) {  
 54 + $query = $this->catalog();                         
      55 +            $this->search->filter($query, $q);                 
      56 +            $this->applySort($query, new ProductFilters(q: $q, 
         +sort: ProductFilters::SORT_RELEVANCE));                        
      57 +                                                               
      58 +            return $query->with(['platform', 'region'])->limit(
         +self::SUGGEST_LIMIT)->get();                                   
      59 +        });                                                    
      60 +    }                                                          
      61 +                                                               
      62 +    private function runList(ProductFilters $filters): ProductL
         +istResult                                                      
      63 +    {                                                          
      64          $query = $this->applyFilters($this->catalog(), $filters
);
65 $total = (clone $query)->count();
66

● Update(backend\app\Services\Catalog\ProductCatalog.php)
⎿  Added 1 line
10 use App\Models\Region;
11 use App\Services\ProductSearch;
12 use Illuminate\Database\Eloquent\Builder;
13 +use Illuminate\Database\Eloquent\Collection;  
 14 use Illuminate\Database\Eloquent\Model;
15 use Illuminate\Database\Query\Builder as QueryBuilder;
16 use Symfony\Component\HttpKernel\Exception\NotFoundHttpExceptio
n;
● That diagnostic was raised before the Collection import landed, and the import
fixes it. Next come the request, the controller and the route.

● Write(backend\app\Http\Requests\SearchSuggestRequest.php)
⎿  Wrote 23 lines to backend\app\Http\Requests\SearchSuggestRequest.php
1 <?php
2
3 namespace App\Http\Requests;
4
5 use App\Services\ProductSearch;
6 use Illuminate\Foundation\Http\FormRequest;
7
8 final class SearchSuggestRequest extends FormRequest
9 {
10 /\*_ @return array<string, mixed> _/
… +13 lines (ctrl+o to expand)

● Write(backend\app\Http\Controllers\SearchController.php)
⎿  Wrote 21 lines to backend\app\Http\Controllers\SearchController.php
1 <?php
2
3 namespace App\Http\Controllers;
4
5 use App\Http\Requests\SearchSuggestRequest;
6 use App\Http\Resources\ProductSummaryResource;
7 use App\Services\Catalog\ProductCatalog;
8 use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
9
10 final class SearchController extends Controller
… +11 lines (ctrl+o to expand)

● Update(backend\routes\api.php)
⎿  Added 3 lines
2  
 3 use App\Http\Controllers\HealthController;
4 use App\Http\Controllers\ProductController;
5 +use App\Http\Controllers\SearchController;  
 6 use Illuminate\Support\Facades\Route;
7  
 8 Route::get('/health', HealthController::class);
9  
 10 +Route::get('/search/suggest', [SearchController::class, 'sugges
+t']);  
 11 +  
 12 Route::get('/products', [ProductController::class, 'index']);
13 // A plain string slug (no model binding), so a 404 never names
a model class.
14 Route::get('/products/{slug}', [ProductController::class, 'show
']);

● Now the test fixture, built from the real seed titles, and the search tests.

● Write(backend\tests\Support\SearchCatalog.php)
⎿  Wrote 38 lines to backend\tests\Support\SearchCatalog.php
1 <?php
2
3 namespace Tests\Support;
4
5 use App\Models\Key;
6 use App\Models\Offer;
7 use App\Models\Platform;
8 use App\Models\Product;
9 use App\Models\Region;
10 use Illuminate\Support\Str;
… +28 lines (ctrl+o to expand)

● Write(backend\tests\Feature\SearchTest.php)
⎿  Wrote 134 lines to backend\tests\Feature\SearchTest.php
1 <?php
2
3 use Illuminate\Database\Events\QueryExecuted;
4 use Illuminate\Foundation\Testing\RefreshDatabase;
5 use Illuminate\Support\Facades\DB;
6 use Illuminate\Testing\TestResponse;
7 use Tests\Support\SearchCatalog;
8
9 uses(RefreshDatabase::class);
… +125 lines (ctrl+o to expand)

● Two fixes before running: the "card" query matches only 5 gift cards, so it
can't show the cap of 6, and one test name is inaccurate.

Ran 1 shell command (ctrl+o to expand)

● Pest runs against remote Neon and has been going for over 10 minutes. The new
fixture inserts about 90 rows per test, which is likely why. While it runs in
the background, I'll write the frontend.

Ran 1 shell command (ctrl+o to expand)

● Writing the frontend: the debounce hook, the suggest API client, then the
SearchBox.

● Write(frontend\src\lib\useDebouncedValue.ts)
⎿  Wrote 13 lines to frontend\src\lib\useDebouncedValue.ts
1 import { useEffect, useState } from 'react'
2
3 /\*_ `value`, but only after it has stopped changing for `delayMs
         `. _/
4 export function useDebouncedValue<T>(value: T, delayMs: number):
T {
5 const [debounced, setDebounced] = useState(value)
6
7 useEffect(() => {
8 const timer = setTimeout(() => setDebounced(value), delayMs)
… +5 lines (ctrl+o to expand)

● Write(frontend\src\api\search.ts)
⎿  Wrote 30 lines to frontend\src\api\search.ts
1 import { keepPreviousData, useQuery } from '@tanstack/react-quer
y'
2 import { getJson } from './client'
3 import { isArrayOf, isObject } from './guards'
4 import { isProductSummary, type ProductSummary } from './product
s'
5
6 // GET /api/search/suggest?q= → {data: ProductSummary[]}, at mos
t 6, in the Store's relevance order
7 // (docs/ARCHITECTURE.md › Search approach).
… +23 lines (ctrl+o to expand)

● Write(frontend\src\features\search\SuggestionRow.tsx)
⎿  Wrote 31 lines to frontend\src\features\search\SuggestionRow.tsx
1 import type { ProductSummary } from '../../api/products'
2 import { formatCents } from '../../lib/money'
3
4 /\*_ DESIGN.md › Header with search › Dropdown: cover, title, pla
tform · region, "From" price. _/
5 export function SuggestionRow({ product }: { product: ProductSum
mary }) {
6 return (
7 <div className="flex items-center gap-3 px-3 py-2">
8 <img
… +23 lines (ctrl+o to expand)

● Write(frontend\src\features\search\SearchBox.tsx)
⎿  Wrote 183 lines to frontend\src\features\search\SearchBox.tsx
1 import { useId, useRef, useState, type FormEvent, type KeyboardE
vent } from 'react'
2 import { useLocation, useNavigate } from 'react-router'
3 import { MIN_SUGGEST_LENGTH, useSuggestions } from '../../api/se
arch'
4 import { useDebouncedValue } from '../../lib/useDebouncedValue'
5 import { DEFAULT_STORE_PARAMS, MAX_QUERY_LENGTH, parseStoreParam
s, toSearchParams } from '../store/storeParams'
6 import { SuggestionRow } from './SuggestionRow'
7
… +176 lines (ctrl+o to expand)

● Background command "Fix test query and run the Pest suite" completed (exit
code 0)

Read 1 file (ctrl+o to expand)

● All 100 Pest tests pass, but the suite takes 11 minutes because the search
fixture inserts around 150 rows one at a time over the remote connection. I'm
switching it to bulk inserts next. · summary

Ran 1 shell command (ctrl+o to expand)

● Write(backend\tests\Support\SearchCatalog.php)
⎿  Added 20 lines, removed 10 lines
7 use App\Models\Platform;
8 use App\Models\Product;
9 use App\Models\Region;
10 +use App\Models\Seller;  
 11 use Illuminate\Support\Str;
12  
 13 /\*_
14 _ The real seeded titles (database/seeders/data/catalog.php),
one product each, all in stock and
15 _ with no sales. Search ranking is tested against these so the
distractors are the ones production
16 _ has. Slug = Str::slug(title), e.g. "the-witcher-3-wild-hunt"
.
17 + _  
 18 + _ Rows are bulk-inserted (one statement per table): the tests
+run against a remote database, and  
 19 + _ this fixture is built before every test.  
 20 _/
21 final class SearchCatalog
22 {
...
27  
 28 $platform = Platform::factory()->create();
      29          $region = Region::factory()->create();
      30 +        $seller = Seller::factory()->create();                 
      31  
      27 -        foreach ($titles as $title) {                          
      28 -            $product = Product::factory()->create([            
      29 -                'slug' => Str::slug($title),  
 30 - 'title' => $title,                             
      31 -                'platform_id' => $platform->id,                
      32 -                'region_id' => $region->id,                    
      33 -            ]);                                                
      34 -            $offer = Offer::factory()->create(['product_id' => 
         -$product->id]);  
 35 - Key::factory()->create(['offer_id' => $offer->id]);
36 - }  
 32 + Product::insert(array_map(fn (string $title) => Product
         +::factory()->raw([                                             
      33 +            'slug' => Str::slug($title),  
 34 + 'title' => $title,  
 35 + 'platform_id' => $platform->id,  
 36 + 'region_id' => $region->id,  
 37 + ]), $titles));  
 38 +  
 39 + $productIds = Product::query()->pluck('id')->all();  
 40 + Offer::insert(array_map(fn (int $id) => Offer::factory(
+)->raw([
 41 + 'product_id' => $id,
 42 + 'seller_id' => $seller->id,
 43 + ]), $productIds));  
 44 +  
 45 + $offerIds = Offer::query()->pluck('id')->all();  
 46 + Key::insert(array_map(fn (int $id) => Key::factory()->r
+aw(['offer_id' => $id]), $offerIds));  
 47 }
48 }

Ran 1 shell command (ctrl+o to expand)

● SearchTest now runs in about 60 seconds, down from roughly 10 minutes. Next
I'll run mutation checks at 0.30 and 0.45 to confirm the threshold tests
actually pin the value. · summary

Ran 1 shell command (ctrl+o to expand)

● At 0.30 the mutation check lets banana, fortnite and valorant into results,
and at 0.45 it drops "wticher" and "fiaf", so I've restored the threshold to
0.35. Next I'm wiring the box into the header and removing the Store's own
name form. · summary

● Update(frontend\src\components\Layout.tsx)
⎿  Added 2 lines, removed 1 line
7 return (
8 <div className="flex min-h-screen flex-col">
9 <header className="bg-page">
10 - <div className={`${CONTAINER} flex h-20 items-center ga
         -p-6`}>  
 10 + {/_ One 80px row from md; below md the search wraps ont
+o its own full-width row (DESIGN.md › Header). _/}  
 11 + <div className={`${CONTAINER} flex flex-wrap items-cent
         +er gap-x-6 gap-y-3 py-4 md:h-20 md:flex-nowrap md:py-0`}>  
 12 {/_ Our own wordmark: Eneba's logo is not used (SPEC)
. _/}
13 <Link to="/" className="text-lg font-bold tracking-ti
          ght text-fg">
14 Key<span className="text-accent">Market</span>

● Update(frontend\src\components\Layout.tsx)
⎿  Added 4 lines, removed 1 line
21 Store
22 </NavLink>
23 </nav>
24 - {/_ The header search box arrives in M3, the cart and - user menu in M5/M6. _/}  
 24 + <div className="order-last w-full md:order-none md:ma
         +x-w-122.5 md:flex-1">  
 25 + <SearchBox />  
 26 + </div>  
 27 + {/_ The cart and user menu arrive in M5/M6. _/}  
 28 </div>
29 </header>
30

● Update(frontend\src\components\Layout.tsx) ⎿  Added 1 line
1 import { Link, NavLink, Outlet, ScrollRestoration } from 'react-
router'
2 +import { SearchBox } from '../features/search/SearchBox'  
 3  
 4 /\*_ Content column: 1072px max (DESIGN.md › Spacing), 16px gutte
r below 768px, 24px from 768px. _/
5 export const CONTAINER = 'mx-auto w-full max-w-268 px-4 md:px-6'

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 3 lines, removed 31 lines
27 return () => window.removeEventListener('keydown', onKey)
28 }, [drawerOpen])
29  
 30 - function submitName(event: FormEvent<HTMLFormElement>) {  
 31 - event.preventDefault()  
 32 - const value = new FormData(event.currentTarget).get('q')  
 33 - update({ q: typeof value === 'string' ? value.trim() : '' }
-)  
 34 - }  
 35 -  
 30 return (
31 <main className={`${CONTAINER} py-6`}>
38 - <title>Store | KeyMarket</title>  
 32 + <title>{params.q === '' ? 'Store | KeyMarket' : `${params
         +.q} | KeyMarket`}</title>  
 33  
 40 - <div className="flex flex-col gap-4 md:flex-row md:items-
         -end md:justify-between">  
 41 - <h1 className="text-h1 font-bold">{params.q === '' ? 'S
-tore' : `Results for “${params.q}”`}</h1>  
 34 + {/_ The name query comes from the header search box, whic
+h shows it while on /store. _/}  
 35 + <h1 className="text-h1 font-bold">{params.q === '' ? 'Sto
+re' : `Results for “${params.q}”`}</h1>  
 36  
 43 - {/_ Name filter. The header search box (M3) will open /
-store?q=… too. _/}  
 44 - <form role="search" onSubmit={submitName} className="fl
         -ex w-full gap-2 md:max-w-sm">  
 45 - <label htmlFor="store-q" className="sr-only">  
 46 - Filter by name  
 47 - </label>  
 48 - <input  
 49 - // Remount when the URL changes (Back, Clear filter
-s) so the box shows the restored query.  
 50 - key={params.q}  
 51 - id="store-q"  
 52 - name="q"  
 53 - type="search"  
 54 - defaultValue={params.q}  
 55 - maxLength={MAX_QUERY_LENGTH}  
 56 - placeholder="Filter by name"  
 57 - className="h-10 min-w-0 flex-1 rounded-sm border bo
-rder-line-strong bg-transparent px-3 text-sm text-fg placeholde
-r:text-fg-muted focus:bg-field-focus"  
 58 - />  
 59 - <Button type="submit" variant="secondary">  
 60 - Search  
 61 - </Button>  
 62 - </form>  
 63 - </div>  
 64 -  
 37 <div className="mt-6 flex gap-6">
38 {drawerOpen && (
39 <div aria-hidden="true" className="fixed inset-0 z-30
bg-scrim lg:hidden" onClick={() => setDrawerOpen(false)} />

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 1 line, removed 1 line
1 -import { useEffect, useRef, useState, type FormEvent, type React
-Node } from 'react'  
 1 +import { useEffect, useRef, useState, type ReactNode } from 'rea
+ct'  
 2 import { Link } from 'react-router'
3 import { useProducts } from '../../api/products'
4 import { Button } from '../../components/Button'

● Update(frontend\src\features\store\StorePage.tsx)
⎿  Added 1 line, removed 1 line
8 import { FilterSidebar } from './FilterSidebar'
9 import { Pagination } from './Pagination'
10 import { SortSelect } from './SortSelect'
11 -import { effectiveSort, hasActiveFilters, MAX_QUERY_LENGTH, toA
-piQuery, toSearchParams } from './storeParams'  
 11 +import { effectiveSort, hasActiveFilters, toApiQuery, toSearchP
+arams } from './storeParams'  
 12 import { useStoreParams } from './useStoreParams'
13  
 14 const SKELETON_CARDS = 12

● I'll apply the canonical-class fix and write the frontend tests.

● Update(frontend\src\components\Layout.tsx)
⎿  Added 1 line, removed 1 line
22 Store
23 </NavLink>
24 </nav>
25 - <div className="order-last w-full md:order-none md:ma
         -x-w-122.5 md:flex-1">  
 25 + <div className="order-last w-full md:order-0 md:max-w
         +-122.5 md:flex-1">  
 26 <SearchBox />
27 </div>
28 {/_ The cart and user menu arrive in M5/M6. _/}

● Write(frontend\src\lib\useDebouncedValue.test.ts)
⎿  Wrote 24 lines to frontend\src\lib\useDebouncedValue.test.ts
1 import { act, renderHook } from '@testing-library/react'
2 import { afterEach, beforeEach, describe, expect, it, vi } from
'vitest'
3 import { useDebouncedValue } from './useDebouncedValue'
4
5 describe('useDebouncedValue', () => {
6 beforeEach(() => vi.useFakeTimers())
7 afterEach(() => vi.useRealTimers())
8
9 it('only takes the latest value once it has been stable for th
… +16 lines (ctrl+o to expand)

● Write(frontend\src\features\search\SearchBox.test.tsx)
⎿  Wrote 185 lines to frontend\src\features\search\SearchBox.test.tsx
1 import { QueryClient, QueryClientProvider } from '@tanstack/reac
t-query'
2 import { fireEvent, render, screen, waitFor } from '@testing-lib
rary/react'
3 import { createMemoryRouter, RouterProvider, useLocation } from
'react-router'
4 import { afterEach, describe, expect, it, vi } from 'vitest'
5 import type { ProductSummary } from '../../api/products'
6 import { SearchBox, SUGGEST_DEBOUNCE_MS } from './SearchBox'
7
… +178 lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Write(frontend\src\features\store\StorePage.test.tsx)
⎿  Wrote 43 lines to frontend\src\features\store\StorePage.test.tsx
1 import { QueryClient, QueryClientProvider } from '@tanstack/reac
t-query'
2 import { fireEvent, render, screen } from '@testing-library/reac
t'
3 import { createMemoryRouter, RouterProvider } from 'react-router
'
4 import { afterEach, describe, expect, it, vi } from 'vitest'
5 import type { ProductList } from '../../api/products'
6 import { StorePage } from './StorePage'
7
… +36 lines (ctrl+o to expand)

Ran 1 shell command (ctrl+o to expand)

● Every suite fails, including the existing ones, with an error in
src/test/setup.ts before any test runs. That doesn't look like my change, so
I'll check whether a clean HEAD fails the same way.

Ran 1 shell command (ctrl+o to expand)

● The config looks fine, so I'm switching to PowerShell, since this Vitest error
on Windows is likely from two vitest copies loaded under different
drive-letter casings via Git Bash paths. · summary

Ran 1 shell command (ctrl+o to expand)

● All 59 tests pass from PowerShell, so the earlier failure came from Git Bash
path casing; one unhandled error remains because my test fires submit on the
input instead of the form, and I'm moving it to the form. · summary

● Bash(sed -i
"s/fireEvent.submit(input)/fireEvent.submit(screen.getByRole('search'))/g"
src/features/search/SearchBox.test.tsx && grep -c
"fireEvent.submit(screen.get…)
⎿  Updated frontend\src\features\search\SearchBox.test.tsx (+2 -2)
135 expect(input).toHaveValue('old')
136  
 137 type(input, ' wticher ')
138 - fireEvent.submit(input)  
 138 + fireEvent.submit(screen.getByRole('search'))  
 139  
 140 await waitFor(() => expect(location()).toBe('/store?q=wtic
her'))
141 expect(input).toHaveValue('wticher')
...
146 const input = renderSearch('/product/elden-ring')
147  
 148 type(input, ' ')
149 - fireEvent.submit(input)  
 149 + fireEvent.submit(screen.getByRole('search'))  
 150  
 151 expect(location()).toBe('/product/elden-ring')
152 })
⎿  (files that changed while this command ran, by the command or by
another process; a convenience view, not a review or audit of the
command)

Ran 1 shell command (ctrl+o to expand)

● Vitest is green at 59/59, with typecheck and build passing; I'm checking
oxlint's exit code directly since its summary line is missing, and running
Pint and the full Pest suite in the background. · summary

Ran 2 shell commands (ctrl+o to expand)

● oxlint exits clean. While Pest runs, I'll update ARCHITECTURE.md: the search
approach, the threshold reasoning, known limits and the suggest response
shape.

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
96 | GET | `/api/health` | – | Liveness plus a DB ping. Used by t
he uptime pinger |
97 | GET | `/api/home` | – | Ordered homepage blocks with their d
ata |
98 | GET | `/api/products` | – | Store listing: `q`, `platform[]`
, `region[]`, `min_price`, `max_price` (cents), `sort` (`relev
           ance`, `price_asc`, `price_desc`, `newest`, `bestselling`), `p
           age`. Returns `{data, meta:{page, per_page, total, last_page},
            facets:{platforms:[{slug,name,count}], regions:[…], price:{mi
           n_cents,max_cents}}}`. See [Store API](#store-api) |
99 -| GET | `/api/search/suggest?q=` | – | Top 6 matches for autoc
-omplete (same engine as the listing) |  
 99 +| GET | `/api/search/suggest?q=` | – | Top 6 matches for autoc
+omplete (same engine and order as the listing). `{data: [produ
          +ct]}` with the Store's product fields. Empty `q` → `{data: []}
          +`; `q` over 100 chars → 422 |  
 100 | GET | `/api/products/{slug}` | – | Product details plus acti
ve offers (seller, price, stock, discount), in stock first, th
en by price. 404 `{"message":"Not found."}` for an unknown slu
g |
101 | POST | `/api/cart/quote` | – | `{items:[{offer_id, quantity}
           ]}` → current price, stock and line totals per item, plus warn
ings (`out_of_stock`, `quantity_reduced`, `inactive`) |
102 | GET | `/sanctum/csrf-cookie` | – | Sets the `XSRF-TOKEN` coo
kie before login/register |

● Update(docs\ARCHITECTURE.md)
⎿  Added 1 line, removed 1 line
116  
 117 | Param | Rules | Default |
118 |---|---|---|
119 -| `q` | ≤ 100 chars. Trimmed, lower-cased and whitespace colla
-psed. Matches a substring of `lower(title)`, with LIKE wildcar
-ds escaped. M3 adds fuzzy matching | – |  
 119 +| `q` | ≤ 100 chars. Trimmed, lower-cased and whitespace colla
+psed. Matches a substring of `lower(title)` (LIKE wildcards es
+caped) or a title whose word similarity is ≥ 0.35 (typos). See + [Search approach](#search-approach) | – |  
 120 | `platform[]`, `region[]` | Slugs, ≤ 10 each. OR within a dim
ension, AND across dimensions. An unknown slug matches nothing
| all |
121 | `min_price`, `max_price` | Integer cents, inclusive, 0–1 000
000, `max ≥ min`. They apply to the from-price, so setting ei
ther one drops out-of-stock products | – |
122 | `sort` | `relevance` (tier, then sales), `price_asc` / `pric
           e_desc` (out of stock last), `newest` (no release date last),
`bestselling` (all-time units sold). Every sort ends on `id`,
so pages are stable. `relevance` without `q` becomes `bestsell
           ing` | `relevance` if `q` is set, otherwise `bestselling` |

● Update(docs\ARCHITECTURE.md)
⎿  Added 38 lines, removed 2 lines
194 ORDER BY tier, sim DESC, sales DESC, p.id
195 ```      196  
      197 -3. **Index.**`CREATE INDEX products_title_trgm ON products US
-ING gin (lower(title) gin_trgm_ops)`. This one GIN index serve
          -s both the `LIKE '%…'`patterns and the`<%`operator. Queries
          - must use`lower(title)`exactly so the expression index is us
          -ed. Verified with`EXPLAIN`.                                  
      198 -4. **Threshold.** Set per transaction with `SET LOCAL pg_trgm.
-word_similarity_threshold`. The starting value of 0.3 is tuned
          - against the ranking test table, which lists about 15 typo and
          - partial-name cases with their expected first result.         
      197 +   In the code the WHERE is `lower(title) LIKE '%' || :q || '%
+' OR :q <% lower(title)`: any substring still matches, as in M
          +2, and tier 3 holds both substring and fuzzy matches, ordered 
          +by `sim`.                                                     
      198 +                                                              
      199 +3. **Index.** `CREATE INDEX products_title_trgm ON products US
+ING gin (lower(title) gin_trgm_ops)`. This one GIN index serve
          +s both the `LIKE '%…'`patterns and the`<%`operator. Queries
          + must use`lower(title)`exactly so the expression index is us
          +ed.`SearchTest`runs`EXPLAIN`on the real Store query (with 
          +seq scans off, since 30 rows always seq-scan) and expects a`B
+itmap Index Scan on products_title_trgm`with the`%>`conditi
          +on, pushed down into the catalog subquery.                    
      200 +4. **Threshold: 0.35.**`<%`reads`pg_trgm.word_similarity_th
+reshold`(default 0.6, far too strict).`ProductSearch::within
+()`sets it with`set_config(…, true)`inside a transaction ar
          +ound every search query (results, count, facets, suggestions),
          + so it never leaks to another request on a pooled connection. 
          +How the value was chosen is covered below.                    
      201 +                                                              
      202 +### Why`word_similarity`, not whole-title `similarity`      
      203 +                                                              
      204 +Two pg_trgm designs were compared on the 30 seeded titles befo
          +re building:                                                  
      205 +                                                              
      206 +| Query → expected |`word_similarity`(best extent of the tit
          +le) |`similarity`(whole title) |                            
      207 +|---|---|---|                                                 
      208 +| witcher → The Witcher 3: Wild Hunt | 1.000 | 0.364 |        
      209 +| wticher → The Witcher 3: Wild Hunt | 0.400 | 0.154 |        
      210 +| witcer → The Witcher 3: Wild Hunt | 0.571 | 0.208 |         
      211 +| cyberpnk → Cyberpunk 2077 | 0.667 | 0.412 |                 
      212 +| cyberp (typing) → Cyberpunk 2077 | 0.857 | 0.375 |          
      213 +| zelda → The Legend of Zelda: … | 1.000 | 0.182 |            
      214 +| best wrong title for a real query (hogwarts → Hollow Knight)
          + | 0.222 | 0.095 |                                            
      215 +                                                              
      216 +Whole-title`similarity`is diluted by title length. "wticher"
          + (0.154) and "zelda" (0.182) score inside the noise band (abou
          +t 0.10–0.19), so no threshold finds them without letting junk 
          +through, and short titles outrank better matches.`word_simila
+rity`scores the query against the best-matching part of the t
          +itle, so short queries against long titles and half-typed pref
          +ixes both score high.`strict_word_similarity` was also measur
          +ed; it scores prefixes lower (cyberp 0.545), which is worse fo
          +r autocomplete.                                               
      217 +                                                              
      218 +### How the threshold was chosen                              
      219 +                                                              
      220 +`word_similarity`was measured for 20 realistic typos (which s
          +hould match) and 15 real games we don't sell (which should mat
          +ch nothing):                                                  
      221 +                                                              
      222 +| Group | Scores |                                            
      223 +|---|---|                                                     
      224 +| Typos, lowest | wticher 0.400, fiaf 0.400, sekrio 0.429, eld
          +ne / hadse / minecarft / starfeild 0.500. All the others are ≥
          + 0.57 |                                                       
      225 +| Not sold, highest | banana → Baldur's Gate 3, fortnite → For
          +za Horizon 5 and valorant → Stardew Valley 0.333; tetris, diab
          +lo 0.286; gta, zzz 0.250; nonsense ≤ 0.167 |                  
      226 +                                                              
      227 +The groups are separated by a gap from **0.333 to 0.400**, and
          + 0.35 sits inside it. Trigram scores are ratios of small count
          +s (2/6 = 0.333, 2/5 = 0.4), so a threshold placed exactly on 0
          +.333 or 0.4 would depend on whether the comparison is`>`or`
+>=`. The starting value of 0.3 would let banana, fortnite and 
          +valorant through.                                             
      228 +                                                              
      229 +`SearchTest` pins both sides: the typo dataset includes the tw
+o 0.400 cases, and the no-results dataset includes the three 0
+.333 cases. A mutation run confirmed it: at 0.30 the three 0.3
+33 queries return results, and at 0.45 "wticher" and "fiaf" fi
+nd nothing.  
 230 +  
 231 +**Known limits**, accepted and not tested as passing:  
 232 +- "halo" finds Hades (0.400). It is the same trigram arithmeti
+c as "fiaf" → FIFA 23, so no threshold separates them. The res
+ult ranks as a fuzzy match.  
 233 +- A transposition inside a short word, such as "zleda" (0.200)
+, breaks most of its trigrams and is not found.  
 234 +- Abbreviations ("gta" for Grand Theft Auto) are out of scope.
235 5. **Facets.** Platform counts apply every filter except the p
latform filter, and region counts apply every filter except th
e region filter. This is standard disjunctive faceting: you ca
n see how many results picking another platform would give.
236 6. **Price filter and sort** use the product's from-price. Pro
ducts with no stock have a NULL from-price, sort last, and are
excluded when a price filter is set.
237

● The new subsections landed between steps 4 and 5 of the numbered list, which
would break its numbering. I'll move steps 5 and 6 up so they stay with the
list.

Ran 2 shell commands (ctrl+o to expand)

● No Python here, so I'll do the move with the Edit tool.

● Update(docs\ARCHITECTURE.md)
⎿  Removed 2 lines
232 - "halo" finds Hades (0.400). It is the same trigram arithmeti
c as "fiaf" → FIFA 23, so no threshold separates them. The res
ult ranks as a fuzzy match.
233 - A transposition inside a short word, such as "zleda" (0.200)
, breaks most of its trigrams and is not found.
234 - Abbreviations ("gta" for Grand Theft Auto) are out of scope.
235 -5. **Facets.** Platform counts apply every filter except the p
-latform filter, and region counts apply every filter except th
-e region filter. This is standard disjunctive faceting: you ca
-n see how many results picking another platform would give.  
 236 -6. **Price filter and sort** use the product's from-price. Pro
-ducts with no stock have a NULL from-price, sort last, and are - excluded when a price filter is set.  
 235  
 236 ## Checkout transaction
237  
● Update(docs\ARCHITECTURE.md)
⎿  Added 3 lines
198  
 199 3. **Index.** `CREATE INDEX products_title_trgm ON products US
           ING gin (lower(title) gin_trgm_ops)`. This one GIN index serve
s both the `LIKE '%…'` patterns and the `<%` operator. Queries
must use `lower(title)` exactly so the expression index is us
ed. `SearchTest` runs `EXPLAIN` on the real Store query (with
seq scans off, since 30 rows always seq-scan) and expects a `B
           itmap Index Scan on products_title_trgm` with the `%>` conditi
on, pushed down into the catalog subquery.
200 4. **Threshold: 0.35.** `<%` reads `pg_trgm.word_similarity_th
           reshold` (default 0.6, far too strict). `ProductSearch::within
           ()` sets it with `set_config(…, true)` inside a transaction ar
ound every search query (results, count, facets, suggestions),
so it never leaks to another request on a pooled connection.
How the value was chosen is covered below.
201 +5. **Facets.** Platform counts apply every filter except the p
+latform filter, and region counts apply every filter except th
+e region filter. This is standard disjunctive faceting: you ca
+n see how many results picking another platform would give.  
 202 +6. **Price filter and sort** use the product's from-price. Pro
+ducts with no stock have a NULL from-price, sort last, and are + excluded when a price filter is set.  
 203 +7. **Header search box** (`frontend/src/features/search/Search
          +Box.tsx`). It waits 250 ms after typing stops, needs at least
+2 characters, and shows up to 6 suggestions. ↑/↓ pick a row an
+d Enter opens it. Enter with no row picked opens `/store?q=…`
+with no other filters, Esc closes the list. On `/store` the bo
+x shows the current `q`; it is the Store's only name input.  
 204  
 205 ### Why `word_similarity`, not whole-title `similarity`
206

● Next, a live check against the dev data. I'll start the API and the Vite dev
server in the background and query search through the Vite proxy, the same
path the browser uses.

Ran 3 shell commands (ctrl+o to expand)

● Through the Vite proxy, all four acceptance queries return the right product
first in both suggestions and the Store, and "qwerty" returns 0. I'm waiting
on the full Pest run now. · summary

Read 1 file (ctrl+o to expand)

● Pint is clean; Pest is still running. I'll wait for its completion notice.

● Pest is still running in the background, and I'll be notified when it
finishes. I'll fill in the PLAN.md verification note once I have its final
count, rather than guess it.

> I checked the header box in the browser, commit it

Read 1 file (ctrl+o to expand)

● The browser check is done. The full Pest run (Pint already passed) is still
going, so I'll update PLAN.md now and commit once Pest reports.

Ran 2 shell commands (ctrl+o to expand)

● Background command "Run Pint check and full Pest suite" completed (exit code 0)

● Pest passed 100/100 (460 assertions), down from 11 to 7 minutes. Now I'll tick
M3 in PLAN.md, then commit.

● Update(docs\PLAN.md)
⎿  Added 24 lines, removed 4 lines
76  
 77 ## M3 — Search
78  
 79 -- [ ] `ProductSearch` class: input normalization (including LI
-KE escaping) and the tiered ranking SQL. It is plugged into `/
          -api/products?q=` (relevance sort) and `/api/search/suggest`.  
 80 -- [ ] Word-similarity threshold set per transaction and tuned
-against the test table.  
 81 -- [ ] Header search box on every page: debounced (250 ms) auto
-complete with the top 6, keyboard navigation (↑ ↓ Enter Esc),
-and Enter opening `/store?q=…`.  
 82 -- [ ] Empty results show a "No results for '…'" message with a - clear-filters action.  
 79 +- [x] `ProductSearch` class: input normalization (including LI
+KE escaping) and the tiered ranking SQL. It is plugged into `/
          +api/products?q=` (relevance sort) and `/api/search/suggest`.  
 80 +- [x] Word-similarity threshold set per transaction and tuned
+against the test table.  
 81 +- [x] Header search box on every page: debounced (250 ms) auto
+complete with the top 6, keyboard navigation (↑ ↓ Enter Esc),
+and Enter opening `/store?q=…`.  
 82 +- [x] Empty results show a "No results for '…'" message with a + clear-filters action.  
 83  
 84 **Verify:** a Pest dataset of about 15 cases passes, for examp
le `eldn ring → elden-ring-…`, `cyberp → cyberpunk-2077-…`, `w
           itcer → the-witcher-3-…`, `ring → elden-ring-…`, `FIFA` (case)
, and a nonsense query → empty. `EXPLAIN` on a fuzzy query sho
ws a bitmap scan on `products_title_trgm`. Manually: typing in
the header shows suggestions on the Store, product and cart p
ages.
85  
 86 +**Verified 2026-11-15:**  
 87 +- **Approach:** `word_similarity` over whole-title `similarity
          +`. The threshold is 0.35, inside the measured gap between non-
+matches (≤ 0.333) and typos (≥ 0.400). The comparison and the
+measurements are in ARCHITECTURE.md › Search approach.  
 88 +- **Automated:**  
 89 + - Pest 100/100 on the `test` branch.  
 90 + - `SearchTest` runs against the real seed titles:  
 91 + - 15 ranking cases, including witcher, wticher, elden and
+cyberpnk.  
 92 + - 6 no-results cases.  
 93 + - The suggest endpoint.  
 94 + - `EXPLAIN` showing a bitmap index scan on `products_title
          +_trgm`.  
 95 + - A mutation run at thresholds 0.30 and 0.45 makes the bound
+ary cases fail.  
 96 + - Pint is clean.  
 97 + - Vitest 59/59: `SearchBox`, `StorePage` empty state and `us
          +eDebouncedValue`.  
 98 + - oxlint, `tsc -b` and the build pass.  
 99 +- **Manual, on the `dev` data:**  
 100 + - Through the Vite proxy, all four acceptance queries put th
+e right product first; "qwerty" returns 0.  
 101 + - The header box was checked in the browser.  
 102 +- **Changes from the plan:**  
 103 + - The Store's own "Filter by name" box was removed: the head
+er box is the only name input and shows `q` on `/store`.  
 104 + - The cart page doesn't exist until M6.  
 105 +  
 106 ## M4 — Product page
107  
 108 - [x] `GET /api/products/{slug}`: product details plus offers
with seller name and rating, price, discount compared with MSR
P and stock, sorted by price. 404 for an unknown slug.

Ran 1 shell command (ctrl+o to expand)

● M3 is committed as 6cbcfa4 on the new feat/m3-search branch, and the working
tree is clean. Nothing was pushed. I ticked M3 in PLAN.md (docs/PLAN.md) with
a verification note, and ARCHITECTURE.md (docs/ARCHITECTURE.md) now records
the comparison of the two approaches and how the threshold was chosen.

Checks before the commit:

- Backend: Pest passed 100/100 and Pint is clean. The search tests use the
  real seed titles. The four acceptance queries (witcher, wticher, elden,
  cyberpnk) and 11 other cases each put the right product first. Six queries
  for things we don't sell, like "qwerty" and "banana", return nothing. The
  tests also cover the suggest endpoint and confirm the search uses the GIN
  index.
- Frontend: Vitest passed 59/59, and oxlint, tsc -b and the build pass.
- Threshold check: setting it to 0.30 lets "banana", "fortnite" and "valorant"
  through, and setting it to 0.45 loses "wticher" and "fiaf". So the tests
  fail if 0.35 is changed in either direction.
- Live, on the dev data: all four acceptance queries came back with the right
  product first through the Vite proxy, and you checked the header box in the
  browser.

Two things you might trip over:

- Slow backend tests: the full Pest suite takes about 7 minutes against Neon.
  The new search fixture took it to 11 minutes, so I switched it to bulk
  inserts.
- Vitest from Git Bash: every suite fails with "failed to find the current
  suite" when Vitest is started from a /c/... path. Run npm run test from
  PowerShell or the VS Code terminal.

The Laravel (:8000) and Vite (:5173) dev servers I started are still running
in the background; tell me if you want them stopped.

> push it and open a PR

Ran 1 shell command (ctrl+o to expand)

● M2/M4 is already merged into main, so this PR contains only the M3 commit.
Pushing and opening it against main:

Ran 1 shell command (ctrl+o to expand)

● I pushed feat/m3-search and opened PR #8 against main:
https://github.com/AndriusSka/eneba-marketplace/pull/8

The PR has just the one M3 commit, since M2/M4 was already merged. Its
description covers:

- the comparison of the two search approaches, with the measured scores
- why the typo threshold is 0.35
- the test results and your browser check

Merging it deploys to Vercel and Render. No migration is needed: the search
index has existed since M1. Production search needs no separate step after the
merge.
