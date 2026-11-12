# Design

The visual reference is eneba.com, captured in [design/](design/) (01–10, Lithuanian locale, desktop). This file is the only source of design tokens: `tailwind.config` takes its values from here, and components use only these tokens.

Each value is labeled with its source:

- **Given**: supplied by the project owner.
- **Measured**: sampled from screenshot pixels (median of a 5×5 block on a flat area). The screenshots are 800×500 JPEGs, so expect about ±3 per colour channel.
- **Estimate**: judged by eye, or sampled from small text or thin lines, where JPEG compression and downscaling shift the colour. In M8, check each estimate against eneba.com in DevTools and update it here.

**Sizes.** The screenshots are scaled down about 1.6× (this assumes a 1280px viewport, and fits the given 30px heading measuring about 19px). Every size below except the given ones is an estimate converted at 1.6×.

## Colors

Token names are the Tailwind theme keys (`bg-page`, `text-fg-muted`, `border-line`, …).

| Token | Value | Used for | Source |
|---|---|---|---|
| `page` | `#4618AC` | Page background, header top row, dropdown, modal | **Given**; measured identical in 01, 03, 07 |
| `nav` | `#341282` | Header second row | **Measured** (01) |
| `surface` | `#311078` | Offer rows, section bands, footer | **Measured** (02, 06) |
| `surface-raised` | `#5825CC` | Filter sidebar, product buy box, active dropdown row | **Measured** (03, 04, 05: `#5624CE`–`#5825CC`) |
| `surface-card` | `#1F0A4D` | Product card body | **Measured** (02) |
| `surface-panel` | `#391787` | Cart and checkout panels | **Measured** (08) |
| `surface-inset` | `#2F0F74` | Cart line inside a panel | **Measured** (08) |
| `field` | `#2B0E6A` | Inputs on panels (checkout form) | **Measured** (08) |
| `field-filter` | `#461EA3` | Inputs inside the filter sidebar | **Measured** (03) |
| `field-focus` | `#200B4E` | Header search while focused | **Measured** (09) |
| `scrim` | `rgb(0 0 0 / 0.45)` | Modal overlay | **Estimate**, derived from the measured result `#27115C` (07) |
| `accent` | `#F9D316` | Primary buttons, checked checkboxes, rating star, "show more" links | **Measured** (05; 02 and 07 read `#ECD11F`–`#EECE20`) |
| `accent-hover` | `#FFE04D` | Primary button hover | **Estimate** (not in the screenshots) |
| `on-accent` | `#1A1A1A` | Text on yellow buttons | **Estimate** |
| `teal` | `#05CDB0` | Success check, active checkout step | **Measured** on the filled verified icon (06) |
| `fg` | `#FFFFFF` | Primary text, prices | **Estimate** |
| `fg-muted` | `#B2A2D1` | "From", struck-through MSRP, seller meta, result count | **Estimate** (text samples `#967DD1`–`#B2A2D1`) |
| `line` | `#4B1DB1` | Dividers: dropdown rows, filter sections | **Estimate** (thin line, 09) |
| `line-strong` | `#A77EFE` | Search outline, checkbox outline, secondary button border | **Estimate** (thin lines, 01, 03) |
| `discount` | `#74BD4A` | Discount "-11%", "Best price" pill | **Estimate** (text samples `#689E24`–`#74BD4A`, pill `#73A23C`) |
| `region-ok` | `#5EEBC4` | Region label for GLOBAL and EUROPE keys | **Estimate** (text samples `#5BECC3`–`#6BF1CE`) |
| `region-limited` | `#CA6493` | Region label for country-locked keys (US, UK…) | **Estimate** (text samples `#C55995`–`#CA6493`) |
| `danger` | `#E5484D` | Form errors, declined card, out-of-stock warning, cart count dot | **Estimate** (not readable in the screenshots) |

**Region colour rule.** Eneba colours a region label by whether the key works for the shopper. We don't know where the shopper is, so GLOBAL and EUROPE use `region-ok` and every other region uses `region-limited`.

**Contrast** (WCAG, calculated from the values above):

| Pair | Ratio | Result |
|---|---|---|
| `fg` on `page` | 10.6 | Passes |
| `on-accent` on `accent` | about 12 | Passes |
| `fg-muted` on `surface-card` | 7.4 | Passes |
| `discount` on `surface-card` | 7.5 | Passes |
| `region-limited` on `surface-card` | 4.8 | Passes |
| `fg-muted` on `page` | 4.5 | Borderline |
| `fg-muted` on `surface-raised` | 3.5 | **Fails** for small text |

So the filter sidebar uses `fg` for labels and facet counts, never `fg-muted`.

## Typography

**Font.** Metropolis (**Given**), with fallback stack `Metropolis, Arial, sans-serif`. Metropolis is free under the SIL Open Font License, but it isn't on Google Fonts. The plan is to self-host the woff2 files for weights 400, 600 and 700 in `frontend/public/fonts/`. That adds assets, so it needs approval like a dependency. If you'd rather use Google Fonts, the closest match is **Montserrat** (also a geometric sans with similar proportions; **Estimate**), with stack `Montserrat, Arial, sans-serif`.

| Token | Size / line height | Weight | Used for | Source |
|---|---|---|---|---|
| `text-xs` | 12 / 16 | 400–700 | Badges, region labels (uppercase, 700), facet counts, "From" | **Estimate** |
| `text-sm` | 14 / 20 | 400 / 600 | Card titles (2-line clamp), buttons (700), filter labels, nav links | **Estimate** |
| `text-base` | 16 / 24 | 400 | Body text, seller name (600) | **Given** size; line height **Estimate** |
| `text-lg` | 18 / 24 | 700 | Panel titles ("My cart"), modal title | **Estimate** |
| `text-price` | 22 / 28 | 700 | Price on cards and offer rows | **Estimate** |
| `text-h1` | 24 / 32 | 700 | Store page title | **Estimate** |
| `text-h2` | 30 / 36 | 700 | Section headings, product title | **Given** (30px bold); line height and use on the product title **Estimate** |
| `text-price-lg` | 32 / 36 | 700 | Buy box price, cart total | **Estimate** |

Only weights 400, 600 and 700 are used. Prices use the same font. They are formatted with `Intl.NumberFormat('en-IE', {style: 'currency', currency: 'EUR'})` → `€87.45`. The UI is English (SPEC), so we don't copy Eneba's Lithuanian `87,45 €`.

## Spacing, radius, elevation

Tailwind's default 4px spacing scale. Values seen in the screenshots, all **Estimates** (converted at 1.6×):

| What | Value |
|---|---|
| Content max width | 1072px, centered |
| Side gutter | 16px below 768px, 24px from 768px (not in the screenshots, which are desktop only) |
| Header | Top row 80px tall |
| Header search | Up to 490px wide, 48px tall |
| Product grid gap | 16px |
| Card body padding | 12px |
| Filter sidebar | 200px wide; sections padded 16px |
| Offer row | Padding 16px / 24px; 12px gap between rows |
| Panels (cart, checkout, buy box) | 16–24px padding |
| Gap between homepage sections | 48px |

| Radius | Value | Used for |
|---|---|---|
| `rounded-sm` | 2px | Buttons, inputs, cards, panels, offer rows. Eneba is nearly square. **Estimate** |
| `rounded` | 4px | Dropdown, modal. **Estimate** |
| `rounded-full` | — | Pills and badges, seller avatar, cart count dot. **Measured** (shape) |

**Elevation.** None. Surfaces are told apart by colour alone. Only the search dropdown and the modal get a shadow: `0 8px 24px rgb(0 0 0 / 0.35)` (**Estimate**).

**Breakpoints.** Tailwind defaults, checked at 375, 768 and 1440px (PLAN M8). The mobile layouts are our own design, because the reference is desktop only.

## Components

### Header with search (01, 09, 10)

- **One row**, `page` background, 80px tall:
  - Left: logo slot with our own wordmark. Eneba's logo is not used (SPEC).
  - Centre: the search box (flex-1, up to 490px).
  - Right: cart icon with a `danger` count dot (`text-xs`), then the user menu or "Sign in | Register" (`text-sm`).
- **Eneba's second row (category links) is left out.** We have no categories, and hardcoded platform links would duplicate data we already serve.
- **Search input:** 48px tall, 1px `line-strong` border, transparent background, magnifier icon on the left, `fg-muted` placeholder. When focused, the background becomes `field-focus` and a clear (×) button appears.
- **Dropdown:** same width as the input, directly under it, `page` background, rows divided by `line`, at most 6 rows.
  - Each row shows a 40×56 cover, the title (`text-sm` 700, 2-line clamp), platform · region (`text-xs` `fg-muted`), and on the right "From" plus the price (700).
  - The active row (hover or ↑/↓) uses `surface-raised`.
  - Eneba also lists text suggestions above the products. We skip them, because SPEC asks for product suggestions only.
  - When nothing matches, one row says "No results for '…'".
- **Mobile:** the search moves to its own full-width row under the logo.

### Product card (02, 03, 04)

- **Box:** `surface-card` with `rounded-sm` corners. On hover, a 1px `line-strong` outline. The whole card links to the product page.
- **Cover:** 4:5 aspect (**Estimate**, from about 125×155 in the screenshot). A band at the bottom of the cover (`rgb(0 0 0 / 0.5)`) shows the platform name (`text-xs` 600, centered).
- **Body (12px padding), top to bottom:**
  - Title: `text-sm` 600, 2-line clamp.
  - Region: `text-xs` 700, uppercase, in `region-ok` or `region-limited`.
  - "From": `text-xs` `fg-muted`, then the MSRP struck through and the `discount` percentage. The MSRP and discount appear only when the price is below MSRP.
  - Price: `text-price`.
- **Out of stock:** the price line is replaced by "Out of stock" (`fg-muted`), and the cover drops to 50% opacity (**Estimate**, not in the screenshots).
- **Hover buttons:** Eneba shows "Add to cart" and "View offers" on hover. We show only "View offers", because a card stands for a product, not an offer.

### Filter sidebar (03, 04)

- **Panel:** `surface-raised`, 200px wide, sections divided by `line`, 16px padding.
- **Section header:** `text-sm` 700, with a chevron that collapses the section.
- **Price range:** two `field-filter` inputs with "–" between them, labeled "Price (EUR)".
- **Platform and Region:** checkbox lists.
  - Checkbox: 16px square with a 1px `line-strong` outline, filled `accent` when checked (the checked style is from 08).
  - Label: `text-sm` `fg`. Facet count: `text-xs` `fg`, right-aligned.
  - Options with a count of 0 stay visible at 50% opacity.
  - Lists longer than 6 options get a "Show N more" link (`accent`, `text-sm` 600).
- **Above the grid:** the result count (`text-sm` `fg-muted`) and the sort dropdown on the right.
- **Below 1024px:** the sidebar becomes a left drawer opened by a "Filters" button. Filters apply immediately.

### Offer row (06)

- **Row:** `surface`, `rounded-sm`, padding 16px / 24px, full width, 12px apart.
- **Left side:**
  - A 40px round avatar with the seller's initials (we have no seller images).
  - Seller name: `text-base` 600.
  - Rating line: an `accent` star, the rating (`text-xs` 700, our 0–5 scale), and `fg-muted` text.
- **Right side, right-aligned:**
  - MSRP struck through plus the discount (`text-xs`).
  - Price: `text-price`.
  - "N in stock": `text-xs` `fg-muted`.
  - A secondary "Add to cart" button next to the price block.
- **Best offer:** the cheapest in-stock offer sits under a "Best offer" heading and gets a "Best price" pill. The other offers follow under "Other offers (N)". This matches Eneba's "Recommended offer" / "N other offers" split.
- **Out of stock:** the row is at 50% opacity and its button is disabled with the label "Out of stock".
- **Below 640px:** the price block and button move under the seller.

### Buttons

| Variant | Style | Used for |
|---|---|---|
| `primary` | `accent` background, `on-accent` text, `text-sm` 700, `rounded-sm`, hover `accent-hover` | Checkout, Pay, Clear filters |
| `secondary` | Transparent, 1px `line-strong` border, `fg` text, `text-sm` 700 | Add to cart on offers, View offers, View cart |
| `icon` | No border, 24px icon in `fg` | Cart, close, quantity −/+, copy key |

- **Sizes:** `md` is 40px tall with 16px side padding; `sm` is 32px tall with 12px side padding.
- **Disabled:** 50% opacity.
- **Loading:** keeps its width, shows a spinner and is disabled. The Pay button uses this while the request is in flight.
- **Focus:** a 2px `accent` outline with a 2px offset. Eneba's focus style wasn't captured, so this is our own.

### Badges

| Badge | Style |
|---|---|
| Platform | `text-xs` 600 `fg`. On a card it sits in the cover band. Elsewhere it's a `rounded-full` pill with a 1px `line-strong` border |
| Region | `text-xs` 700, uppercase, in `region-ok` or `region-limited`, no background |
| Discount | `text-xs` 700 `discount`, for example "-11%", next to the struck-through MSRP |
| Best price | Pill with a 1px `discount` border, `text-xs` 600 `discount` text |
| Out of stock | Pill with a 1px `line-strong` border, `text-xs` `fg-muted` text (**Estimate**) |

### Smaller pieces

- **Cart and checkout (08):**
  - Panels are `surface-panel`, cart lines `surface-inset`, inputs `field`, with `text-sm` 600 labels above them.
  - Quantity stepper: − n +.
  - The summary panel ends with the total in `text-price-lg` and a full-width primary button.
  - Checkout steps (Cart → Payment → Key): the active step is `teal`, the others `fg-muted`.
- **Added-to-cart modal (07)**, optional because SPEC doesn't require it: `page` box about 440px wide on the `scrim`, a `teal` check, a `text-lg` title, a primary "Continue shopping" button and a secondary "View cart" button.
- **Key code (order pages):** monospace on `surface-inset`, with an icon button that copies it.
- **Skeletons:** `surface` blocks with Tailwind's `animate-pulse`.
- **Footer:** `surface`, `text-sm` `fg-muted`, saying it is an assignment demo not affiliated with Eneba (SPEC).

No Eneba logo, images or icons are used (SPEC).
