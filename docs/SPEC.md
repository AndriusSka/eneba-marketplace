# Spec — Eneba-style key marketplace

Status: agreed before any code was written. Architecture is in [ARCHITECTURE.md](ARCHITECTURE.md), build order in [PLAN.md](PLAN.md).

## Goal

A web marketplace for digital game keys that looks and feels like eneba.com. Visitors browse and search the catalog, compare offers from several sellers, and signed-in users buy a key and receive it immediately. Payment is simulated.

The assignment says "a few features done extensively beat many fitting minimal requirements". So two features are built in depth and the rest are built to a correct, working minimum.

### Core user flow (from the assignment)

```
Homepage ─┐
          ├─► Product page ─► Cart ─► Checkout (sign-in required) ─► Payment ─► Order + key
Search  ──┘
```

Eneba styling applies to every screen.

## Interpretations of ambiguous requirements

| Assignment text | Ambiguity | Our interpretation |
|---|---|---|
| Store: "search by name" and Search: "from anywhere in the app" | Two search features or one? | **One search engine with two entry points.** The header search box (autocomplete on every page) and the Store page's `q` filter both call the same backend query, so their results always agree. Submitting the header search opens the Store with `?q=`. |
| Homepage: "each block gets its content from its own backend service or database" | Separate deployed microservices, or separate sources? | **One provider class and one data source per block type, inside one Laravel app.** Each block reads only its own table or query, and the frontend only renders what it receives. Deploying several services on free tiers would add cold starts and cost without changing what is being evaluated. |
| "Colors, typography, spacing and components follow the design reference" | No design file was supplied. | **eneba.com itself is the reference.** We take tokens (colors, type scale, radii, spacing) from the live site and record them in the Tailwind config. We do not use Eneba's logo or image assets. A footer says it is an assignment demo. |
| "Offers from several sellers" | Is there a seller-facing side? | **No.** Sellers, offers and keys are seeded data. Nothing asks for a seller dashboard. |
| Flow chart: Cart → Checkout (sign-in required) | Can guests have a cart? | **Yes.** The cart lives in browser storage and anyone can fill it. Sign-in is enforced when entering checkout, and the cart survives the login redirect. |
| "Receive the digital key they bought" | Through which channel? | **On screen.** Key codes are shown on the order confirmation page and stay available in order history. No email. |
| "Payment can be simulated" | How realistic? | **A simulated card form with Stripe-style test numbers.** `4242 4242 4242 4242` succeeds and `4000 0000 0000 0002` is declined. No provider integration. |

## In scope — deep

### 1. Store and Search

The Store and Search are treated as one feature because they share one query engine.

**Store (`/store`)**
- Lists every product in the catalog, including out-of-stock ones, which are labeled and sorted last when sorting by price.
- Filters:
  - Platform (multi-select)
  - Region (multi-select)
  - Price range (min/max on the product's lowest in-stock offer)
  - Text query `q`
- Sorting:
  - Relevance (default when `q` is set)
  - Price low → high
  - Price high → low
  - Newest (release date)
  - Best-selling (default when `q` is empty)
- Facet counts next to each platform and region option, for example "PC (34)". Each count reflects the other active filters, so you can see how many results you would get before clicking.
- Page-based pagination, 24 per page.
- All filter, sort and page state lives in the URL. Reloading, sharing a link, or pressing back/forward restores the exact view.
- Loading, empty and error states. When nothing matches, the page says so and offers a "Clear filters" action.

**Search**
- A header search box on every page, with a debounced autocomplete dropdown (top 6). Each suggestion shows the cover, title, platform/region and starting price, and can be chosen with the keyboard.
- Handles **partial names**: "cyberp" finds "Cyberpunk 2077", and "ring" finds "Elden Ring" because matching works on the start of any word.
- Handles **typos** with trigram similarity: "eldn ring" and "witcer" both find their games.
- Results are ranked in tiers: exact match, then title prefix, then word prefix, then fuzzy match. Ties are broken by similarity, then by sales.
- Ranking is pinned down by a table-driven test of typo and partial-name cases.

### 2. Checkout and key integrity

- **Cart:** stored in localStorage as `{offerId, quantity}` only. The cart page shows current prices and stock from the server (`POST /api/cart/quote`), never prices cached in the browser. You can change quantities (limited by stock and a per-line maximum) and remove lines.
- **Checkout (signed-in only):** a simulated card form. The client sends only offer IDs, quantities and the card number. The server re-reads prices from the database, so a client that tampers with prices is ignored.
- **A key is never sold twice:** keys are claimed inside one database transaction that locks the key rows (`FOR UPDATE SKIP LOCKED`), marks them sold and creates the order. A concurrency test proves it: 20 parallel buyers race for 5 keys, exactly 5 purchases succeed, and no key is sold twice.
- **Idempotent:** checkout requires an `Idempotency-Key` header. A double-click or a network retry returns the original order instead of creating a second one.
- **Failure paths with clear messages:**
  - Declined card: 402, nothing saved, keys stay available.
  - Out of stock: 409, naming the offer that ran out, and the cart updates.
  - Inactive offer: 409.
  - Validation errors: 422.
- **Order confirmation** shows every purchased key code with a copy button.
- **Order history** (`/orders`) lists the user's orders. Each order page shows its items and keys. Another user's order returns 404.

## In scope — minimal but complete

| Feature | What is built |
|---|---|
| Homepage | Three block types: hero banner, best sellers and deals. Block order, titles and on/off state come from the `homepage_blocks` table. Each type has its own backend provider and data source, so changing the homepage needs a database change, not a frontend deploy. If one block's provider fails, only that block is left out. |
| Product page | Cover, title, platform and region badges, description, release date, MSRP. An offers table sorted by price shows seller name and rating, price, discount compared with MSRP, stock, and an "Add to cart" button. The cheapest offer is highlighted, and out-of-stock offers are shown but disabled. |
| Authentication | Register, sign in and sign out (Laravel Sanctum, session cookie). Checkout, orders and order detail are protected. A visitor who is not signed in is redirected to sign in, then back to where they were. |
| Eneba styling | Design tokens taken from eneba.com: colors, typography, spacing and radii. Header, product cards, buttons, badges and the footer follow Eneba's look. Responsive from 375px to 1440px. |

## Out of scope — and why

| Cut | Reason |
|---|---|
| Seller dashboard (create offers, upload keys) | Not required. Product pages only need offers from several sellers to compare, which seeded data provides. |
| Admin UI for the homepage | The requirement is "nothing hardcoded in the frontend", and editing `homepage_blocks`/`banners` in the database already meets it. An admin UI would be a whole extra feature. |
| Real payment provider (Stripe test mode) | The assignment explicitly allows simulation. Webhooks plus Render's free-tier cold starts would add failure modes that have nothing to do with key integrity, which is the part worth showing. |
| Key reservation with a time limit | Assigning keys at payment inside one locked transaction already rules out double sales. Reservations add expiry handling and a third key state for a UX gain (holding stock while you type a card number) that a simulated payment doesn't need. |
| Email delivery of keys | The key is shown on screen and stays in order history, which meets "receive the key" without email infrastructure. |
| Password reset, email verification, social login | Auth is in the minimal tier. Register, sign in and protected routes meet the requirement. |
| Reviews, ratings, wishlists | Not requested. Seller rating is a seeded column. |
| Multi-currency, VAT, i18n | Everything is in EUR with integer cents, and the UI is English. Currency conversion would touch every price path for no evaluation value. |
| Refunds, cancellations | No real money moves. The order status column leaves room for them later. |
| External search engine (Meilisearch, Algolia) | Postgres trigrams handle typos and partial names at this catalog size, and keep search as our own code, which can be explained and tested. One less service to host and keep in sync. |
| Product variants ("other platforms/regions" switcher) | Products are flat listings (title + platform + region), as on eneba.com. Grouping variants would add a join to every query and isn't required. |
