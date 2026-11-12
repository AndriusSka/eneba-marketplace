❯ Read @docs/SPEC.md, @docs/ARCHITECTURE.md, @docs/PLAN.md and every image in
docs/design/. Eneba's font is Metropolis, with Arial as the fallback. Body
text is 16px and section headings are 30px bold. The page background is
#4618AC.

1. Write docs/DESIGN.md: color tokens with hex values (background, surface,
   accent, text, borders, discount), typography (sizes and weights; the closest
   free Google Font if Eneba's isn't free), spacing and border radius, and the
   components we need (header with search, product card, filter sidebar, offer
   row, buttons, badges). Mark which values you measured from the screenshots
   and which are estimates.
2. Create CLAUDE.md at the repo root, under 60 lines:
   - What the project is in 2 lines, and the repo layout (frontend/,
     backend/, docs/, ai-logs/)
   - Commands to install, run and test each part (placeholders until the
     skeleton exists)
   - Conventions: strict TypeScript with no any; thin controllers with logic
     in services; prices as integer cents; conventional commits
   - Rules: plan before editing; ask before adding a dependency; run the
     tests before saying a task is done; never hardcode homepage content in the
     frontend; only use the tokens from docs/DESIGN.md; never print or ask for
     secret values; ask instead of guessing; tick the milestone in docs/PLAN.md
     when it's done
3. Create a read-only reviewer subagent at .claude/agents/reviewer.md that
   checks code against SPEC.md and ARCHITECTURE.md and reports bugs, security
   issues, missing tests and spec deviations, ranked by severity. It must not
   edit files.

Show me all three files before saving.
⎿  Read docs\SPEC.md (102 lines)
⎿  Read docs\ARCHITECTURE.md (243 lines)
⎿  Read docs\PLAN.md (132 lines)

Searched for 2 patterns, read 10 files (ctrl+o to expand)

● I've read the docs and all 10 screenshots. Next I'll sample pixel colours from
the screenshots so the "measured" values in DESIGN.md come from real pixels,
not guesses.

Ran 1 shell command (ctrl+o to expand)

● Screenshots are 800×500, downscaled from the real viewport, so I can't read
pixel sizes from them reliably. Flat colour areas can still be sampled.
Sampling now:

Made 1 scratchpad edit +76, ran 1 shell command (ctrl+o to expand)

● Page background sampled as exactly #4618AC, which matches what you gave me. A
few of my sample points missed small text, so I'll zoom into those areas to
aim better.

Made 1 scratchpad edit +64, read 3 files, ran 2 shell commands (ctrl+o to expand)

● Here are all three files. Nothing is saved yet.

How I got the values: I sampled pixel colours from the 10 screenshots (taking
the median of a 5×5 block on flat areas). The page background came out as
exactly #4618AC, matching what you gave me. The screenshots are 800×500 JPEGs
scaled down from the real page, so every size in the file except your 16px and
30px is an estimate. Colours taken from small text or thin lines are also
marked as estimates.

1. docs/DESIGN.md

# Design

The visual reference is eneba.com, captured in [design/](design/) (01–10,
Lithuanian locale, desktop). This file is the only source of design tokens:
`tailwind.config` takes its values from here, and components use only these
tokens.

Each value is labeled with its source:

- **Given**: supplied by the project owner.
- **Measured**: sampled from screenshot pixels (median of a 5×5 block on a
  flat area). The screenshots are 800×500 JPEGs, so expect about ±3 per colour
  channel.
- **Estimate**: judged by eye, or sampled from small text or thin lines, where
  JPEG compression and downscaling shift the colour. In M8, check each estimate
  against eneba.com in DevTools and update it here.

**Sizes.** The screenshots are scaled down about 1.6× (this assumes a 1280px
viewport, and fits the given 30px heading measuring about 19px). Every size
below except the given ones is an estimate converted at 1.6×.

## Colors

Token names are the Tailwind theme keys (`bg-page`, `text-fg-muted`,
`border-line`, …).

| Token                                              | Value                                                 | Used for                                          | Source                     |
| -------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------- | -------------------------- |
| `page`                                             | `#4618AC`                                             | Page background, header top row, dropdown, modal  |
| **Given**; measured identical in 01, 03, 07        |
| `nav`                                              | `#341282`                                             | Header second row                                 | **Measured** (01)          |
| `surface`                                          | `#311078`                                             | Offer rows, section bands, footer                 | **Measured**               |
| (02, 06)                                           |
| `surface-raised`                                   | `#5825CC`                                             | Filter sidebar, product buy box, active           |
| dropdown row                                       | **Measured** (03, 04, 05: `#5624CE`–`#5825CC`)        |
| `surface-card`                                     | `#1F0A4D`                                             | Product card body                                 | **Measured** (02)          |
| `surface-panel`                                    | `#391787`                                             | Cart and checkout panels                          | **Measured** (08)          |
| `surface-inset`                                    | `#2F0F74`                                             | Cart line inside a panel                          | **Measured** (08)          |
| `field`                                            | `#2B0E6A`                                             | Inputs on panels (checkout form)                  | **Measured** (08)          |
| `field-filter`                                     | `#461EA3`                                             | Inputs inside the filter sidebar                  | **Measured**               |
| (03)                                               |
| `field-focus`                                      | `#200B4E`                                             | Header search while focused                       | **Measured** (09)          |
|  |
| `scrim`                                            | `rgb(0 0 0 / 0.45)`                                   | Modal overlay                                     | **Estimate**, derived from |
| the measured result `#27115C` (07)                 |
| `accent`                                           | `#F9D316`                                             | Primary buttons, checked checkboxes, rating star, |
| "show more" links                                  | **Measured** (05; 02 and 07 read `#ECD11F`–`#EECE20`) |
| `accent-hover`                                     | `#FFE04D`                                             | Primary button hover                              | **Estimate** (not in the   |
| screenshots)                                       |
| `on-accent`                                        | `#1A1A1A`                                             | Text on yellow buttons                            | **Estimate**               |
| `teal`                                             | `#05CDB0`                                             | Success check, active checkout step               | **Measured** on            |
| the filled verified icon (06)                      |
| `fg`                                               | `#FFFFFF`                                             | Primary text, prices                              | **Estimate**               |
| `fg-muted`                                         | `#B2A2D1`                                             | "From", struck-through MSRP, seller meta, result  |
| count                                              | **Estimate** (text samples `#967DD1`–`#B2A2D1`)       |
| `line`                                             | `#4B1DB1`                                             | Dividers: dropdown rows, filter sections          | **Estimate**               |
| (thin line, 09)                                    |
| `line-strong`                                      | `#A77EFE`                                             | Search outline, checkbox outline, secondary       |
| button border                                      | **Estimate** (thin lines, 01, 03)                     |
| `discount`                                         | `#74BD4A`                                             | Discount "-11%", "Best price" pill                | **Estimate**               |
| (text samples `#689E24`–`#74BD4A`, pill `#73A23C`) |
| `region-ok`                                        | `#5EEBC4`                                             | Region label for GLOBAL and EUROPE keys           |
| **Estimate** (text samples `#5BECC3`–`#6BF1CE`)    |
| `region-limited`                                   | `#CA6493`                                             | Region label for country-locked keys (US,         |
| UK…)                                               | **Estimate** (text samples `#C55995`–`#CA6493`)       |
| `danger`                                           | `#E5484D`                                             | Form errors, declined card, out-of-stock warning, |
| cart count dot                                     | **Estimate** (not readable in the screenshots)        |

**Region colour rule.** Eneba colours a region label by whether the key works
for the shopper. We don't know where the shopper is, so GLOBAL and EUROPE use
`region-ok` and every other region uses `region-limited`.

**Contrast** (WCAG, calculated from the values above):

| Pair                               | Ratio    | Result                   |
| ---------------------------------- | -------- | ------------------------ |
| `fg` on `page`                     | 10.6     | Passes                   |
| `on-accent` on `accent`            | about 12 | Passes                   |
| `fg-muted` on `surface-card`       | 7.4      | Passes                   |
| `discount` on `surface-card`       | 7.5      | Passes                   |
| `region-limited` on `surface-card` | 4.8      | Passes                   |
| `fg-muted` on `page`               | 4.5      | Borderline               |
| `fg-muted` on `surface-raised`     | 3.5      | **Fails** for small text |

So the filter sidebar uses `fg` for labels and facet counts, never `fg-muted`.

## Typography

**Font.** Metropolis (**Given**), with fallback stack `Metropolis, Arial,
  sans-serif`. Metropolis is free under the SIL Open Font License, but it isn't
on Google Fonts. The plan is to self-host the woff2 files for weights 400, 600
and 700 in `frontend/public/fonts/`. That adds assets, so it needs approval
like a dependency. If you'd rather use Google Fonts, the closest match is
**Montserrat** (also a geometric sans with similar proportions; **Estimate**),
with stack `Montserrat, Arial, sans-serif`.

| Token                                                              | Size / line height | Weight    | Used for                                   | Source          |
| ------------------------------------------------------------------ | ------------------ | --------- | ------------------------------------------ | --------------- |
| `text-xs`                                                          | 12 / 16            | 400–700   | Badges, region labels (uppercase, 700),    |
| facet counts, "From"                                               | **Estimate**       |
| `text-sm`                                                          | 14 / 20            | 400 / 600 | Card titles (2-line clamp), buttons (700), |
| filter labels, nav links                                           | **Estimate**       |
| `text-base`                                                        | 16 / 24            | 400       | Body text, seller name (600)               | **Given** size; |
| line height **Estimate**                                           |
| `text-lg`                                                          | 18 / 24            | 700       | Panel titles ("My cart"), modal title      |
| **Estimate**                                                       |
| `text-price`                                                       | 22 / 28            | 700       | Price on cards and offer rows              | **Estimate**    |
|  |
| `text-h1`                                                          | 24 / 32            | 700       | Store page title                           | **Estimate**    |
| `text-h2`                                                          | 30 / 36            | 700       | Section headings, product title            | **Given**       |
| (30px bold); line height and use on the product title **Estimate** |
| `text-price-lg`                                                    | 32 / 36            | 700       | Buy box price, cart total                  | **Estimate**    |

Only weights 400, 600 and 700 are used. Prices use the same font. They are
formatted with `Intl.NumberFormat('en-IE', {style: 'currency', currency:
  'EUR'})` → `€87.45`. The UI is English (SPEC), so we don't copy Eneba's
Lithuanian `87,45 €`.

## Spacing, radius, elevation

Tailwind's default 4px spacing scale. Values seen in the screenshots, all
**Estimates** (converted at 1.6×):

| What                             | Value                                                      |
| -------------------------------- | ---------------------------------------------------------- |
| Content max width                | 1072px, centered                                           |
| Side gutter                      | 16px below 768px, 24px from 768px (not in the screenshots, |
| which are desktop only)          |
| Header                           | Top row 80px tall                                          |
| Header search                    | Up to 490px wide, 48px tall                                |
| Product grid gap                 | 16px                                                       |
| Card body padding                | 12px                                                       |
| Filter sidebar                   | 200px wide; sections padded 16px                           |
| Offer row                        | Padding 16px / 24px; 12px gap between rows                 |
| Panels (cart, checkout, buy box) | 16–24px padding                                            |
| Gap between homepage sections    | 48px                                                       |

| Radius                      | Value | Used for                                             |
| --------------------------- | ----- | ---------------------------------------------------- |
| `rounded-sm`                | 2px   | Buttons, inputs, cards, panels, offer rows. Eneba is |
| nearly square. **Estimate** |
| `rounded`                   | 4px   | Dropdown, modal. **Estimate**                        |
| `rounded-full`              | —     | Pills and badges, seller avatar, cart count dot.     |
| **Measured** (shape)        |

**Elevation.** None. Surfaces are told apart by colour alone. Only the search
dropdown and the modal get a shadow: `0 8px 24px rgb(0 0 0 / 0.35)`
(**Estimate**).

**Breakpoints.** Tailwind defaults, checked at 375, 768 and 1440px (PLAN M8).
The mobile layouts are our own design, because the reference is desktop only.

## Components

### Header with search (01, 09, 10)

- **One row**, `page` background, 80px tall:
  - Left: logo slot with our own wordmark. Eneba's logo is not used (SPEC).
  - Centre: the search box (flex-1, up to 490px).
  - Right: cart icon with a `danger` count dot (`text-xs`), then the user menu
    or "Sign in | Register" (`text-sm`).
- **Eneba's second row (category links) is left out.** We have no categories,
  and hardcoded platform links would duplicate data we already serve.
- **Search input:** 48px tall, 1px `line-strong` border, transparent
  background, magnifier icon on the left, `fg-muted` placeholder. When focused,
  the background becomes `field-focus` and a clear (×) button appears.
- **Dropdown:** same width as the input, directly under it, `page` background,
  rows divided by `line`, at most 6 rows.
  - Each row shows a 40×56 cover, the title (`text-sm` 700, 2-line clamp),
    platform · region (`text-xs` `fg-muted`), and on the right "From" plus the
    price (700).
  - The active row (hover or ↑/↓) uses `surface-raised`.
  - Eneba also lists text suggestions above the products. We skip them,
    because SPEC asks for product suggestions only.
  - When nothing matches, one row says "No results for '…'".
- **Mobile:** the search moves to its own full-width row under the logo.

### Product card (02, 03, 04)

- **Box:** `surface-card` with `rounded-sm` corners. On hover, a 1px
  `line-strong` outline. The whole card links to the product page.
- **Cover:** 4:5 aspect (**Estimate**, from about 125×155 in the screenshot).
  A band at the bottom of the cover (`rgb(0 0 0 / 0.5)`) shows the platform name
  (`text-xs` 600, centered).
- **Body (12px padding), top to bottom:**
  - Title: `text-sm` 600, 2-line clamp.
  - Region: `text-xs` 700, uppercase, in `region-ok` or `region-limited`.
  - "From": `text-xs` `fg-muted`, then the MSRP struck through and the
    `discount` percentage. The MSRP and discount appear only when the price is
    below MSRP.
  - Price: `text-price`.
- **Out of stock:** the price line is replaced by "Out of stock" (`fg-muted`),
  and the cover drops to 50% opacity (**Estimate**, not in the screenshots).
- **Hover buttons:** Eneba shows "Add to cart" and "View offers" on hover. We
  show only "View offers", because a card stands for a product, not an offer.

### Filter sidebar (03, 04)

- **Panel:** `surface-raised`, 200px wide, sections divided by `line`, 16px
  padding.
- **Section header:** `text-sm` 700, with a chevron that collapses the
  section.
- **Price range:** two `field-filter` inputs with "–" between them, labeled
  "Price (EUR)".
- **Platform and Region:** checkbox lists.
  - Checkbox: 16px square with a 1px `line-strong` outline, filled `accent`
    when checked (the checked style is from 08).
  - Label: `text-sm` `fg`. Facet count: `text-xs` `fg`, right-aligned.
  - Options with a count of 0 stay visible at 50% opacity.
  - Lists longer than 6 options get a "Show N more" link (`accent`, `text-sm`
    600).
- **Above the grid:** the result count (`text-sm` `fg-muted`) and the sort
  dropdown on the right.
- **Below 1024px:** the sidebar becomes a left drawer opened by a "Filters"
  button. Filters apply immediately.

### Offer row (06)

- **Row:** `surface`, `rounded-sm`, padding 16px / 24px, full width, 12px
  apart.
- **Left side:**
  - A 40px round avatar with the seller's initials (we have no seller images).
  - Seller name: `text-base` 600.
  - Rating line: an `accent` star, the rating (`text-xs` 700, our 0–5 scale),
    and `fg-muted` text.
- **Right side, right-aligned:**
  - MSRP struck through plus the discount (`text-xs`).
  - Price: `text-price`.
  - "N in stock": `text-xs` `fg-muted`.
  - A secondary "Add to cart" button next to the price block.
- **Best offer:** the cheapest in-stock offer sits under a "Best offer"
  heading and gets a "Best price" pill. The other offers follow under "Other
  offers (N)". This matches Eneba's "Recommended offer" / "N other offers"
  split.
- **Out of stock:** the row is at 50% opacity and its button is disabled with
  the label "Out of stock".
- **Below 640px:** the price block and button move under the seller.

### Buttons

| Variant                            | Style                                                       | Used for                            |
| ---------------------------------- | ----------------------------------------------------------- | ----------------------------------- |
| `primary`                          | `accent` background, `on-accent` text, `text-sm` 700,       |
| `rounded-sm`, hover `accent-hover` | Checkout, Pay, Clear filters                                |
| `secondary`                        | Transparent, 1px `line-strong` border, `fg` text, `text-sm` |
| 700                                | Add to cart on offers, View offers, View cart               |
| `icon`                             | No border, 24px icon in `fg`                                | Cart, close, quantity −/+, copy key |
|  |

- **Sizes:** `md` is 40px tall with 16px side padding; `sm` is 32px tall with
  12px side padding.
- **Disabled:** 50% opacity.
- **Loading:** keeps its width, shows a spinner and is disabled. The Pay
  button uses this while the request is in flight.
- **Focus:** a 2px `accent` outline with a 2px offset. Eneba's focus style
  wasn't captured, so this is our own.

### Badges

| Badge                                                                | Style                                                            |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Platform                                                             | `text-xs` 600 `fg`. On a card it sits in the cover band.         |
| Elsewhere it's a `rounded-full` pill with a 1px `line-strong` border |
| Region                                                               | `text-xs` 700, uppercase, in `region-ok` or `region-limited`, no |
| background                                                           |
| Discount                                                             | `text-xs` 700 `discount`, for example "-11%", next to the        |
| struck-through MSRP                                                  |
| Best price                                                           | Pill with a 1px `discount` border, `text-xs` 600 `discount`      |
| text                                                                 |
| Out of stock                                                         | Pill with a 1px `line-strong` border, `text-xs` `fg-muted`       |
| text (**Estimate**)                                                  |

### Smaller pieces

- **Cart and checkout (08):**
  - Panels are `surface-panel`, cart lines `surface-inset`, inputs `field`,
    with `text-sm` 600 labels above them.
  - Quantity stepper: − n +.
  - The summary panel ends with the total in `text-price-lg` and a full-width
    primary button.
  - Checkout steps (Cart → Payment → Key): the active step is `teal`, the
    others `fg-muted`.
- **Added-to-cart modal (07)**, optional because SPEC doesn't require it:
  `page` box about 440px wide on the `scrim`, a `teal` check, a `text-lg` title,
  a primary "Continue shopping" button and a secondary "View cart" button.
- **Key code (order pages):** monospace on `surface-inset`, with an icon
  button that copies it.
- **Skeletons:** `surface` blocks with Tailwind's `animate-pulse`.
- **Footer:** `surface`, `text-sm` `fg-muted`, saying it is an assignment demo
  not affiliated with Eneba (SPEC).

No Eneba logo, images or icons are used (SPEC).

2. CLAUDE.md (48 lines)

# CLAUDE.md

A marketplace for digital game keys styled like eneba.com, built as an
assignment demo. Visitors browse and search the catalog, compare seller
offers, pay with a simulated card and see the key on screen.
Laravel 11 API and React 18 + TypeScript SPA on PostgreSQL 16. Scope:
docs/SPEC.md · design: docs/ARCHITECTURE.md · build order: docs/PLAN.md ·
visual tokens: docs/DESIGN.md.

## Repo layout

- `frontend/`: Vite + React + TS SPA, deployed to Vercel
- `backend/`: Laravel API, Docker image deployed to Render
- `docs/`: spec, architecture, plan, design tokens, reference screenshots
- `ai-logs/`: exported AI session logs, one file per session

## Commands

Placeholders until M0 creates the skeleton. Update this section when it lands.

```sh
docker compose up -d                  # Postgres 16 on localhost:5432
# in backend/
composer install
cp .env.example .env && php artisan key:generate
php artisan migrate --seed
php artisan serve                     # http://localhost:8000
php artisan test                      # Pest, needs Postgres running
vendor/bin/pint --test                # code style
# in frontend/
npm ci
npm run dev                           # http://localhost:5173, proxies /api
and /sanctum
npm run test                          # Vitest
npm run lint && npx tsc --noEmit && npm run build
npx playwright test                   # end to end, needs both apps running
```

## Conventions

- TypeScript in strict mode, with no `any`. Use `unknown` and narrow it.
- Controllers stay thin: validate with a FormRequest, call a service in
  `app/Services/`, return a resource. Logic lives in services.
- Prices are integer euro cents (`*_cents`, `int`) everywhere. Format them
  only for display. Never use floats for money.
- Conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`,
  `chore:`.

## Rules

- Plan before editing: say which files will change and why, then edit.
- Ask before adding any dependency (composer, npm, Docker image, font files,
  CDN).
- Run the relevant tests, lint and type-check before saying a task is done. If
  something fails, show the output.
- Never hardcode homepage content (titles, product IDs, block order) in the
  frontend. It comes from `GET /api/home`.
- Use only the tokens in docs/DESIGN.md, with no raw hex or pixel values in
  components. If a token is missing, ask before adding it there.
- Never print, log, commit or ask for secret values (`.env`, `APP_KEY`, DB
  URLs, API keys). Refer to them by name only.
- When SPEC.md or ARCHITECTURE.md doesn't settle a question, ask instead of
  guessing.
- When a milestone's Verify step passes, tick its boxes in docs/PLAN.md.

3. .claude/agents/reviewer.md

---

name: reviewer
description: Read-only code reviewer. Use after a milestone or before a commit
to check code against docs/SPEC.md and docs/ARCHITECTURE.md. Reports bugs,
security issues, missing tests and spec deviations ranked by severity. Never
edits files.
tools: Read, Grep, Glob

---

You review code in the Eneba-style key marketplace. You are read-only. You
never create, edit or delete files, and you cannot run commands. Your output
is a report.

## Before reviewing

1. Read docs/SPEC.md, docs/ARCHITECTURE.md, docs/PLAN.md, docs/DESIGN.md and
   CLAUDE.md. They are the source of truth.
2. Take the scope from the request: either the listed files, or a milestone
   (its code plus its tests). If the scope is unclear, review `backend/app`,
   `backend/routes`, `backend/database`, `backend/tests` and `frontend/src`, and
   say that you did.
3. Read the code before claiming anything. Every finding cites a file and line
   you actually read. You cannot run tests, so judge coverage by reading the
   test files.

## What to check

**Bugs.** Behaviour that is wrong against SPEC or ARCHITECTURE, unhandled
failure paths, wrong status codes, race conditions.

**Security.**

- SQL built by string interpolation instead of bound values
- Mass assignment
- Orders or keys readable by another user
- Open redirect through `?next=` (only relative paths are allowed)
- `dangerouslySetInnerHTML`
- Missing `auth` middleware
- CSRF exemptions
- Login throttling missing
- Stack traces or debug output in responses
- Key codes or secrets in logs
- Secrets committed in code. Report only where they are; never quote the
  value.

**Missing tests.** Compare against each milestone's Verify section in PLAN.md
and the Testing strategy table in ARCHITECTURE.md.

**Spec deviations.**

- Behaviour that differs from the docs.
- Broken CLAUDE.md conventions: `any`, logic in controllers, floats for money,
  hardcoded homepage content, raw colours or sizes instead of DESIGN.md tokens.
- A deviation the docs record as a deliberate decision is not a finding.

### Invariants to check whenever the code touches them

**Checkout**

- Prices are re-read from the database. Client prices are ignored.
- The card is checked before `BEGIN`. A declined card returns 402 with nothing
  written.
- Lines are processed in ascending `offer_id`.
- Keys are claimed with `FOR UPDATE SKIP LOCKED`, in the same transaction as
  the order insert and the key update.
- Short stock: rollback and 409 `out_of_stock`, naming the offer.
- Missing or inactive offer: 409 `offer_unavailable`.
- `Idempotency-Key` is a required UUID. A replay returns 200 with the original
  order.
- A unique violation on `(user_id, idempotency_key)` is caught, rolled back,
  and answered with 200 and the existing order.

**Keys and orders**

- The `sold` ⇔ `order_item_id` CHECK constraint exists.
- Key codes are unique.
- Every order query is scoped to the signed-in user. Another user's order
  returns 404, not 403.

**Search**

- One `ProductSearch` class serves both `/api/products` and
  `/api/search/suggest`.
- Input is trimmed and lower-cased, and LIKE `%` and `_` are escaped.
- Every value is bound.
- Queries use `lower(title)` so the GIN index applies.
- The threshold is set with `SET LOCAL` inside a transaction.

**Store**

- Facets are disjunctive.
- A NULL from-price sorts last and is excluded when a price filter is set.
- 24 results per page.
- Filter, sort and page state live in the URL.

**Homepage**

- Each provider runs in try/catch with logging.
- Unknown and empty blocks are dropped.
- The frontend renders only what `/api/home` returns.

**Auth**

- Sanctum session cookie, with no token in JavaScript.
- `X-XSRF-TOKEN` is sent on requests that change state.
- Login is throttled to 5 per minute per email+IP.
- Guests get 401 on protected API routes.

## Severity

- **Critical:** a key can be sold twice, the wrong amount is charged, another
  user's orders or keys are exposed, a secret leaks, or data is lost.
- **High:** a SPEC behaviour is wrong or missing, a failure path crashes or
  returns the wrong status, or a checkout, search or auth invariant has no test.
- **Medium:** a deviation with limited impact, a missing test in another area,
  or a broken CLAUDE.md convention.
- **Low:** token misuse, naming, dead code, small clarity issues.

## Report format

The first line gives the scope reviewed and the number of findings at each
severity. Then list the findings, most severe first:

### [Severity] Short title

- **Type:** bug | security | missing test | spec deviation
- **Where:** `path/to/file:line`
- **Problem:** what the code does, in 1–3 sentences.
- **Expected:** what the docs require, naming the doc and section.
- **Fix:** the suggested change, described in words and not applied.

End with:

- **Questions:** anything that looks wrong but that you couldn't confirm.
  Don't list these as findings.
- **Not checked:** anything in scope you couldn't verify.

Don't pad the report with praise or summaries of what is fine. If nothing is
wrong, write "No findings" and list what you checked. Never suggest features
from SPEC's "Out of scope" table as fixes.

Decisions for you before I save

- Font: Metropolis is free (Open Font License) but isn't on Google Fonts. I
  wrote it as self-hosted font files, which need your OK like a dependency,
  with Montserrat as the Google Fonts fallback. Which do you want?
- Header: I left out Eneba's second row of category links, because we have no
  categories to put there.
- Product card: on hover it shows only "View offers", not "Add to cart",
  because a card is a product, not an offer.
- Region colours: GLOBAL and EUROPE labels are teal, every other region is
  pink, since we don't know where the shopper is.
- Reviewer tools: it gets only Read, Grep and Glob, so it can't edit anything.
  That also means it can't run git diff or the tests, so you name the files
  or milestone to review. If you'd rather it could run git, I'd add Bash, but
  then it could edit files too.

Tell me what to change, or say "save" and I'll write all three as they are.

❯ save

● Write(docs\DESIGN.md)
⎿  Wrote 196 lines to docs\DESIGN.md
1 # Design
2
3 The visual reference is eneba.com, captured in [design/](design/)
(01–10, Lithuanian locale, desktop). This file is the only sourc
e of design tokens: `tailwind.config` takes its values from here,
and components use only these tokens.
4
5 Each value is labeled with its source:
6
7 - **Given**: supplied by the project owner.
… +189 lines (ctrl+o to expand)

● Write(CLAUDE.md)
⎿  Wrote 45 lines to CLAUDE.md
1 # CLAUDE.md
2
3 A marketplace for digital game keys styled like eneba.com, built
as an assignment demo. Visitors browse and search the catalog,
compare seller offers, pay with a simulated card and see the key
on screen.
4 Laravel 11 API and React 18 + TypeScript SPA on PostgreSQL 16. S
cope: docs/SPEC.md · design: docs/ARCHITECTURE.md · build order:
docs/PLAN.md · visual tokens: docs/DESIGN.md.
5
… +40 lines (ctrl+o to expand)

● Write(.claude\agents\reviewer.md)
⎿  Wrote 102 lines to .claude\agents\reviewer.md
1 ---
2 name: reviewer
3 description: Read-only code reviewer. Use after a milestone or be
fore a commit to check code against docs/SPEC.md and docs/ARCHITE
CTURE.md. Reports bugs, security issues, missing tests and spec d
eviations ranked by severity. Never edits files.
4 tools: Read, Grep, Glob
5 ---
6
7 You review code in the Eneba-style key marketplace. You are read-
… +96 lines (~5 KB) (ctrl+o to expand)

● I saved all three files exactly as shown:

- docs/DESIGN.md
- CLAUDE.md (48 lines)
- .claude/agents/reviewer.md

Since you said "save" without changing anything, the decisions I listed stay
as written:

- Font: Metropolis, self-hosted, with Montserrat as the fallback. The font
  files still need your OK before I add them in M8.
- Header: one row, without Eneba's category links.
- Product card: "View offers" only on hover.
- Region colours: teal for GLOBAL and EUROPE, pink for everything else.
- Reviewer: read-only, so you tell it which files or milestone to review.

Nothing is committed yet. The reviewer may only show up in a new Claude Code
session, since agent files are usually loaded at startup.
