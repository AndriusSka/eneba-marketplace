<?php

namespace Tests\Support;

use App\Models\Key;
use App\Models\Offer;
use App\Models\OrderItem;
use App\Models\Platform;
use App\Models\Product;
use App\Models\Region;

/**
 * A small, fully known catalog for Store and product-page tests (the seeder's catalog is too
 * large to reason about in assertions).
 *
 * | key | title                  | platform | region | msrp | from-price | release    | sales |
 * |-----|------------------------|----------|--------|------|------------|------------|-------|
 * | A   | Elden Ring             | steam    | global | 5999 | 3449       | 2022-02-25 | 3     |
 * | B   | Cyberpunk 2077         | steam    | eu     | 4999 | 2999       | 2020-12-10 | 0     |
 * | C   | Forza Horizon 5        | xbox     | global | 5999 | 5999       | 2021-11-09 | 5     |
 * | D   | Hollow Knight          | xbox     | eu     | 1499 | sold out   | 2017-02-24 | 2     |
 * | E   | Gift Card 50% Bonus    | steam    | global | 5000 | 4800       | none       | 0     |
 * | F   | Elden Ring Nightreign  | steam    | eu     | 3999 | 3499       | 2025-05-30 | 0     |
 *
 * Traps: A has a cheaper offer whose keys are all sold (2999); B has a cheaper inactive offer (999);
 * D has one offer with only sold keys and one with no keys at all. A third platform (nintendo)
 * has no products, so its facet count is always 0.
 */
final class StoreCatalog
{
    /** @var array<string, Product> */
    public array $products = [];

    /** @var array<string, Offer> */
    public array $offers = [];

    public static function create(): self
    {
        $catalog = new self;

        $steam = Platform::factory()->create(['slug' => 'steam', 'name' => 'Steam']);
        $xbox = Platform::factory()->create(['slug' => 'xbox', 'name' => 'Xbox']);
        Platform::factory()->create(['slug' => 'nintendo', 'name' => 'Nintendo']);
        $global = Region::factory()->create(['slug' => 'global', 'name' => 'Global']);
        $eu = Region::factory()->create(['slug' => 'eu', 'name' => 'EU']);

        $catalog->product('A', 'Elden Ring', $steam, $global, 5999, '2022-02-25');
        $catalog->product('B', 'Cyberpunk 2077', $steam, $eu, 4999, '2020-12-10');
        $catalog->product('C', 'Forza Horizon 5', $xbox, $global, 5999, '2021-11-09');
        $catalog->product('D', 'Hollow Knight', $xbox, $eu, 1499, '2017-02-24');
        $catalog->product('E', 'Gift Card 50% Bonus', $steam, $global, 5000, null);
        $catalog->product('F', 'Elden Ring Nightreign', $steam, $eu, 3999, '2025-05-30');

        $catalog->offer('A1', 'A', 3449, available: 3);
        $catalog->offer('A2', 'A', 4500, available: 2);
        $catalog->offer('A3', 'A', 2999, sold: 1);                 // cheaper, but sold out
        $catalog->offer('B1', 'B', 2999, available: 1);
        $catalog->offer('B2', 'B', 999, available: 5, active: false); // cheaper, but inactive
        $catalog->offer('C1', 'C', 5999, available: 2, extraSales: 5);
        $catalog->offer('D1', 'D', 999, sold: 2);
        $catalog->offer('D2', 'D', 1299);                           // no keys at all
        $catalog->offer('E1', 'E', 4800, available: 5);
        $catalog->offer('F1', 'F', 3499, available: 4);

        // A: 1 sold key + 2 more units sold earlier = 3.
        OrderItem::factory()->create(['offer_id' => $catalog->offers['A1']->id, 'quantity' => 2]);

        return $catalog;
    }

    /** @param list<string> $keys */
    public function slugs(array $keys): array
    {
        return array_map(fn (string $key) => $this->products[$key]->slug, $keys);
    }

    private function product(string $key, string $title, Platform $platform, Region $region, int $msrp, ?string $release): void
    {
        $this->products[$key] = Product::factory()->create([
            'slug' => 'product-'.strtolower($key),
            'title' => $title,
            'platform_id' => $platform->id,
            'region_id' => $region->id,
            'msrp_cents' => $msrp,
            'release_date' => $release,
        ]);
    }

    /**
     * @param  int  $sold  keys sold on one order line of that quantity
     * @param  int  $extraSales  units sold on an order line whose keys aren't modelled
     */
    private function offer(string $key, string $product, int $price, int $available = 0, int $sold = 0, bool $active = true, int $extraSales = 0): void
    {
        $offer = Offer::factory()->create([
            'product_id' => $this->products[$product]->id,
            'price_cents' => $price,
            'is_active' => $active,
        ]);
        $this->offers[$key] = $offer;

        if ($available > 0) {
            Key::factory()->count($available)->create(['offer_id' => $offer->id]);
        }

        if ($sold > 0) {
            $item = OrderItem::factory()->create(['offer_id' => $offer->id, 'quantity' => $sold, 'unit_price_cents' => $price]);
            Key::factory()->count($sold)->sold($item)->create(['offer_id' => $offer->id]);
        }

        if ($extraSales > 0) {
            OrderItem::factory()->create(['offer_id' => $offer->id, 'quantity' => $extraSales, 'unit_price_cents' => $price]);
        }
    }
}
